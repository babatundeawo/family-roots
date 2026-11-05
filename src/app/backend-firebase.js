// The real backend: Firebase Authentication and Cloud Firestore (Spark plan).
// Your Firebase settings are filled in at build time from the GitHub secrets.
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  GoogleAuthProvider, signInWithPopup, signOut, sendPasswordResetEmail, deleteUser,
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, addDoc, setDoc, getDoc,
  updateDoc, deleteDoc, onSnapshot, query, where, arrayUnion, getDocs, serverTimestamp,
} from "firebase/firestore";

const app = initializeApp(__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const asUser = (u) => (u ? { uid: u.uid, email: u.email || "", name: u.displayName || "" } : null);

export const backend = {
  onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(asUser(u))),
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  async signUp(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    sendEmailVerification(cred.user).catch(() => {});
  },
  google: () => signInWithPopup(auth, new GoogleAuthProvider()),
  logout: () => signOut(auth),
  reset: (email) => sendPasswordResetEmail(auth, email),
  deleteAccount: () => deleteUser(auth.currentUser),

  watchTrees(uid, cb, err) {
    return onSnapshot(query(collection(db, "trees"), where("memberIds", "array-contains", uid)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), err);
  },
  watchPeople(treeId, cb, err) {
    return onSnapshot(collection(db, "trees", treeId, "people"), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), err);
  },
  async createTree(name, uid) {
    const ref = await addDoc(collection(db, "trees"), { name, members: { [uid]: "owner" }, memberIds: [uid], createdAt: serverTimestamp() });
    return ref.id;
  },
  renameTree: (id, name) => updateDoc(doc(db, "trees", id), { name }),
  async deleteTree(id) {
    for (const d of (await getDocs(collection(db, "trees", id, "people"))).docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db, "trees", id));
  },
  async savePerson(treeId, id, data) {
    if (id) return setDoc(doc(db, "trees", treeId, "people", id), data);
    return addDoc(collection(db, "trees", treeId, "people"), data);
  },
  removePerson: (treeId, id) => deleteDoc(doc(db, "trees", treeId, "people", id)),

  async createInvite(treeId, role, uid) {
    const code = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    await setDoc(doc(db, "invites", code), { treeId, role, createdBy: uid });
    return code;
  },
  async joinWithCode(code, uid) {
    const inv = await getDoc(doc(db, "invites", code));
    if (!inv.exists()) throw Object.assign(new Error("That invite code was not found. Ask for a new link."), { code: "app/no-invite" });
    const { treeId, role } = inv.data();
    await updateDoc(doc(db, "trees", treeId), { [`members.${uid}`]: role, memberIds: arrayUnion(uid), joinCode: code });
    return treeId;
  },
};
