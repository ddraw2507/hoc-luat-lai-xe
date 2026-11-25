// Service worker: precache app shell + 3 file JSON + mọi ảnh liệt kê trong questions.json (đọc lúc install).
// Đổi CACHE_VERSION mỗi khi thay code hoặc dữ liệu để máy người dùng tải bản mới.
const CACHE_VERSION = 'v4';
const CACHE = 'hlx-' + CACHE_VERSION;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/main.js',
  'js/router.js',
  'js/store.js',
  'js/data.js',
  'js/util.js',
  'js/exam.js',
  'js/tts.js',
  'js/views/home.js',
  'js/views/learn.js',
  'js/views/question.js',
  'js/views/review.js',
  'js/views/exam-view.js',
  'js/views/stats.js',
  'js/views/settings.js',
  'data/questions.json',
  'data/lessons.json',
  'data/exam.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // questions.json lấy mới từ mạng để danh sách ảnh luôn đúng với bản này
    const res = await fetch('data/questions.json', { cache: 'reload' });
    const qs = await res.clone().json();
    await cache.put('data/questions.json', res);
    const images = new Set();
    for (const q of qs.questions) if (q.image) images.add('data/' + q.image);
    const list = SHELL.filter((p) => p !== 'data/questions.json').concat([...images]);
    await cache.addAll(list.map((p) => new Request(p, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('hlx-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') {
        const shell = await caches.match('index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
