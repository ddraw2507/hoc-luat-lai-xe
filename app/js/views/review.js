// Ôn tập: menu chế độ + màn làm từng câu.
import { h, pct, sheet } from '../util.js';
import { loadData } from '../data.js';
import * as store from '../store.js';
import { go } from '../router.js';
import { questionCard, gridButtons } from './question.js';
import { recordAnswer } from '../games/progress.js';

function modeIds(data, mode) {
  const s = store.get();
  const qs = data.questions;
  if (mode.startsWith('ch-')) return qs.filter((q) => String(q.chapter) === mode.slice(3)).map((q) => q.id);
  switch (mode) {
    case 'critical': return qs.filter((q) => q.critical).map((q) => q.id);
    case 'wrong': return qs.filter((q) => s.stats[q.id] && s.stats[q.id].last === 'wrong').map((q) => q.id);
    case 'starred': return qs.filter((q) => s.stars[q.id]).map((q) => q.id);
    case 'new': return qs.filter((q) => !s.stats[q.id]).map((q) => q.id);
    case 'all': return qs.map((q) => q.id);
    default: return [];
  }
}

function modeTitle(data, mode) {
  if (mode.startsWith('ch-')) {
    const c = data.chapters.find((x) => String(x.id) === mode.slice(3));
    return c ? `Chương ${c.id}` : 'Chương';
  }
  return { critical: 'Câu điểm liệt', wrong: 'Câu đang sai', starred: 'Câu đã đánh dấu sao', new: 'Câu chưa làm', all: 'Toàn bộ câu hỏi' }[mode] || 'Ôn tập';
}

export async function reviewMenu(el) {
  const data = await loadData();
  const s = store.get();
  const row = (href, title, sub) => h('a', { class: 'card link', href },
    h('div', {}, h('b', {}, title), sub ? h('div', { class: 'sub' }, sub) : null), h('span', { class: 'chev' }, '›'));
  const nCrit = data.questions.filter((q) => q.critical).length;
  const nWrong = modeIds(data, 'wrong').length;
  const nStar = modeIds(data, 'starred').length;
  const nNew = modeIds(data, 'new').length;
  el.append(h('h1', {}, 'Ôn tập'),
    h('h2', {}, 'Theo chương'),
    ...data.chapters.map((c) => {
      const qs = data.questions.filter((q) => q.chapter === c.id);
      const done = qs.filter((q) => s.stats[q.id]);
      const right = qs.filter((q) => s.stats[q.id] && s.stats[q.id].last === 'right').length;
      return row('#/on/ch-' + c.id, `Chương ${c.id}. ${c.name}`,
        `${qs.length} câu · đã làm ${done.length} · đúng ${pct(right, done.length)}%`);
    }),
    h('h2', {}, 'Chế độ khác'),
    row('#/on/critical', `${nCrit} câu điểm liệt`, 'Sai một câu là trượt — ôn kỹ'),
    row('#/on/wrong', 'Câu đang sai', `${nWrong} câu`),
    row('#/on/starred', 'Câu đã đánh dấu sao', `${nStar} câu`),
    row('#/on/new', 'Câu chưa làm', `${nNew} câu`),
    row('#/on/all', `Toàn bộ ${data.questions.length} câu`, 'Theo thứ tự bộ đề'));
}

// Phiên ôn tập hiện tại (giữ trong bộ nhớ khi chuyển màn trong cùng chế độ)
let sess = null;

export async function reviewRun(el, { mode }) {
  const data = await loadData();
  if (!sess || sess.mode !== mode) sess = { mode, ids: modeIds(data, mode), idx: 0, answered: {}, finished: false };
  const S = sess;
  const title = modeTitle(data, mode);

  if (!S.ids.length) {
    el.append(h('h1', {}, title), h('div', { class: 'card empty' }, 'Chưa có câu nào trong mục này.'),
      h('a', { class: 'btn', href: '#/on' }, 'Về Ôn tập'));
    sess = null;
    return;
  }

  const draw = () => {
    el.replaceChildren();
    if (S.finished) return drawFinish();
    const q = data.byId.get(S.ids[S.idx]);
    const st = store.get();
    const answered = S.answered[q.id] !== undefined;
    const chap = data.chapters.find((c) => c.id === q.chapter);

    const prog = h('div', { class: 'progress', role: 'progressbar' }, h('i', { style: `width:${pct(S.idx + 1, S.ids.length)}%` }));
    const starBtn = h('button', { class: 'btn icon', 'aria-label': 'Đánh dấu sao', onclick: () => {
      store.update((s) => { if (s.stars[q.id]) delete s.stars[q.id]; else s.stars[q.id] = true; });
      draw();
    } }, st.stars[q.id] ? '★' : '☆');
    const gridBtn = h('button', { class: 'btn small', onclick: () => {
      const states = S.ids.map((id) => (S.answered[id] === undefined ? '' : S.answered[id] === data.byId.get(id).answer ? 'right' : 'wrong'));
      let close;
      const g = gridButtons(S.ids.length, states, S.idx, (i) => { close(); S.idx = i; draw(); });
      close = sheet('Chọn câu', g);
    } }, `${S.idx + 1}/${S.ids.length} ▾`);

    el.append(h('div', { class: 'toprow' }, h('b', {}, title), h('span', { class: 'grow' }), gridBtn, starBtn), prog);
    el.append(questionCard(q, {
      number: S.idx + 1, chapterName: chap ? `Chương ${chap.id}` : '',
      picked: S.answered[q.id], reveal: answered,
      onPick: (i) => {
        if (S.answered[q.id] !== undefined) return;
        S.answered[q.id] = i;
        recordAnswer(q.id, i === q.answer, i === q.answer ? 2 : 0);
        draw();
        window.scrollTo(0, document.body.scrollHeight);
      } }));
    const last = S.idx === S.ids.length - 1;
    el.append(h('div', { class: 'row sticky-actions' },
      h('button', { class: 'btn', disabled: S.idx === 0 ? true : null, onclick: () => { S.idx--; draw(); } }, '‹ Câu trước'),
      h('button', { class: 'btn primary', disabled: answered ? null : true, onclick: () => {
        if (last) S.finished = true; else S.idx++;
        draw();
        window.scrollTo(0, 0);
      } }, last ? 'Hoàn thành' : 'Câu tiếp ›')));
  };

  const drawFinish = () => {
    const total = S.ids.length;
    const right = S.ids.filter((id) => S.answered[id] === data.byId.get(id).answer).length;
    const done = S.ids.filter((id) => S.answered[id] !== undefined).length;
    el.append(h('h1', {}, title), h('div', { class: 'card center' },
      h('div', { class: 'big' }, `${right}/${done}`), h('div', {}, `câu đúng trong ${done} câu đã làm (tổng ${total} câu)`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { sess = null; go('/on'); } }, 'Về Ôn tập'),
        h('button', { class: 'btn primary', onclick: () => { sess = null; el.replaceChildren(); reviewRun(el, { mode }); } }, 'Làm lại')));
  };

  draw();
}
