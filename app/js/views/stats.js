import { h, pct, fmtDate } from '../util.js';
import { loadData } from '../data.js';
import * as store from '../store.js';

export async function stats(el) {
  const data = await loadData();
  const s = store.get();
  const lessons = data.lessons.filter((l) => l.html);
  const learned = lessons.filter((l) => s.learned[l.id]).length;

  el.append(h('h1', {}, 'Thống kê'),
    h('div', { class: 'card' }, h('b', {}, 'Bài đã học: '), `${learned}/${lessons.length}`),
    h('h2', {}, 'Tỷ lệ đúng theo chương'));
  for (const c of data.chapters) {
    const qs = data.questions.filter((q) => q.chapter === c.id);
    let right = 0, wrong = 0;
    for (const q of qs) { const st = s.stats[q.id]; if (st) { right += st.right; wrong += st.wrong; } }
    const p = pct(right, right + wrong);
    el.append(h('div', { class: 'card' },
      h('div', { class: 'barlabel' }, h('span', {}, `Chương ${c.id}. ${c.name}`), h('b', {}, right + wrong ? p + '%' : '—')),
      h('div', { class: 'bar' }, h('i', { style: `width:${p}%` })),
      h('div', { class: 'sub' }, `${right} đúng · ${wrong} sai · ${qs.length} câu`)));
  }
  el.append(h('h2', {}, 'Lịch sử thi thử'));
  if (!s.history.length) el.append(h('div', { class: 'card empty' }, 'Chưa có lần thi nào.'));
  for (const r of s.history) {
    el.append(h('div', { class: 'card hist' },
      h('div', {}, h('b', {}, `${r.score}/${r.total}`), ' ', h('span', { class: 'sub' }, r.label)),
      h('div', { class: 'sub' }, fmtDate(r.ts)),
      h('span', { class: 'badge ' + (r.passed ? 'ok' : 'crit') }, r.passed ? 'Đạt' : 'Không đạt')));
  }
}
