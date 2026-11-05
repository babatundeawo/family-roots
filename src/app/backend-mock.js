// A pretend backend that keeps everything in memory. It exists only so the screens can be tested and
// photographed without a Firebase project. It is compiled in only when the build runs with MOCK=1.
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
let user = null;
let authCb = () => {};
const trees = new Map();
const people = new Map();
const invites = new Map();
const treeSubs = new Set();
const peopleSubs = new Set();
let n = 0;
const uid = () => "mock" + ++n;

function seed() {
  const t = "t-sample";
  trees.set(t, { id: t, name: "Sample family (not real)", members: { u1: "owner" }, memberIds: ["u1"] });
  const rows = [
    ["a", "Adaeze Okoro", 1921, 1994, "Enugu, Nigeria", null, "Sample story. Adaeze kept the family's recipes in a notebook that is still passed down."],
    ["b", "Chidi Okoro", 1946, null, "Enugu, Nigeria", "a", "Sample story. Chidi moved to Lagos in 1968 to work on the railway."],
    ["c", "Ngozi Okoro", 1949, null, "Enugu, Nigeria", "a", ""],
    ["d", "Emeka Okoro", 1975, null, "Lagos, Nigeria", "b", "Sample story. Emeka started the yearly family reunion."],
    ["e", "Amara Okoro", 1979, null, "Lagos, Nigeria", "b", ""],
    ["f", "Zainab Bello", 2004, null, "Abuja, Nigeria", "d", "Sample story."],
  ];
  people.set(t, new Map(rows.map(([id, name, birthYear, deathYear, birthPlace, parentId, story]) => [id, { id, name, birthYear, deathYear, birthPlace, parentId, story }])));
}

const emit = () => {
  treeSubs.forEach((f) => f());
  peopleSubs.forEach((f) => f());
};

export const backend = {
  onAuth(cb) { authCb = cb; setTimeout(() => cb(user), 20); return () => {}; },
  async signIn(email, password) {
    await wait();
    if (password === "wrongpass") throw Object.assign(new Error("bad"), { code: "auth/invalid-credential" });
    user = { uid: "u1", email, name: "" };
    if (!trees.size) seed();
    authCb(user);
  },
  async signUp(email, password) {
    await wait();
    if (email === "taken@example.com") throw Object.assign(new Error("bad"), { code: "auth/email-already-in-use" });
    user = { uid: "u1", email, name: "" };
    if (!trees.size) seed();
    authCb(user);
  },
  async google() { return backend.signIn("google.user@example.com", "x"); },
  async logout() { user = null; authCb(null); },
  async reset() { await wait(); },
  async deleteAccount() { user = null; authCb(null); },

  watchTrees(u, cb) {
    const f = () => cb([...trees.values()].filter((t) => t.memberIds.includes(u)).map((t) => ({ ...t })));
    treeSubs.add(f); setTimeout(f, 40); return () => treeSubs.delete(f);
  },
  watchPeople(treeId, cb) {
    const f = () => cb([...(people.get(treeId)?.values() || [])].map((p) => ({ ...p })));
    peopleSubs.add(f); setTimeout(f, 40); return () => peopleSubs.delete(f);
  },
  async createTree(name, u) {
    const id = uid(); trees.set(id, { id, name, members: { [u]: "owner" }, memberIds: [u] }); people.set(id, new Map()); emit(); return id;
  },
  async renameTree(id, name) { trees.get(id).name = name; emit(); },
  async deleteTree(id) { trees.delete(id); people.delete(id); emit(); },
  async savePerson(treeId, id, data) {
    const pid = id || uid(); people.get(treeId).set(pid, { id: pid, ...data }); emit();
  },
  async removePerson(treeId, id) { people.get(treeId).delete(id); emit(); },
  async createInvite(treeId, role) { const c = "mockcode" + uid(); invites.set(c, { treeId, role }); return c; },
  async joinWithCode(code, u) {
    const inv = invites.get(code);
    if (!inv) throw Object.assign(new Error("That invite code was not found. Ask for a new link."), { code: "app/no-invite" });
    const t = trees.get(inv.treeId); t.members[u] = inv.role; if (!t.memberIds.includes(u)) t.memberIds.push(u); emit(); return inv.treeId;
  },
};
