// Tự kiểm HTTP: node tools/app/smoke_server.mjs [port]   (cần `python -m http.server 8765 -d app` đang chạy)
const port = process.argv[2] || '8765';
const base = `http://127.0.0.1:${port}/`;
const paths = ['index.html', 'manifest.webmanifest', 'sw.js', 'data/questions.json', 'data/lessons.json', 'data/exam.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'css/app.css', 'js/main.js'];
const q = await (await fetch(base + 'data/questions.json')).json();
const img = q.questions.find((x) => x.image);
if (img) paths.push('data/' + img.image);
let bad = 0;
for (const p of paths) {
  const r = await fetch(base + p);
  await r.arrayBuffer();
  console.log(r.status, p);
  if (r.status !== 200) bad++;
}
process.exit(bad ? 1 : 0);
