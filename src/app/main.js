// Family Roots: the whole app. Plain JavaScript, no framework.
// Screens: landing and sign-in, your trees, one tree (family outline or timeline), person and invite dialogs.
import { $, $$, esc, initials, years, store, toast, copyText, openDialog, wireDialog, confirmDialog, friendlyError } from "./util.js";
import { setupShell } from "./shell.js";

const backendReady = (__MOCK__ ? import("./backend-mock.js") : import("./backend-firebase.js")).then((m) => m.backend);

const root = $("#app");
const main = $("#main");
const dlg = $("#dlg");
wireDialog(dlg);
wireDialog($("#confirm"));

const state = {
  user: null, trees: [], treesLoaded: false, treeError: "", cur: null, people: [], peopleLoaded: false,
  view: "tree", q: "", pendingJoin: null, notice: "",
};
let backend = null;
let unsubTrees = null;
let unsubPeople = null;
const role = () => state.cur?.members?.[state.user?.uid];
const canEdit = () => ["owner", "editor"].includes(role());

/* ---------- Small data helpers ---------- */
function indexPeople(list) {
  const byId = new Map(list.map((p) => [p.id, p]));
  const sortFn = (a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999) || String(a.name).localeCompare(String(b.name));
  const kids = new Map();
  for (const p of list) {
    const key = p.parentId && byId.has(p.parentId) ? p.parentId : "";
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(p);
  }
  for (const arr of kids.values()) arr.sort(sortFn);
  const seen = new Set();
  const depth = new Map();
  const visit = (p, d) => { if (seen.has(p.id)) return; seen.add(p.id); depth.set(p.id, d); (kids.get(p.id) || []).forEach((k) => visit(k, d + 1)); };
  (kids.get("") || []).forEach((p) => visit(p, 0));
  // Anyone left over is stuck in a loop of parents (possible if data was edited by hand). Show them as roots.
  const strays = list.filter((p) => !seen.has(p.id)).sort(sortFn);
  strays.forEach((p) => visit(p, 0));
  const descendants = (id) => { const out = new Set(); const go = (x) => (kids.get(x) || []).forEach((k) => { if (!out.has(k.id)) { out.add(k.id); go(k.id); } }); go(id); return out; };
  const roots = [...(kids.get("") || []), ...strays.filter((p) => !(kids.get("") || []).includes(p))];
  const generations = list.length ? Math.max(...depth.values()) + 1 : 0;
  return { byId, kids, roots, descendants, generations, depth };
}

const outline = (idx) => {
  const lines = [];
  const walk = (p, d, seen) => {
    if (seen.has(p.id)) return;
    lines.push("  ".repeat(d) + "• " + p.name + (years(p) ? ` (${years(p)})` : "") + (p.birthPlace ? ", " + p.birthPlace : ""));
    (idx.kids.get(p.id) || []).forEach((k) => walk(k, d + 1, new Set([...seen, p.id])));
  };
  idx.roots.forEach((p) => walk(p, 0, new Set()));
  return lines.join("\n");
};

/* ---------- Session ---------- */
async function start() {
  backend = await backendReady;
  setupShell();
  parseHash(true);
  backend.onAuth(onAuth);
}

function onAuth(u) {
  state.user = u;
  unsubTrees?.(); unsubPeople?.();
  state.cur = null; state.people = []; state.trees = []; state.treesLoaded = false; state.treeError = "";
  document.documentElement.classList.toggle("has-session", !!u);
  store("fr-session", u ? "1" : null);
  main.classList.toggle("app", !!u);
  $("#join-note").hidden = !!u || !state.pendingJoin;
  renderAccount();
  if (!u) { root.innerHTML = ""; document.title = defaultTitle; return; }
  render();
  unsubTrees = backend.watchTrees(u.uid, (list) => {
    state.trees = list; state.treesLoaded = true; state.treeError = "";
    if (state.cur) { const t = list.find((x) => x.id === state.cur.id); if (t) state.cur = t; }
    route();
  }, (err) => { state.treesLoaded = true; state.treeError = friendlyError(err); render(); });
  if (state.pendingJoin) joinWith(state.pendingJoin);
}

const defaultTitle = document.title;
async function joinWith(code) {
  state.pendingJoin = null;
  try {
    const id = await backend.joinWithCode(String(code).trim(), state.user.uid);
    toast("You joined the tree");
    location.hash = "#/t/" + id;
  } catch (err) {
    state.notice = "Could not join: " + friendlyError(err);
    location.hash = "#/";
    render();
  }
}

/* ---------- Routing: #/ (your trees) and #/t/<id> (one tree) ---------- */
function parseHash(first) {
  const h = location.hash;
  const join = new URLSearchParams(h.replace(/^#\/?/, "")).get("join");
  if (join) {
    state.pendingJoin = join;
    history.replaceState(null, "", location.pathname + location.search + "#/");
    if (!first && state.user) joinWith(join);
  }
}
addEventListener("hashchange", () => { parseHash(false); route(); });

function route() {
  if (!state.user) return;
  const m = location.hash.match(/^#\/t\/([^/?]+)/);
  if (m) {
    const t = state.trees.find((x) => x.id === m[1]);
    if (t) {
      if (!state.cur || state.cur.id !== t.id) openTree(t); else { state.cur = t; render(); }
      return;
    }
    if (!state.treesLoaded) return render();
    state.notice = "That tree was not found, or you are not a member of it.";
    location.hash = "#/";
    return;
  }
  if (state.cur) { unsubPeople?.(); state.cur = null; state.people = []; state.q = ""; }
  render(true);
}

function openTree(t) {
  unsubPeople?.();
  state.cur = t; state.people = []; state.peopleLoaded = false; state.view = "tree"; state.q = "";
  unsubPeople = backend.watchPeople(t.id, (list) => { state.people = list; state.peopleLoaded = true; render(); }, (err) => { state.peopleLoaded = true; state.notice = friendlyError(err); render(); });
  render(true);
}

/* ---------- Rendering ---------- */
const icon = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg>',
  tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 21v-9M12 12C12 8 9 6 6 6M12 12c0-4 3-6 6-6M12 16c0-2.5-2-4-4-4"/><circle cx="6" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="8" cy="12" r="1.4"/></svg>',
};

function render(focusHeading = false) {
  if (!state.user) return;
  if (state.cur) renderTree(); else renderTrees();
  document.title = state.cur ? `${state.cur.name} - Family Roots` : defaultTitle;
  main.classList.toggle("no-tabs", !state.cur);
  if (focusHeading) { const h = $("#app h1"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: false }); } }
}

const noticeHtml = () => {
  const n = state.notice || state.treeError;
  return n ? `<div class="banner err" role="alert"><p>${esc(n)}</p><button class="btn ghost sm" type="button" data-act="dismiss">Dismiss</button></div>` : "";
};

function renderTrees() {
  const list = state.trees;
  const body = !state.treesLoaded
    ? '<div class="tree-list" aria-busy="true"><div class="card skel"></div><div class="card skel"></div></div>'
    : list.length
      ? `<ul class="tree-list">${list.map((t) => `<li><button class="tree-card" type="button" data-tree="${esc(t.id)}"><span class="avatar" aria-hidden="true">${esc(initials(t.name))}</span><span><b>${esc(t.name)}</b><span class="meta">${esc(t.members[state.user.uid])} &middot; ${t.memberIds.length} ${t.memberIds.length === 1 ? "member" : "members"}</span></span></button></li>`).join("")}</ul>`
      : `<div class="empty">${icon.tree}<h2>Plant your first tree</h2><p>Give your family tree a name below. You can add the first person right after.</p></div>`;
  root.innerHTML = `${noticeHtml()}
    <div class="screen-head"><h1>Your family trees</h1></div>
    ${body}
    <div class="forms">
      <form class="card" id="new-tree" novalidate>
        <h2>Start a new tree</h2>
        <label for="tn">Tree name</label>
        <input id="tn" maxlength="80" placeholder="For example, The Okafor Family" autocomplete="off" required>
        <div class="field-error" id="tn-err" role="alert"></div>
        <div class="actions"><button class="btn" type="submit">Create tree</button></div>
      </form>
      <form class="card" id="join-form" novalidate>
        <h2>Have an invite?</h2>
        <label for="jc">Invite link or code</label>
        <input id="jc" placeholder="Paste it here" autocomplete="off" autocapitalize="off" spellcheck="false" required>
        <div class="field-error" id="jc-err" role="alert"></div>
        <div class="actions"><button class="btn ghost" type="submit">Join tree</button></div>
      </form>
    </div>`;
}

function personCard(p, idx, q) {
  const yr = years(p);
  const snip = p.story ? p.story.slice(0, 140) + (p.story.length > 140 ? "…" : "") : "";
  const label = `${p.name}${yr ? ", " + yr : ""}`;
  return `<button class="person" type="button" data-p="${esc(p.id)}" aria-label="${esc(label)}. Open details."><span class="avatar" aria-hidden="true">${esc(initials(p.name))}</span><span class="body"><b>${esc(p.name)}</b>${yr || p.birthPlace ? `<span class="sub">${yr ? `<span>${esc(yr)}</span>` : ""}${p.birthPlace ? `<span>${esc(p.birthPlace)}</span>` : ""}</span>` : ""}${snip ? `<span class="snip">${esc(snip)}</span>` : ""}</span></button>`;
}

function branchHtml(list, idx, seen = new Set()) {
  return `<ul class="branch">${list.filter((p) => !seen.has(p.id)).map((p) => {
    const kids = idx.kids.get(p.id) || [];
    return `<li>${personCard(p, idx)}${kids.length ? branchHtml(kids, idx, new Set([...seen, p.id])) : ""}</li>`;
  }).join("")}</ul>`;
}

function renderTree() {
  const t = state.cur;
  const idx = indexPeople(state.people);
  const q = state.q.trim().toLowerCase();
  let content;
  if (!state.peopleLoaded) content = '<div aria-busy="true"><div class="card skel"></div></div>';
  else if (!state.people.length) {
    content = `<div class="empty">${icon.tree}<h2>This tree is waiting for its first person</h2><p>${canEdit() ? "Add the oldest ancestor you know. You can add their children afterwards." : "Nothing has been added yet. An editor of this tree can add people."}</p>${canEdit() ? '<button class="btn" type="button" data-act="add">Add the first person</button>' : ""}</div>`;
  } else if (state.view === "time") {
    const ev = state.people.flatMap((p) => [
      p.birthYear && { y: p.birthYear, text: `${p.name} was born${p.birthPlace ? " in " + p.birthPlace : ""}`, id: p.id },
      p.deathYear && { y: p.deathYear, text: `${p.name} passed away`, id: p.id },
    ].filter(Boolean)).sort((a, b) => a.y - b.y);
    content = ev.length
      ? `<ol class="timeline">${ev.map((e) => `<li><button class="ev" type="button" data-p="${esc(e.id)}"><b>${e.y}</b><span>${esc(e.text)}</span></button></li>`).join("")}</ol>`
      : '<div class="empty"><h2>No dates yet</h2><p>Add birth or death years to people and they will appear here in order.</p></div>';
  } else if (q) {
    const hits = state.people.filter((p) => `${p.name} ${p.birthPlace || ""}`.toLowerCase().includes(q)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    content = hits.length ? `<ul class="branch">${hits.map((p) => `<li>${personCard(p, idx)}</li>`).join("")}</ul>` : `<div class="empty"><h2>No one matches “${esc(state.q.trim())}”</h2><p>Try a different name or place.</p></div>`;
  } else content = branchHtml(idx.roots, idx);

  const isOwner = role() === "owner";
  root.innerHTML = `${noticeHtml()}
    <div class="screen-head no-print">
      <div><a class="link-btn" href="#/" aria-label="Back to your trees" data-act="back">&larr; All trees</a><h1>${esc(t.name)}</h1></div>
      <div class="row tight">
        <button class="btn ghost sm" type="button" data-act="share">Share outline</button>
        ${isOwner ? '<button class="btn sm" type="button" data-act="invite">Invite</button>' : ""}
        <details class="menu" id="tree-menu"><summary class="icon-btn" aria-label="More options for this tree">${icon.more}</summary>
          <div class="menu-list">
            ${isOwner ? '<button type="button" data-act="rename">Rename tree</button>' : ""}
            <button type="button" data-act="print">Print the tree</button>
            <button type="button" data-act="backup">Download a backup</button>
            ${isOwner ? '<div class="sep"></div><button type="button" class="danger-item" data-act="deltree">Delete this tree</button>' : ""}
          </div></details>
      </div>
    </div>
    <p class="print-title">${esc(t.name)}</p>
    ${state.people.length ? `<div class="toolbar no-print"><div class="stats"><span><b>${state.people.length}</b> ${state.people.length === 1 ? "person" : "people"}</span><span><b>${idx.generations}</b> ${idx.generations === 1 ? "generation" : "generations"}</span><span>Your role: <b>${esc(role())}</b></span></div>
      ${state.view === "tree" ? `<div class="search"><label class="sr-only" for="q">Search by name or place</label>${icon.search}<input id="q" type="search" placeholder="Search by name or place" value="${esc(state.q)}" autocomplete="off"></div>` : ""}</div>` : ""}
    ${content}
    ${canEdit() ? `<button class="fab no-print" type="button" data-act="add">${icon.plus}<span>Add person</span></button>` : ""}
    <nav class="tabs no-print" aria-label="Tree views"><button type="button" data-view="tree" ${state.view === "tree" ? 'aria-current="page"' : ""}>Family</button><button type="button" data-view="time" ${state.view === "time" ? 'aria-current="page"' : ""}>Timeline</button></nav>`;
}

/* The h2 used for printing replaces the visible one; keep only one visible heading on screen */
function renderAccount() {
  const host = $("#hactions");
  $("#acct")?.remove();
  if (!state.user) return;
  const label = state.user.email || state.user.name || "Account";
  const el = document.createElement("details");
  el.className = "menu"; el.id = "acct";
  el.innerHTML = `<summary class="icon-btn" aria-label="Account menu for ${esc(label)}"><span aria-hidden="true">${esc(initials(label))}</span></summary>
    <div class="menu-list"><p></p><button type="button" data-act="signout">Sign out</button><div class="sep"></div><button type="button" class="danger-item" data-act="delacct">Delete my account</button></div>`;
  $("p", el).textContent = label;
  $("p", el).className = "hint";
  $("p", el).setAttribute("role", "note");
  host.prepend(el);
}

/* ---------- Dialogs ---------- */
const close = '<button class="icon-btn" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';

function personView(id) {
  const p = state.people.find((x) => x.id === id);
  if (!p) return;
  const idx = indexPeople(state.people);
  const parent = p.parentId ? idx.byId.get(p.parentId) : null;
  const kids = idx.kids.get(p.id) || [];
  openDialog(dlg, `<div class="dlg-body"><div class="dlg-top"><h3 id="dlg-title">${esc(p.name)}</h3>${close}</div>
    <ul class="facts">${p.birthYear ? `<li><b>Born:</b> ${p.birthYear}${p.birthPlace ? ", " + esc(p.birthPlace) : ""}</li>` : p.birthPlace ? `<li><b>From:</b> ${esc(p.birthPlace)}</li>` : ""}
      ${p.deathYear ? `<li><b>Passed away:</b> ${p.deathYear}</li>` : ""}
      ${parent ? `<li><b>Child of:</b> <button class="link-btn" type="button" data-open="${esc(parent.id)}">${esc(parent.name)}</button></li>` : ""}</ul>
    ${p.story ? `<p class="story">${esc(p.story)}</p>` : `<p class="mut story">No story written yet.</p>`}
    ${kids.length ? `<p class="hint kids-label">Children</p><div class="kids">${kids.map((k) => `<button type="button" data-open="${esc(k.id)}">${esc(k.name)}</button>`).join("")}</div>` : ""}
    <div class="actions">${canEdit() ? `<button class="btn" type="button" data-edit="${esc(p.id)}">Edit</button><button class="btn ghost" type="button" data-addchild="${esc(p.id)}">Add a child</button>` : ""}<button class="btn ghost" type="button" data-close>Close</button></div></div>`);
}

function personForm(id, parentId = "") {
  const isNew = !id;
  const p = isNew ? { parentId: parentId || "" } : state.people.find((x) => x.id === id);
  if (!p) return;
  const idx = indexPeople(state.people);
  const blocked = id ? new Set([id, ...idx.descendants(id)]) : new Set();
  const options = state.people.filter((x) => !blocked.has(x.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  openDialog(dlg, `<form class="dlg-body" id="person-form" data-id="${esc(id || "")}" novalidate>
    <div class="dlg-top"><h3 id="dlg-title">${isNew ? "Add a person" : "Edit " + esc(p.name)}</h3>${close}</div>
    <label for="f-name">Full name</label><input id="f-name" maxlength="120" value="${esc(p.name)}" autocomplete="off" required>
    <div class="field-error" id="err-name" role="alert"></div>
    <div class="row"><div><label for="f-b">Born (year)</label><input id="f-b" inputmode="numeric" maxlength="4" value="${p.birthYear ?? ""}" autocomplete="off"></div>
    <div><label for="f-d">Passed away (year)</label><input id="f-d" inputmode="numeric" maxlength="4" value="${p.deathYear ?? ""}" autocomplete="off"></div></div>
    <div class="field-error" id="err-years" role="alert"></div>
    <label for="f-place">Birthplace or origin</label><input id="f-place" maxlength="120" value="${esc(p.birthPlace)}" autocomplete="off">
    <label for="f-par">Parent</label><select id="f-par"><option value="">No parent (oldest known ancestor)</option>${options.map((x) => `<option value="${esc(x.id)}" ${x.id === p.parentId ? "selected" : ""}>${esc(x.name)}${years(x) ? " (" + esc(years(x)) + ")" : ""}</option>`).join("")}</select>
    <label for="f-story">Story, traditions and memories</label><textarea id="f-story" rows="6" maxlength="5000">${esc(p.story)}</textarea>
    <div class="hint">Anyone in this tree can read this.</div>
    <div class="field-error" id="err-form" role="alert"></div>
    <div class="actions"><button class="btn" type="submit">Save</button>${isNew ? "" : '<button class="btn danger" type="button" data-delperson>Delete</button>'}<button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
  $("#f-name").focus();
}

async function savePerson(form) {
  const err = (id, text) => { $("#" + id).textContent = text; };
  ["err-name", "err-years", "err-form"].forEach((i) => err(i, ""));
  const name = $("#f-name").value.trim();
  const year = (v) => (v.trim() === "" ? null : /^\d{1,4}$/.test(v.trim()) ? +v.trim() : NaN);
  const b = year($("#f-b").value), d = year($("#f-d").value);
  let bad = false;
  if (!name) { err("err-name", "Enter the person's name."); $("#f-name").setAttribute("aria-invalid", "true"); bad = true; }
  if (Number.isNaN(b) || Number.isNaN(d)) { err("err-years", "Years must be numbers, like 1950."); bad = true; }
  else if ((b !== null && b > 2200) || (d !== null && d > 2200)) { err("err-years", "That year is too far away."); bad = true; }
  else if (b !== null && d !== null && d < b) { err("err-years", "The year they passed away cannot be before they were born."); bad = true; }
  if (bad) return;
  const data = { name, birthYear: b, deathYear: d, birthPlace: $("#f-place").value.trim(), story: $("#f-story").value.trim(), parentId: $("#f-par").value || null };
  const id = form.dataset.id || null;
  const btn = $("[type=submit]", form);
  btn.setAttribute("aria-busy", "true");
  try {
    // Saved to this device straight away; the server confirms when you are online.
    const pending = backend.savePerson(state.cur.id, id, data);
    pending.catch((e) => toast(friendlyError(e)));
    dlg.close(); toast("Saved");
  } catch (e) { err("err-form", friendlyError(e)); btn.removeAttribute("aria-busy"); }
}

function inviteDialog() {
  openDialog(dlg, `<div class="dlg-body"><div class="dlg-top"><h3 id="dlg-title">Invite relatives</h3>${close}</div>
    <p class="mut">Anyone with the link can join once they sign in, with the role you choose.</p>
    <label for="i-role">Role</label><select id="i-role"><option value="editor">Editor: can add and edit people</option><option value="viewer">Viewer: can only read</option></select>
    <div class="field-error" id="i-err" role="alert"></div>
    <div class="actions"><button class="btn" type="button" id="i-mk">Create invite link</button></div>
    <div class="copy-field" id="i-out" hidden><label for="i-link">Your invite link</label><input id="i-link" readonly>
      <div class="row"><button class="btn ghost" type="button" id="i-cp">Copy link</button><button class="btn ghost" type="button" id="i-share" hidden>Share&hellip;</button></div></div></div>`);
}

/* ---------- Events ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$("details.menu[open]").forEach((d) => { d.open = false; });
});
document.addEventListener("click", (e) => {
  $$("details.menu[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
});

root.addEventListener("click", async (e) => {
  const t = e.target;
  const act = t.closest("[data-act]")?.dataset.act;
  const tree = t.closest("[data-tree]");
  const person = t.closest("[data-p]");
  const view = t.closest("[data-view]");
  $$("details.menu[open]", root).forEach((d) => { d.open = false; });
  if (tree) location.hash = "#/t/" + tree.dataset.tree;
  else if (person) personView(person.dataset.p);
  else if (view) { state.view = view.dataset.view; render(); }
  else if (act === "dismiss") { state.notice = ""; state.treeError = ""; render(); }
  else if (act === "back") { /* plain link: hashchange handles it */ }
  else if (act === "add") personForm(null);
  else if (act === "invite") inviteDialog();
  else if (act === "share") {
    const text = `${state.cur.name}\n\n${outline(indexPeople(state.people))}`;
    if (navigator.share) navigator.share({ title: state.cur.name, text }).catch(() => {});
    else toast((await copyText(text)) ? "Outline copied" : "Could not copy");
  } else if (act === "print") window.print();
  else if (act === "backup") {
    const data = { app: "Family Roots", exportedAt: new Date().toISOString(), tree: { name: state.cur.name }, people: state.people.map(({ id, ...rest }) => ({ id, ...rest })) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = state.cur.name.replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() + "-backup.json";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } else if (act === "rename") {
    openDialog(dlg, `<form class="dlg-body" id="rename-form" novalidate><div class="dlg-top"><h3 id="dlg-title">Rename tree</h3>${close}</div><label for="rn">Tree name</label><input id="rn" maxlength="80" value="${esc(state.cur.name)}" required><div class="field-error" id="rn-err" role="alert"></div><div class="actions"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    $("#rn").select();
  } else if (act === "deltree") {
    const name = state.cur.name;
    if (await confirmDialog({ title: `Delete “${name}”?`, body: "This deletes the tree and every person in it, for everyone. It cannot be undone. Download a backup first if you might want it.", yes: "Delete the tree" })) {
      const id = state.cur.id;
      try { location.hash = "#/"; await backend.deleteTree(id); toast("Tree deleted"); } catch (er) { state.notice = "Could not delete the tree: " + friendlyError(er); render(); }
    }
  }
});

document.addEventListener("click", (e) => {
  const act = e.target.closest("#acct [data-act]")?.dataset.act;
  if (act === "signout") backend.logout();
  else if (act === "delacct") accountDelete();
});

async function accountDelete() {
  $("#acct").open = false;
  if (await confirmDialog({ title: "Delete your account?", body: "This permanently deletes your sign-in. Trees you own stay until you delete them, so delete those first if you want them gone.", yes: "Delete my account" })) {
    try { await backend.deleteAccount(); toast("Account deleted"); } catch (er) { state.notice = friendlyError(er); render(); }
  }
}

root.addEventListener("input", (e) => {
  if (e.target.id === "q") {
    state.q = e.target.value; const pos = e.target.selectionStart;
    renderTree(); const q = $("#q"); q.focus(); q.setSelectionRange(pos, pos);
  }
});

root.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "new-tree") {
    const name = $("#tn").value.trim();
    if (!name) { $("#tn-err").textContent = "Give your tree a name."; return; }
    const btn = $("[type=submit]", e.target); btn.setAttribute("aria-busy", "true");
    try { const id = await backend.createTree(name, state.user.uid); location.hash = "#/t/" + id; }
    catch (er) { $("#tn-err").textContent = "Could not create the tree. " + friendlyError(er); btn.removeAttribute("aria-busy"); }
  } else if (e.target.id === "join-form") {
    const code = $("#jc").value.trim().split("join=").pop().replace(/^[#/]+/, "");
    if (!code) { $("#jc-err").textContent = "Paste the invite link or code you were sent."; return; }
    joinWith(code);
  }
});

dlg.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.closest("[data-open]")) personView(t.closest("[data-open]").dataset.open);
  else if (t.closest("[data-edit]")) personForm(t.closest("[data-edit]").dataset.edit);
  else if (t.closest("[data-addchild]")) personForm(null, t.closest("[data-addchild]").dataset.addchild);
  else if (t.closest("[data-delperson]")) {
    const id = $("#person-form").dataset.id;
    const p = state.people.find((x) => x.id === id);
    const kids = state.people.filter((x) => x.parentId === id).length;
    dlg.close();
    if (await confirmDialog({ title: `Delete ${p.name}?`, body: kids ? `${kids} ${kids === 1 ? "child is" : "children are"} listed under this person. They will stay in the tree as top-level entries.` : "This cannot be undone.", yes: "Delete" })) {
      backend.removePerson(state.cur.id, id).then(() => toast("Person deleted")).catch((er) => toast(friendlyError(er)));
    }
  } else if (t.id === "i-mk") {
    const btn = t; btn.setAttribute("aria-busy", "true");
    try {
      const code = await backend.createInvite(state.cur.id, $("#i-role").value, state.user.uid);
      const link = location.origin + location.pathname + "#join=" + code;
      $("#i-out").hidden = false; $("#i-link").value = link; $("#i-link").select();
      if (navigator.share) $("#i-share").hidden = false;
      $("#i-err").textContent = "";
    } catch (er) { $("#i-err").textContent = "Could not create the link. " + friendlyError(er); }
    btn.removeAttribute("aria-busy");
  } else if (t.id === "i-cp") toast((await copyText($("#i-link").value)) ? "Link copied" : "Select the link and copy it by hand");
  else if (t.id === "i-share") navigator.share({ title: "Join our family tree", url: $("#i-link").value }).catch(() => {});
});

dlg.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "person-form") savePerson(e.target);
  else if (e.target.id === "rename-form") {
    const name = $("#rn").value.trim();
    if (!name) { $("#rn-err").textContent = "Give your tree a name."; return; }
    try { await backend.renameTree(state.cur.id, name); dlg.close(); toast("Renamed"); } catch (er) { $("#rn-err").textContent = friendlyError(er); }
  }
});

/* ---------- Sign-in form (static HTML in the landing page) ---------- */
let mode = "in";
const setMode = (m) => {
  mode = m;
  $("#tab-in").setAttribute("aria-selected", String(m === "in"));
  $("#tab-up").setAttribute("aria-selected", String(m === "up"));
  $("#auth-submit").textContent = m === "in" ? "Sign in" : "Create account";
  $("#auth-title").textContent = m === "in" ? "Sign in to begin" : "Create your account";
  $("#pw").autocomplete = m === "in" ? "current-password" : "new-password";
  $("#pw-hint").hidden = m === "in";
  $("#auth-error").textContent = "";
};
$("#tab-in").addEventListener("click", () => setMode("in"));
$("#tab-up").addEventListener("click", () => setMode("up"));

const authError = (text) => { $("#auth-error").textContent = text; };
$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError("");
  const email = $("#em").value.trim(), pw = $("#pw").value;
  $("#em").removeAttribute("aria-invalid"); $("#pw").removeAttribute("aria-invalid");
  if (!/^\S+@\S+\.\S+$/.test(email)) { $("#em").setAttribute("aria-invalid", "true"); authError("Enter your email address."); $("#em").focus(); return; }
  if (!pw) { $("#pw").setAttribute("aria-invalid", "true"); authError("Enter your password."); $("#pw").focus(); return; }
  if (mode === "up" && pw.length < 6) { $("#pw").setAttribute("aria-invalid", "true"); authError("Choose a password with at least 6 characters."); $("#pw").focus(); return; }
  const btn = $("#auth-submit"); btn.setAttribute("aria-busy", "true");
  try { await (mode === "in" ? backend.signIn(email, pw) : backend.signUp(email, pw)); if (mode === "up") toast("Welcome! We sent you an email to confirm your address."); }
  catch (er) { authError(friendlyError(er)); }
  btn.removeAttribute("aria-busy");
});
$("#google").addEventListener("click", async () => {
  authError("");
  const btn = $("#google"); btn.setAttribute("aria-busy", "true");
  try { await backend.google(); } catch (er) { authError(friendlyError(er)); }
  btn.removeAttribute("aria-busy");
});
$("#forgot").addEventListener("click", async () => {
  const email = $("#em").value.trim();
  if (!email) { authError("Type your email above first, then tap this again."); $("#em").focus(); return; }
  try { await backend.reset(email); authError(""); toast("If that email has an account, a reset link is on its way."); } catch (er) { authError(friendlyError(er)); }
});

start();
