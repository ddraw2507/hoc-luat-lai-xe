// Thi thử: chọn cấu trúc, làm bài có đồng hồ, kết quả.
import { h, fmtDate, confirmBox, sheet } from '../util.js';
import { loadData, currentStructure } from '../data.js';
import * as store from '../store.js';
import { go } from '../router.js';
import { generateExam, gradeExam } from '../exam.js';
import { questionCard, gridButtons } from './question.js';

const rule = (s) => `${s.count} câu · ${s.minutes} phút · đúng ≥ ${s.passScore} · ${s.criticalCount ? 'không sai câu điểm liệt' : 'không có câu điểm liệt'}`;

export async function examMenu(el) {
  const data = await loadData();
  const st = store.get();
  const cur = currentStructure(data, st.settings);
  let chosen = cur.id;

  el.append(h('h1', {}, 'Thi thử'));
  if (st.exam) {
    const left = Math.max(0, Math.round((st.exam.endAt - Date.now()) / 60000));
    el.append(h('div', { class: 'card warn' },
      h('b', {}, 'Bạn có bài thi đang làm dở'),
      h('div', { class: 'sub' }, `Còn khoảng ${left} phút.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: async () => {
          if (await confirmBox('Huỷ bài thi đang làm dở? Kết quả sẽ không được lưu.', 'Huỷ bài thi', 'Giữ lại')) {
            store.update((s) => { s.exam = null; });
            el.replaceChildren(); examMenu(el);
          }
        } }, 'Huỷ bài'),
        h('a', { class: 'btn primary', href: '#/thi/lam' }, 'Tiếp tục'))));
  }

  const list = h('div', {});
  const drawList = () => {
    list.replaceChildren(...data.exam.structures.map((s) => h('button', {
      class: 'card choice' + (s.id === chosen ? ' on' : ''), type: 'button',
      onclick: () => { chosen = s.id; drawList(); } },
      h('b', {}, s.label), h('div', { class: 'sub' }, rule(s)), s.note ? h('div', { class: 'sub' }, s.note) : null)));
  };
  drawList();
  el.append(h('h2', {}, 'Chọn cấu trúc đề'), list,
    h('button', { class: 'btn primary block', onclick: () => {
      const s = data.exam.structures.find((x) => x.id === chosen);
      const qs = generateExam(data.questions, s);
      if (!qs.length) return;
      store.update((x) => {
        x.exam = { structId: s.id, ids: qs.map((q) => q.id), answers: {}, startAt: Date.now(), endAt: Date.now() + s.minutes * 60000, idx: 0 };
      });
      go('/thi/lam');
    } }, 'Bắt đầu thi'));

  if (st.lastResult) el.append(h('a', { class: 'card link', href: '#/thi/ket-qua' }, h('div', {}, h('b', {}, 'Xem kết quả lần thi gần nhất'),
    h('div', { class: 'sub' }, fmtDate(st.lastResult.ts))), h('span', { class: 'chev' }, '›')));
}

function fmtClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export async function examRun(el) {
  const data = await loadData();
  const ex = store.get().exam;
  if (!ex) { go('/thi'); return; }
  const struct = data.exam.structures.find((s) => s.id === ex.structId) || data.exam.structures[0];
  const qs = ex.ids.map((id) => data.byId.get(id)).filter(Boolean);
  let timer = null;
  let submitted = false;

  const submit = () => {
    if (submitted) return;
    submitted = true;
    clearInterval(timer);
    const grade = gradeExam(qs, ex.answers, struct);
    const now = Date.now();
    store.update((s) => {
      for (const q of qs) if (ex.answers[q.id] !== undefined) {
        const st = s.stats[q.id] || { right: 0, wrong: 0, last: null, ts: 0 };
        if (ex.answers[q.id] === q.answer) st.right++; else st.wrong++;
        st.last = ex.answers[q.id] === q.answer ? 'right' : 'wrong';
        st.ts = now;
        s.stats[q.id] = st;
      }
      s.history.unshift({ ts: now, structId: struct.id, label: struct.label, score: grade.correct, total: grade.total, passed: grade.passed });
      s.history = s.history.slice(0, 50);
      s.lastResult = { ts: now, structId: struct.id, label: struct.label, ids: ex.ids, answers: ex.answers, grade, passScore: struct.passScore };
      s.exam = null;
    });
    go('/thi/ket-qua');
  };

  const clock = h('span', { class: 'clock' }, fmtClock(ex.endAt - Date.now()));
  const tick = () => {
    const left = ex.endAt - Date.now();
    clock.textContent = fmtClock(left);
    clock.classList.toggle('low', left < 60000);
    if (left <= 0) submit();
  };
  timer = setInterval(tick, 1000);
  // iOS tạm dừng timer khi app ở nền: kiểm tra lại khi quay lại
  const vis = () => { if (!document.hidden) tick(); };
  document.addEventListener('visibilitychange', vis);
  if (ex.endAt - Date.now() <= 0) { submit(); return; }

  const body = h('div', {});
  const draw = () => {
    const q = qs[ex.idx];
    const answered = Object.keys(ex.answers).length;
    body.replaceChildren(
      h('div', { class: 'progress' }, h('i', { style: `width:${Math.round(((ex.idx + 1) / qs.length) * 100)}%` })),
      questionCard(q, { number: ex.idx + 1, picked: ex.answers[q.id], reveal: false,
        onPick: (i) => { store.update(() => { ex.answers[q.id] = i; }); draw(); } }),
      h('div', { class: 'row sticky-actions' },
        h('button', { class: 'btn', disabled: ex.idx === 0 ? true : null, onclick: () => { ex.idx--; store.update(() => {}); draw(); window.scrollTo(0, 0); } }, '‹ Trước'),
        h('button', { class: 'btn', disabled: ex.idx === qs.length - 1 ? true : null, onclick: () => { ex.idx++; store.update(() => {}); draw(); window.scrollTo(0, 0); } }, 'Sau ›')),
      h('div', { class: 'sub center' }, `Đã làm ${answered}/${qs.length} câu`));
  };

  const grid = () => {
    let close;
    const states = qs.map((q) => (ex.answers[q.id] !== undefined ? 'done' : ''));
    close = sheet('Chọn câu', gridButtons(qs.length, states, ex.idx, (i) => { close(); ex.idx = i; store.update(() => {}); draw(); window.scrollTo(0, 0); }));
  };

  el.append(h('div', { class: 'toprow' }, clock, h('span', { class: 'grow' }),
    h('button', { class: 'btn small', onclick: grid }, 'Lưới câu ▾'),
    h('button', { class: 'btn small danger', onclick: async () => {
      const left = qs.filter((q) => ex.answers[q.id] === undefined).length;
      const msg = left ? `Còn ${left} câu chưa làm. Vẫn nộp bài?` : 'Nộp bài và xem kết quả?';
      if (await confirmBox(msg, 'Nộp bài', 'Làm tiếp')) submit();
    } }, 'Nộp bài')), body);
  draw();

  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', vis); };
}

export async function examResult(el) {
  const data = await loadData();
  const r = store.get().lastResult;
  if (!r) { el.append(h('h1', {}, 'Kết quả'), h('div', { class: 'card empty' }, 'Chưa có kết quả nào.'), h('a', { class: 'btn', href: '#/thi' }, 'Thi thử')); return; }
  const g = r.grade;
  el.append(h('h1', {}, 'Kết quả thi thử'),
    h('div', { class: 'card center ' + (g.passed ? 'pass' : 'fail') },
      h('div', { class: 'verdict' }, g.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'),
      h('div', { class: 'big' }, `${g.correct}/${g.total}`),
      h('div', {}, `Cần ≥ ${g.need} câu đúng và không sai câu điểm liệt`),
      g.reason ? h('div', { class: 'reason' }, g.reason) : null,
      g.criticalWrong.length ? h('div', { class: 'reason' }, 'Sai câu điểm liệt: ' + g.criticalWrong.map((id) => '#' + id).join(', ')) : null,
      h('div', { class: 'sub' }, `${r.label} · ${fmtDate(r.ts)} · bỏ trống ${g.unanswered}`)),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/thi' }, 'Thi lại'), h('a', { class: 'btn', href: '#/' }, 'Trang chủ')));

  let onlyWrong = false;
  const list = h('div', {});
  const draw = () => {
    list.replaceChildren();
    r.ids.forEach((id, i) => {
      const q = data.byId.get(id);
      if (!q) return;
      const ok = r.answers[id] === q.answer;
      if (onlyWrong && ok) return;
      list.append(questionCard(q, { number: i + 1, picked: r.answers[id], reveal: true }));
    });
    if (!list.children.length) list.append(h('div', { class: 'card empty' }, 'Không có câu sai.'));
  };
  el.append(h('div', { class: 'toprow' }, h('h2', {}, 'Xem lại từng câu'), h('span', { class: 'grow' }),
    h('button', { class: 'btn small', onclick: (e) => { onlyWrong = !onlyWrong; e.target.textContent = onlyWrong ? 'Hiện tất cả' : 'Chỉ câu sai'; draw(); } }, 'Chỉ câu sai')), list);
  draw();
}
