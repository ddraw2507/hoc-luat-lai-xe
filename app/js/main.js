import { route, start } from './router.js';
import { toast } from './util.js';
import { home } from './views/home.js';
import { learnList, lesson } from './views/learn.js';
import { reviewMenu, reviewRun } from './views/review.js';
import { examMenu, examRun, examResult } from './views/exam-view.js';
import { stats } from './views/stats.js';
import { settings, applyFont } from './views/settings.js';

applyFont();

route('/', home, 'home');
route('/hoc', learnList, 'hoc');
route('/hoc/:id', lesson, 'hoc');
route('/on', reviewMenu, 'on');
route('/on/:mode', reviewRun, 'on');
route('/thi', examMenu, 'thi');
route('/thi/lam', examRun, 'thi');
route('/thi/ket-qua', examResult, 'thi');
route('/thong-ke', stats, 'tk');
route('/cai-dat', settings, '');

document.addEventListener('routechange', (e) => {
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === e.detail.tab);
  });
});

start(document.getElementById('view'));

// Service worker + thông báo bản mới
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const notify = (worker) => toast('Đã có bản mới — chạm để tải lại', () => worker.postMessage('SKIP_WAITING'));
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w);
      });
    });
  }).catch(() => { /* chạy được không cần SW */ });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
