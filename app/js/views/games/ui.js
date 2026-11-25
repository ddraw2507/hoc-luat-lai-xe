// Phần giao diện dùng chung của các trò chơi.
import { h } from '../../util.js';
import { questionCard } from '../question.js';

export const secText = (ms) => (Math.max(0, ms) / 1000).toFixed(1);

/** Hàng đầu màn chơi: nút về trang Chơi + tiêu đề. */
export function gameTop(title, extra) {
  return h('div', { class: 'toprow' },
    h('a', { class: 'btn small', href: '#/choi', 'aria-label': 'Về trang Chơi' }, '‹ Chơi'),
    h('b', {}, title), h('span', { class: 'grow' }), extra || null);
}

/** Thanh tiến độ nhỏ, width là %. */
export function bar(pct, cls = '') {
  return h('div', { class: 'progress ' + cls }, h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));
}

/** Thẻ tóm tắt cuối ván. */
export function summary(title, big, lines, isRecord) {
  return h('div', { class: 'card center' },
    h('div', { class: 'sub' }, title),
    h('div', { class: 'big' }, big),
    isRecord ? h('div', { class: 'recordtag' }, '🏅 Kỷ lục mới!') : null,
    ...lines.map((l) => h('div', { class: 'sub' }, l)));
}

/** Danh sách câu đã sai để xem lại. entries: [{ q, picked }] (picked undefined = hết giờ). */
export function wrongList(entries) {
  if (!entries.length) return null;
  return h('div', {},
    h('h2', {}, `Câu đã sai (${entries.length})`),
    ...entries.map(({ q, picked }, i) => questionCard(q, { number: i + 1, picked, reveal: true })));
}

/** Gói interval/rAF/timeout của một màn để dọn một lần khi rời route. */
export function makeTimers() {
  const ints = new Set();
  const touts = new Set();
  let raf = 0;
  return {
    interval(fn, ms) { const id = setInterval(fn, ms); ints.add(id); return id; },
    timeout(fn, ms) { const id = setTimeout(() => { touts.delete(id); fn(); }, ms); touts.add(id); return id; },
    clearTimeout(id) { clearTimeout(id); touts.delete(id); },
    clearInterval(id) { clearInterval(id); ints.delete(id); },
    frame(fn) { cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); },
    clear() { ints.forEach(clearInterval); touts.forEach(clearTimeout); ints.clear(); touts.clear(); cancelAnimationFrame(raf); },
  };
}
