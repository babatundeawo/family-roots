import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signOut, sendPasswordResetEmail, deleteUser } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, addDoc, setDoc,
  getDoc, updateDoc, deleteDoc, onSnapshot, query, where, arrayUnion, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const $ = s => document.querySelector(s), root = $('#app'), dlg = $('#dlg');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user = null, trees = [], cur = null, people = [], tab = 'tree', msg = '', unsubTrees, unsubPeople;
let pendingJoin = new URLSearchParams(location.hash.slice(1)).get('join');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
addEventListener('online', () => $('#off').style.display = 'none');
addEventListener('offline', () => $('#off').style.display = 'block');

const role = () => cur?.members?.[user.uid];
const canEdit = () => ['owner', 'editor'].includes(role());

onAuthStateChanged(auth, async u => {
  user = u; unsubTrees?.(); unsubPeople?.(); cur = null;
  if (!u) return render();
  unsubTrees = onSnapshot(query(collection(db, 'trees'), where('memberIds', 'array-contains', u.uid)), s => {
    trees = s.docs.map(d => ({ id: d.id, ...d.data() }));
    if (cur) { const t = trees.find(t => t.id === cur.id); if (t) cur = t; else { cur = null; unsubPeople?.(); } }
    render();
  }, e => { msg = e.message; render(); });
  if (pendingJoin) { await joinWith(pendingJoin); pendingJoin = null; history.replaceState(null, '', location.pathname); }
});

async function joinWith(code) {
  try {
    code = code.trim();
    const inv = await getDoc(doc(db, 'invites', code));
    if (!inv.exists()) throw new Error('Invite code not found.');
    const { treeId, role } = inv.data();
    await updateDoc(doc(db, 'trees', treeId), { [`members.${user.uid}`]: role, memberIds: arrayUnion(user.uid), joinCode: code });
    msg = 'Joined!';
  } catch (e) { msg = 'Could not join: ' + e.message; }
  render();
}

function openTree(t) {
  cur = t; tab = 'tree'; unsubPeople?.();
  unsubPeople = onSnapshot(collection(db, 'trees', t.id, 'people'), s => {
    people = s.docs.map(d => ({ id: d.id, ...d.data() })); render();
  });
  render();
}

const yrs = p => p.birthYear && p.deathYear ? ` (${p.birthYear}–${p.deathYear})` : p.birthYear ? ` (b. ${p.birthYear})` : p.deathYear ? ` (d. ${p.deathYear})` : '';
function flatten() {
  const ids = new Set(people.map(p => p.id)), out = [];
  const kids = id => people.filter(p => p.parentId === id).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
  const walk = (p, d, seen) => { if (seen.has(p.id)) return; out.push([p, d]); kids(p.id).forEach(k => walk(k, d + 1, new Set([...seen, p.id]))); };
  people.filter(p => !p.parentId || !ids.has(p.parentId)).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999)).forEach(p => walk(p, 0, new Set()));
  return out;
}

function render() {
  if (!user) return root.innerHTML = `
    <header><h1>🌳 Family Roots</h1></header>
    <main id="main"><div class="card hero"><h2>Keep your family story alive</h2><p class="mut">Record your family story and share it with relatives.</p>
    <label>Email</label><input id="em" type="email" autocomplete="email">
    <label>Password</label><input id="pw" type="password" autocomplete="current-password">
    <div class="err">${esc(msg)}</div>
    <div class="row"><button id="login">Sign in</button><button class="ghost" id="signup">Create account</button></div><br>
    <button class="ghost" style="width:100%" id="google">Continue with Google</button><br><br>
    <a href="#" id="forgot" class="mut">Forgot password?</a></div></main>`;
  if (!cur) return root.innerHTML = `
    <header><h1>🌳 Family Roots</h1><button class="sm ghost" id="out">Sign out</button></header>
    <main id="main">${msg ? `<p class="err">${esc(msg)}</p>` : ''}
    <h3>Your family trees</h3>
    ${trees.map(t => `<div class="card" data-tree="${t.id}" style="cursor:pointer"><b>${esc(t.name)}</b><br><span class="mut">${t.members[user.uid]} · ${t.memberIds.length} member(s)</span></div>`).join('') || '<p class="mut">No trees yet. Create one or join with an invite code.</p>'}
    <div class="card"><label>New tree name</label><input id="tn" placeholder="e.g. The Okafor Family"><button id="mk">Create tree</button></div>
    <div class="card"><label>Have an invite code or link?</label><input id="jc" placeholder="Paste code"><button class="ghost" id="join">Join tree</button></div>
    <p><a href="#" id="delacct" class="mut">Delete my account</a></p></main>`;
  const list = tab === 'tree'
    ? flatten().map(([p, d]) => `<div class="card" data-p="${p.id}" style="margin-left:${d * 18}px;cursor:pointer"><b>${esc(p.name)}</b>${yrs(p)}${p.birthPlace ? `<div class="mut">${esc(p.birthPlace)}</div>` : ''}${p.story ? `<div>${esc(p.story.slice(0, 140))}${p.story.length > 140 ? '…' : ''}</div>` : ''}</div>`).join('')
    : people.flatMap(p => [p.birthYear && [p.birthYear, `${p.name} born${p.birthPlace ? ' in ' + p.birthPlace : ''}`, p.id], p.deathYear && [p.deathYear, `${p.name} passed away`, p.id]].filter(Boolean))
        .sort((a, b) => a[0] - b[0]).map(e => `<div class="ev" data-p="${e[2]}" style="cursor:pointer"><b>${e[0]}</b><span>${esc(e[1])}</span></div>`).join('');
  root.innerHTML = `
    <header><button class="sm ghost" id="back">←</button><h1>${esc(cur.name)}</h1>
      <button class="sm ghost" id="share">Share</button>${role() === 'owner' ? '<button class="sm" id="invite">Invite</button>' : ''}</header>
    <main id="main">${list || `<p class="mut">${canEdit() ? 'Tap + to add your oldest known ancestor.' : 'Nothing here yet.'}</p>`}
    ${role() === 'owner' ? '<p><a href="#" id="deltree" class="mut">Delete this tree</a></p>' : ''}</main>
    ${canEdit() ? '<button class="fab" id="add">+</button>' : ''}
    <nav class="tabs"><button data-tab="tree" class="${tab === 'tree' ? 'on' : ''}">Tree</button><button data-tab="time" class="${tab === 'time' ? 'on' : ''}">Timeline</button></nav>`;
}

function personDialog(p) {
  const isNew = !p; p = p || {};
  const editable = canEdit();
  dlg.innerHTML = `<h3>${isNew ? 'Add person' : esc(p.name)}</h3>
    <label>Full name</label><input id="f-name" value="${esc(p.name)}" ${editable ? '' : 'disabled'}>
    <div class="row"><div><label>Born (year)</label><input id="f-b" inputmode="numeric" maxlength="4" value="${p.birthYear ?? ''}" ${editable ? '' : 'disabled'}></div>
    <div><label>Died (year)</label><input id="f-d" inputmode="numeric" maxlength="4" value="${p.deathYear ?? ''}" ${editable ? '' : 'disabled'}></div></div>
    <label>Birthplace / origin</label><input id="f-place" value="${esc(p.birthPlace)}" ${editable ? '' : 'disabled'}>
    <label>Parent</label><select id="f-par" ${editable ? '' : 'disabled'}><option value="">None (root ancestor)</option>
      ${people.filter(x => x.id !== p.id).map(x => `<option value="${x.id}" ${x.id === p.parentId ? 'selected' : ''}>${esc(x.name)}${yrs(x)}</option>`).join('')}</select>
    <label>Story, traditions, memories</label><textarea id="f-story" rows="6" ${editable ? '' : 'disabled'}>${esc(p.story)}</textarea>
    <div class="row">${editable ? '<button id="f-save">Save</button>' : ''}${editable && !isNew ? '<button class="danger" id="f-del">Delete</button>' : ''}<button class="ghost" id="f-x">Close</button></div>`;
  dlg.showModal();
  $('#f-x').onclick = () => dlg.close();
  if (!editable) return;
  $('#f-save').onclick = async () => {
    const name = $('#f-name').value.trim(); if (!name) return;
    const num = v => /^\d{1,4}$/.test(v.trim()) ? +v : null;
    const data = { name, birthYear: num($('#f-b').value), deathYear: num($('#f-d').value), birthPlace: $('#f-place').value.trim(),
      story: $('#f-story').value.trim(), parentId: $('#f-par').value || null };
    dlg.close();
    isNew ? addDoc(collection(db, 'trees', cur.id, 'people'), data) : setDoc(doc(db, 'trees', cur.id, 'people', p.id), data);
  };
  if (!isNew) $('#f-del').onclick = () => { if (confirm('Delete this person?')) { dlg.close(); deleteDoc(doc(db, 'trees', cur.id, 'people', p.id)); } };
}

function inviteDialog() {
  dlg.innerHTML = `<h3>Invite relatives</h3><p class="mut">Anyone with the link who signs in can join with the role you choose.</p>
    <label>Role</label><select id="i-role"><option value="editor">Editor – can add and edit people</option><option value="viewer">Viewer – read only</option></select>
    <button id="i-mk">Create invite link</button><p id="i-out"></p><button class="ghost" id="i-x">Close</button>`;
  dlg.showModal();
  $('#i-x').onclick = () => dlg.close();
  $('#i-mk').onclick = async () => {
    const code = [...crypto.getRandomValues(new Uint8Array(12))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    await setDoc(doc(db, 'invites', code), { treeId: cur.id, role: $('#i-role').value, createdBy: user.uid });
    const link = location.origin + location.pathname + '#join=' + code;
    $('#i-out').innerHTML = `<input readonly value="${link}" id="i-link"><button class="ghost" id="i-cp">Share / copy</button>`;
    $('#i-link').onclick = e => e.target.select();
    $('#i-cp').onclick = () => navigator.share ? navigator.share({ title: 'Join our family tree', url: link }).catch(() => {}) : navigator.clipboard.writeText(link);
  };
}

root.addEventListener('click', async e => {
  const t = e.target, q = s => t.closest(s);
  if (t.id === 'login' || t.id === 'signup') {
    try { msg = ''; const f = t.id === 'login' ? signInWithEmailAndPassword : createUserWithEmailAndPassword; await f(auth, $('#em').value, $('#pw').value); }
    catch (er) { msg = er.message.replace('Firebase: ', ''); render(); }
  } else if (t.id === 'google') { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (er) { msg = er.message; render(); } }
  else if (t.id === 'forgot') { e.preventDefault(); const em = $('#em').value; if (em) { await sendPasswordResetEmail(auth, em); msg = 'Password reset email sent.'; render(); } else { msg = 'Enter your email first.'; render(); } }
  else if (t.id === 'out') signOut(auth);
  else if (t.id === 'mk') { const n = $('#tn').value.trim(); if (n) { try { msg = ''; await addDoc(collection(db, 'trees'), { name: n, members: { [user.uid]: 'owner' }, memberIds: [user.uid], createdAt: serverTimestamp() }); } catch (er) { msg = 'Could not create tree: ' + er.message; render(); } } }
  else if (t.id === 'join') { const c = $('#jc').value.trim().split('join=').pop(); if (c) joinWith(c); }
  else if (q('[data-tree]')) openTree(trees.find(x => x.id === q('[data-tree]').dataset.tree));
  else if (t.id === 'back') { cur = null; unsubPeople?.(); people = []; msg = ''; render(); }
  else if (t.id === 'add') personDialog();
  else if (q('[data-p]')) personDialog(people.find(x => x.id === q('[data-p]').dataset.p));
  else if (t.dataset.tab) { tab = t.dataset.tab; render(); }
  else if (t.id === 'invite') inviteDialog();
  else if (t.id === 'share') {
    const text = `${cur.name}\n\n` + flatten().map(([p, d]) => '  '.repeat(d) + '• ' + p.name + yrs(p) + (p.birthPlace ? ', ' + p.birthPlace : '')).join('\n');
    navigator.share ? navigator.share({ title: cur.name, text }).catch(() => {}) : navigator.clipboard.writeText(text);
  }
  else if (t.id === 'deltree') { e.preventDefault(); if (confirm('Delete this tree and all its people for everyone?')) {
    const id = cur.id; for (const d of (await getDocs(collection(db, 'trees', id, 'people'))).docs) await deleteDoc(d.ref);
    cur = null; await deleteDoc(doc(db, 'trees', id)); } }
  else if (t.id === 'delacct') { e.preventDefault(); if (confirm('Permanently delete your account? Trees you own stay until you delete them first.')) {
    try { await deleteUser(auth.currentUser); } catch (er) { msg = 'Please sign out and sign in again, then retry. ' + er.message; render(); } } }
});
render();
