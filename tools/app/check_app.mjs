// Kiểm tra app: định dạng JSON, ảnh tham chiếu, file precache, không có đường dẫn tuyệt đối.
// Chạy: node tools/app/check_app.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');
const errors = [];
const err = (m) => errors.push(m);
const rd = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(APP, p));
const json = (p) => { try { return JSON.parse(rd(p)); } catch (e) { err(`${p}: JSON hỏng (${e.message})`); return null; } };

// --- questions.json ---
const q = json('data/questions.json');
if (q) {
  if (typeof q.source !== 'string') err('questions: thiếu source');
  const chapIds = new Set();
  if (!Array.isArray(q.chapters) || !q.chapters.length) err('questions: thiếu chapters');
  else for (const c of q.chapters) { if (!Number.isInteger(c.id) || !c.name) err('chapter sai: ' + JSON.stringify(c)); chapIds.add(c.id); }
  const ids = new Set();
  if (!Array.isArray(q.questions) || !q.questions.length) err('questions: mảng rỗng');
  else for (const x of q.questions) {
    const w = `câu ${x.id}`;
    if (!Number.isInteger(x.id) || ids.has(x.id)) err(`${w}: id sai/trùng`);
    ids.add(x.id);
    if (!chapIds.has(x.chapter)) err(`${w}: chapter ${x.chapter} không tồn tại`);
    if (typeof x.text !== 'string' || !x.text) err(`${w}: thiếu text`);
    if (!Array.isArray(x.options) || x.options.length < 2 || x.options.length > 4 || x.options.some((o) => typeof o !== 'string' || !o)) err(`${w}: options phải 2–4 chuỗi`);
    else if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= x.options.length) err(`${w}: answer ngoài khoảng`);
    if (typeof x.critical !== 'boolean') err(`${w}: critical phải là boolean`);
    if (x.image !== null && typeof x.image !== 'string') err(`${w}: image phải là chuỗi hoặc null`);
    else if (x.image) {
      if (x.image.startsWith('/') || /^[a-z]+:/i.test(x.image)) err(`${w}: image phải là đường dẫn tương đối`);
      else if (!exists('data/' + x.image)) err(`${w}: ảnh không tồn tại: data/${x.image}`);
    }
  }
}

// --- lessons.json ---
const l = json('data/lessons.json');
if (l) {
  const lids = new Set();
  if (!Array.isArray(l.parts)) err('lessons: thiếu parts');
  else for (const p of l.parts) {
    if (!p.id || !p.title || !Array.isArray(p.groups)) { err('part sai: ' + p.id); continue; }
    for (const g of p.groups) {
      if (!g.title || !Array.isArray(g.lessons)) { err('group sai: ' + g.title); continue; }
      for (const ls of g.lessons) {
        if (!ls.id || !ls.num || !ls.title) err('bài sai: ' + JSON.stringify(ls).slice(0, 80));
        if (lids.has(ls.id)) err('trùng id bài: ' + ls.id);
        lids.add(ls.id);
        if (!('html' in ls) || (ls.html !== null && typeof ls.html !== 'string')) err(`bài ${ls.id}: html phải là chuỗi hoặc null`);
        if (typeof ls.html === 'string') {
          for (const m of ls.html.matchAll(/<img[^>]*\ssrc="([^"]*)"/gi)) {
            if (m[1].startsWith('/') || /^[a-z]+:/i.test(m[1])) err(`bài ${ls.id}: img src tuyệt đối ${m[1]}`);
            else if (!exists('data/' + m[1])) err(`bài ${ls.id}: ảnh không tồn tại ${m[1]}`);
          }
        }
      }
    }
  }
}

// --- exam.json ---
const e = json('data/exam.json');
if (e) {
  if (!Array.isArray(e.structures) || !e.structures.length) err('exam: thiếu structures');
  else {
    const sids = new Set();
    for (const s of e.structures) {
      sids.add(s.id);
      for (const k of ['count', 'minutes', 'passScore', 'criticalCount']) if (!Number.isInteger(s[k]) || s[k] < 0) err(`exam ${s.id}: ${k} sai`);
      if (!s.label) err(`exam ${s.id}: thiếu label`);
      if (s.passScore > s.count) err(`exam ${s.id}: passScore > count`);
      if (s.perChapter !== null && (typeof s.perChapter !== 'object')) err(`exam ${s.id}: perChapter sai`);
    }
    if (!sids.has(e.default)) err('exam: default không khớp structure nào');
  }
}

// --- precache (đọc SHELL từ sw.js) + ảnh từ questions.json ---
const sw = rd('sw.js');
const shellMatch = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!shellMatch) err('sw.js: không tìm thấy SHELL');
else {
  const shell = [...shellMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const p of shell) {
    if (p === './') continue;
    if (p.startsWith('/')) err(`sw.js SHELL: đường dẫn tuyệt đối ${p}`);
    else if (!exists(p)) err(`sw.js SHELL: file không tồn tại ${p}`);
  }
  // mọi file js/css/html/icon trong app phải nằm trong SHELL
  const walk = (d) => fs.readdirSync(path.join(APP, d), { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? walk(path.posix.join(d, f.name)) : [path.posix.join(d, f.name)]);
  for (const f of ['js', 'css', 'icons'].flatMap((d) => walk(d))) {
    if (!shell.includes(f)) err(`sw.js SHELL thiếu file: ${f}`);
  }
  if (!sw.includes("'data/questions.json'") || !sw.includes('q.image')) err('sw.js: phải dựng danh sách ảnh từ questions.json');
  var shellCount = shell.length;
}

// --- đường dẫn tuyệt đối trong HTML/JS/CSS/manifest ---
const files = [];
const scan = (d) => { for (const f of fs.readdirSync(path.join(APP, d), { withFileTypes: true })) {
  const rel = path.posix.join(d, f.name);
  if (f.isDirectory()) { if (f.name !== 'img') scan(rel); } else if (/\.(html|js|css|webmanifest)$/.test(f.name)) files.push(rel);
} };
scan('.');
for (const f of files) {
  const src = rd(f);
  const attr = src.matchAll(/\b(?:src|href|start_url|scope)\s*[=:]\s*["'](\/[^"'\/][^"']*|\/)["']/g);
  for (const m of attr) err(`${f}: đường dẫn tuyệt đối ${m[1]}`);
  for (const m of src.matchAll(/(?:fetch|register|import)\(\s*['"`](\/[^'"`]*)['"`]/g)) err(`${f}: đường dẫn tuyệt đối ${m[1]}`);
  for (const m of src.matchAll(/url\(\s*['"]?(\/[^)'"]*)/g)) err(`${f}: url() tuyệt đối ${m[1]}`);
  for (const m of src.matchAll(/(?:from|import)\s+['"](\/[^'"]*)['"]/g)) err(`${f}: import tuyệt đối ${m[1]}`);
  if (/https?:\/\/(?!www\.w3\.org)/.test(src.replace(/\/\/.*$/gm, '')) && f !== 'sw.js') err(`${f}: có URL ngoài`);
}

// --- manifest ---
const mf = json('manifest.webmanifest');
if (mf) {
  if (mf.start_url !== './' || mf.scope !== './') err('manifest: start_url/scope phải là ./');
  if (mf.display !== 'standalone') err('manifest: display phải là standalone');
  for (const i of mf.icons || []) if (!exists(i.src)) err('manifest: thiếu icon ' + i.src);
  const sizes = (mf.icons || []).map((i) => i.sizes);
  if (!sizes.includes('192x192') || !sizes.includes('512x512')) err('manifest: thiếu icon 192/512');
}
if (!exists('icons/apple-touch-icon.png')) err('thiếu apple-touch-icon.png');

if (errors.length) { console.error('LỖI (' + errors.length + '):\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`OK: ${q.questions.length} câu, ${q.questions.filter((x) => x.image).length} ảnh, ${shellCount} file shell, ${files.length} file đã quét đường dẫn.`);
