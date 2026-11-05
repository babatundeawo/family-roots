// Family Roots build script. Runs inside GitHub Actions on every deploy. You never run it yourself.
//
// What it does:
//   1. Turns design/palette.json into colour tokens (light and dark) and checks WCAG contrast.
//   2. Bundles the app (src/app) and the styles (src/styles) with esbuild into hashed files.
//   3. Fills in your Firebase settings from the GitHub secrets (these are public identifiers, not passwords).
//   4. Writes index.html, 404.html, offline.html, manifest.webmanifest, robots.txt and sw.js into dist/.
//   5. Checks every link, file, icon, the manifest and the offline file list. It stops with a plain
//      message if something that would break the site is wrong.
//
// Set MOCK=1 to build a copy that runs on fake in-memory data. It is only used for testing the screens
// and is refused when building for deploy (CI sets DEPLOY=1).

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildTokens } from "./lib/tokens.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");
const TMP = path.join(ROOT, ".build");
const MOCK = process.env.MOCK === "1";
const problems = [];
const warnings = [];
const read = (f) => fs.readFile(path.join(ROOT, f), "utf8");
const exists = async (f) => !!(await fs.stat(f).catch(() => null));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- 1. Settings ---------- */
const site = JSON.parse(await read("design/site.json"));
const palette = JSON.parse(await read("design/palette.json"));

if (MOCK && process.env.DEPLOY === "1") {
  console.error("::error::MOCK=1 builds use fake data and must never be deployed.");
  process.exit(1);
}
const config = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};
if (!MOCK) {
  const missing = Object.entries({ FIREBASE_API_KEY: config.apiKey, FIREBASE_AUTH_DOMAIN: config.authDomain, FIREBASE_PROJECT_ID: config.projectId, FIREBASE_APP_ID: config.appId })
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`::error::Missing GitHub secret(s): ${missing.join(", ")}.`);
    console.error(`\nBuild stopped. Open docs/FIREBASE_SETUP.md, follow "Step 4: Add the secrets to GitHub", then re-run the workflow.`);
    process.exit(1);
  }
}

/* ---------- 2. Colour tokens ---------- */
const tokens = buildTokens(palette);
for (const f of tokens.failures) warnings.push(`design/palette.json: ${f.label}: ${f.pair} has a contrast ratio of ${f.ratio.toFixed(2)} (needs 4.5). Make that colour darker or lighter.`);
await fs.mkdir(TMP, { recursive: true });
await fs.writeFile(path.join(TMP, "tokens.css"), tokens.css);

/* ---------- 3. Bundle ---------- */
await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(path.join(DIST, "assets"), { recursive: true });

const result = await build({
  entryPoints: { app: path.join(ROOT, "src/app/main.js"), site: path.join(ROOT, "src/styles/main.css") },
  outdir: path.join(DIST, "assets"),
  bundle: true,
  splitting: true,
  format: "esm",
  target: ["es2022", "chrome110", "safari16", "firefox110"],
  minify: true,
  sourcemap: false,
  metafile: true,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  assetNames: "[name]-[hash]",
  loader: { ".woff2": "file" },
  legalComments: "none",
  define: {
    __MOCK__: MOCK ? "true" : "false",
    __FIREBASE_CONFIG__: JSON.stringify(config),
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  logLevel: "warning",
});

const outputs = Object.keys(result.metafile.outputs).map((o) => path.relative(DIST, path.resolve(ROOT, o)));
const jsOut = outputs.filter((o) => o.endsWith(".js"));
const entryOf = (name) => outputs.find((o) => path.basename(o).startsWith(name + "-") && (o.endsWith(".js") || o.endsWith(".css")) && !path.basename(o).startsWith("chunk"));
const appJs = jsOut.find((o) => path.basename(o).startsWith("app-"));
const siteCss = outputs.find((o) => path.basename(o).startsWith("site-") && o.endsWith(".css"));
const fonts = outputs.filter((o) => o.endsWith(".woff2"));
if (!appJs || !siteCss) { console.error("::error::The bundle did not produce app and site files."); process.exit(1); }
void entryOf;

/* ---------- 4. Static files and pages ---------- */
async function copyDir(src, dest) {
  if (!(await exists(src))) return;
  await fs.mkdir(dest, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(from, to);
    else await fs.copyFile(from, to);
  }
}
await copyDir(path.join(ROOT, "public"), DIST);
await fs.copyFile(path.join(ROOT, "src/theme-init.js"), path.join(DIST, "assets/theme-init.js"));

const write = (rel, content) => fs.mkdir(path.dirname(path.join(DIST, rel)), { recursive: true }).then(() => fs.writeFile(path.join(DIST, rel), content));
const shell = await read("scripts/templates/shell.html");
const preload = fonts
  .filter((f) => /(inter|fraunces).*latin-wght-normal/.test(f) && !/ext/.test(f))
  .map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join("\n");

function page({ title, description, body, robots = "index,follow" }) {
  const filled = shell
    .replace("{{title}}", esc(title)).replace("{{description}}", esc(description)).replace("{{robots}}", robots)
    .replace("{{themeLight}}", palette.light.bg).replace("{{themeDark}}", tokens.dark.bg)
    .replace("{{preload}}", preload).replace("{{css}}", siteCss)
    .replace("{{body}}", body);
  return filled;
}

let indexBody = await read("src/index.html");
indexBody = indexBody.replace("{{js}}", appJs).replace(/\{\{year\}\}/g, String(new Date().getFullYear()));
await write("index.html", page({ title: site.title, description: site.description, body: indexBody }));
await write("offline.html", page({ title: `You are offline - ${site.name}`, description: "You are offline.", body: await read("scripts/templates/offline.html"), robots: "noindex" }));
await write("404.html", page({ title: `Page not found - ${site.name}`, description: "This page does not exist.", body: await read("scripts/templates/404.html"), robots: "noindex" }));
await write("robots.txt", "User-agent: *\nAllow: /\n");

const manifest = {
  id: "./",
  name: site.name,
  short_name: site.shortName,
  description: site.description,
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait-primary",
  background_color: palette.light.bg,
  theme_color: palette.light.primary,
  lang: "en",
  categories: ["lifestyle", "social"],
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
if (await exists(path.join(DIST, "icons/screenshot-wide.png"))) manifest.screenshots = [
  { src: "icons/screenshot-wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "A family tree with the stories behind each person" },
  { src: "icons/screenshot-narrow.png", sizes: "750x1334", type: "image/png", form_factor: "narrow", label: "The same family tree on a phone" },
];
await write("manifest.webmanifest", JSON.stringify(manifest, null, 2));

/* ---------- 5. Service worker ---------- */
async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out.sort();
}
const PRECACHE = [
  "./", "offline.html", "manifest.webmanifest", "favicon.svg", "icons/icon-192.png", "assets/theme-init.js",
  siteCss, appJs, ...fonts.filter((f) => /latin-wght-normal/.test(f)),
  ...jsOut.filter((o) => o !== appJs),
];
const hash = createHash("sha1");
for (const f of await walk(DIST)) {
  const rel = path.relative(DIST, f);
  if (rel === "sw.js") continue;
  hash.update(rel).update(await fs.readFile(f));
}
const VERSION = hash.digest("hex").slice(0, 10);
await write("sw.js", (await read("scripts/templates/sw.js")).replace("__VERSION__", VERSION).replace("__PRECACHE__", JSON.stringify([...new Set(PRECACHE)])));

/* ---------- 6. Checks ---------- */
const htmlFiles = (await walk(DIST)).filter((f) => f.endsWith(".html"));
const ids = new Map();
for (const f of htmlFiles) ids.set(f, new Set([...(await fs.readFile(f, "utf8")).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

for (const f of htmlFiles) {
  const rel = path.relative(DIST, f);
  const html = await fs.readFile(f, "utf8");
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(ref)) continue;
    const [p, frag] = ref.split("#");
    let target = !p ? f : p.startsWith("/") ? path.join(DIST, p) : path.resolve(path.dirname(f), p);
    if ((await fs.stat(target).catch(() => null))?.isDirectory()) target = path.join(target, "index.html");
    if (!(await exists(target))) { problems.push(`${rel}: "${ref}" points to a file that does not exist.`); continue; }
    if (frag && target.endsWith(".html") && !ids.get(target)?.has(frag)) problems.push(`${rel}: "${ref}" points to a section (#${frag}) that does not exist.`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) warnings.push(`${rel}: missing <title>.`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) warnings.push(`${rel}: should have exactly one <h1>.`);
  if (/<img(?![^>]*\balt=)[^>]*>/.test(html)) warnings.push(`${rel}: an <img> has no alt text.`);
  if (/\sstyle="/.test(html)) problems.push(`${rel}: has an inline style attribute, which the Content Security Policy blocks.`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) problems.push(`${rel}: has an inline script, which the Content Security Policy blocks.`);
  if (/\son(?:click|load|error|submit)="/i.test(html)) problems.push(`${rel}: has an inline event handler, which the Content Security Policy blocks.`);
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) warnings.push(`${rel}: an external link is missing rel="noopener noreferrer".`);
}

for (const key of ["name", "short_name", "description", "id", "start_url", "scope", "display", "theme_color", "background_color", "icons"]) {
  if (manifest[key] === undefined) problems.push(`manifest.webmanifest: "${key}" is missing.`);
}
const iconKinds = manifest.icons.map((i) => i.sizes + ":" + i.purpose);
for (const need of ["192x192:any", "512x512:any", "512x512:maskable"]) if (!iconKinds.includes(need)) problems.push(`manifest.webmanifest: needs an icon of ${need}.`);
for (const item of [...manifest.icons, ...(manifest.screenshots || [])]) if (!(await exists(path.join(DIST, item.src)))) problems.push(`manifest.webmanifest: "${item.src}" does not exist.`);
for (const f of ["favicon.svg", "favicon.ico", "icons/apple-touch-icon.png"]) if (!(await exists(path.join(DIST, f)))) problems.push(`${f} is missing from public/.`);
for (const item of PRECACHE) if (!(await exists(path.join(DIST, item === "./" ? "index.html" : item)))) problems.push(`sw.js: "${item}" is in the offline file list but does not exist.`);

// The Firebase settings must have made it into the bundle (and a mock build must not carry real ones).
const bundle = (await Promise.all(jsOut.map((o) => fs.readFile(path.join(DIST, o), "utf8")))).join("\n");
if (!MOCK && !bundle.includes(config.projectId)) problems.push("The Firebase settings were not found in the built app.");
if (MOCK && bundle.includes("firebaseio.com")) warnings.push("The mock build still contains the Firebase client.");

for (const w of warnings) console.log(`::warning::${w}`);
if (problems.length) {
  for (const p of problems) console.log(`::error::${p}`);
  console.error(`\nBuild stopped: ${problems.length} problem(s) found. Fix the lines above and commit again.`);
  process.exit(1);
}
const kb = (await Promise.all(jsOut.map(async (o) => (await fs.stat(path.join(DIST, o))).size))).reduce((a, b) => a + b, 0) / 1024;
console.log(`Build complete${MOCK ? " (MOCK data build, not for deploy)" : ""}: ${htmlFiles.length} pages, ${jsOut.length} script files (${kb.toFixed(0)} KB total), ${warnings.length} warning(s), offline version ${VERSION}.`);
