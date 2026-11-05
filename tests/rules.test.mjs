// Tests for firestore.rules. They run in GitHub Actions against the Firestore emulator
// (npm run test:rules). They are never run on your computer or by you.
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, serverTimestamp, collection, getDocs } from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-family-roots", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
after(() => env.cleanup());

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "trees/t1"), { name: "Test tree", members: { owner: "owner", ed: "editor", view: "viewer" }, memberIds: ["owner", "ed", "view"] });
    await setDoc(doc(db, "trees/t1/people/p1"), { name: "Ada", birthYear: 1950, deathYear: null, birthPlace: "Enugu", story: "", parentId: null });
    await setDoc(doc(db, "invites/code1"), { treeId: "t1", role: "viewer", createdBy: "owner" });
    await setDoc(doc(db, "invites/code2"), { treeId: "t1", role: "editor", createdBy: "owner" });
  });
});

const person = (over = {}) => ({ name: "Bola", birthYear: 1980, deathYear: null, birthPlace: "Lagos", story: "Hello", parentId: "p1", ...over });

describe("trees", () => {
  it("members can read; strangers and signed-out visitors cannot", async () => {
    await assertSucceeds(getDoc(doc(as("view"), "trees/t1")));
    await assertFails(getDoc(doc(as("stranger"), "trees/t1")));
    await assertFails(getDoc(doc(anon(), "trees/t1")));
  });
  it("anyone signed in can create their own tree as owner", async () => {
    await assertSucceeds(setDoc(doc(as("u9"), "trees/new"), { name: "Mine", members: { u9: "owner" }, memberIds: ["u9"], createdAt: serverTimestamp() }));
  });
  it("cannot create a tree that makes someone else the owner or has a long name", async () => {
    await assertFails(setDoc(doc(as("u9"), "trees/x"), { name: "Mine", members: { other: "owner" }, memberIds: ["other"], createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("u9"), "trees/y"), { name: "x".repeat(81), members: { u9: "owner" }, memberIds: ["u9"], createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("u9"), "trees/z"), { name: "Mine", members: { u9: "owner" }, memberIds: ["u9"], createdAt: serverTimestamp(), extra: 1 }));
  });
  it("only owners can rename or delete", async () => {
    await assertSucceeds(updateDoc(doc(as("owner"), "trees/t1"), { name: "New name" }));
    await assertFails(updateDoc(doc(as("ed"), "trees/t1"), { name: "Hacked" }));
    await assertFails(deleteDoc(doc(as("ed"), "trees/t1")));
    await assertSucceeds(deleteDoc(doc(as("owner"), "trees/t1")));
  });
  it("an owner cannot use rename to change members", async () => {
    await assertFails(updateDoc(doc(as("owner"), "trees/t1"), { "members.view": "owner" }));
  });
});

describe("joining with an invite", () => {
  it("a stranger can join with the role on the invite", async () => {
    await assertSucceeds(updateDoc(doc(as("new1"), "trees/t1"), { "members.new1": "viewer", memberIds: arrayUnion("new1"), joinCode: "code1" }));
  });
  it("cannot claim a better role than the invite gives", async () => {
    await assertFails(updateDoc(doc(as("new1"), "trees/t1"), { "members.new1": "editor", memberIds: arrayUnion("new1"), joinCode: "code1" }));
    await assertFails(updateDoc(doc(as("new1"), "trees/t1"), { "members.new1": "owner", memberIds: arrayUnion("new1"), joinCode: "code1" }));
  });
  it("cannot join with a made-up code or a code for another tree", async () => {
    await assertFails(updateDoc(doc(as("new1"), "trees/t1"), { "members.new1": "viewer", memberIds: arrayUnion("new1"), joinCode: "nope" }));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "invites/other"), { treeId: "t2", role: "viewer", createdBy: "x" }));
    await assertFails(updateDoc(doc(as("new1"), "trees/t1"), { "members.new1": "viewer", memberIds: arrayUnion("new1"), joinCode: "other" }));
  });
  it("cannot add someone else along with yourself", async () => {
    await assertFails(updateDoc(doc(as("new1"), "trees/t1"), { "members.new1": "viewer", "members.friend": "viewer", memberIds: arrayUnion("new1", "friend"), joinCode: "code1" }));
  });
});

describe("people", () => {
  it("members can read people; strangers cannot", async () => {
    await assertSucceeds(getDocs(collection(as("view"), "trees/t1/people")));
    await assertFails(getDocs(collection(as("stranger"), "trees/t1/people")));
  });
  it("editors and owners can add, change and delete; viewers cannot", async () => {
    await assertSucceeds(setDoc(doc(as("ed"), "trees/t1/people/p2"), person()));
    await assertSucceeds(setDoc(doc(as("owner"), "trees/t1/people/p3"), person()));
    await assertSucceeds(setDoc(doc(as("ed"), "trees/t1/people/p1"), person({ name: "Ada B" })));
    await assertSucceeds(deleteDoc(doc(as("ed"), "trees/t1/people/p1")));
    await assertFails(setDoc(doc(as("view"), "trees/t1/people/p4"), person()));
    await assertFails(deleteDoc(doc(as("view"), "trees/t1/people/p1")));
    await assertFails(setDoc(doc(as("stranger"), "trees/t1/people/p5"), person()));
  });
  it("rejects bad data", async () => {
    const db = as("ed");
    await assertFails(setDoc(doc(db, "trees/t1/people/b1"), person({ name: "" })));
    await assertFails(setDoc(doc(db, "trees/t1/people/b2"), person({ name: "x".repeat(121) })));
    await assertFails(setDoc(doc(db, "trees/t1/people/b3"), person({ birthYear: "1980" })));
    await assertFails(setDoc(doc(db, "trees/t1/people/b4"), person({ birthYear: 99999 })));
    await assertFails(setDoc(doc(db, "trees/t1/people/b5"), person({ story: "x".repeat(5001) })));
    await assertFails(setDoc(doc(db, "trees/t1/people/b6"), person({ isAdmin: true })));
    await assertSucceeds(setDoc(doc(db, "trees/t1/people/ok"), person({ story: "x".repeat(5000) })));
  });
});

describe("invites", () => {
  it("owners can create invites for editor or viewer only", async () => {
    await assertSucceeds(setDoc(doc(as("owner"), "invites/new1"), { treeId: "t1", role: "editor", createdBy: "owner" }));
    await assertFails(setDoc(doc(as("owner"), "invites/new2"), { treeId: "t1", role: "owner", createdBy: "owner" }));
  });
  it("editors, viewers and strangers cannot create invites", async () => {
    for (const u of ["ed", "view", "stranger"]) await assertFails(setDoc(doc(as(u), "invites/x" + u), { treeId: "t1", role: "viewer", createdBy: u }));
  });
  it("a signed-in person can read one invite but cannot list them; signed-out cannot read", async () => {
    await assertSucceeds(getDoc(doc(as("stranger"), "invites/code1")));
    await assertFails(getDocs(collection(as("stranger"), "invites")));
    await assertFails(getDoc(doc(anon(), "invites/code1")));
  });
});
