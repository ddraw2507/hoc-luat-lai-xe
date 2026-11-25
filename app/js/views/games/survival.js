// Sinh tồn ❤️: 3 mạng, mỗi câu có đồng hồ riêng, sai câu điểm liệt mất hết mạng.
import { h } from '../../util.js';
import { loadData } from '../../data.js';
import * as store from '../../store.js';
import { survivalPick, survivalSeconds } from '../../games/logic.js';
import { recordAnswer, saveBest } from '../../games/progress.js';
import { ensureAudio, playSound, confetti, shake } from '../../games/fx.js';
import { questionCard } from '../question.js';
import { gameTop, summary, wrongList, makeTimers } from './ui.js';

const LIVES = 3;

export async function survival(el) {
  const data = await loadData();
  const T = makeTimers();

  const menu = () => {
    const best = store.get().game.best.sinhTon;
    el.replaceChildren(gameTop('Sinh tồn ❤️'),
      h('div', { class: 'card' },
        h('p', {}, '3 mạng. Mỗi câu có đồng hồ riêng: bắt đầu 20 giây, cứ 5 câu đúng giảm 1 giây (tối thiểu 8 giây).'),
        h('p', {}, 'Sai hoặc hết giờ mất 1 mạng. Sai câu điểm liệt là mất hết mạng.'),
        h('div', { class: 'sub' }, best ? `Kỷ lục: ${best} câu` : 'Chưa có kỷ lục')),
      h('button', { class: 'btn primary block', onclick: () => { ensureAudio(); run(); } }, 'Bắt đầu'));
  };

  const run = () => {
    const used = new Set();
    let lives = LIVES, score = 0;
    const wrongs = [];
    let q = null, endAt = 0, total = 0, locked = false, critDeath = false;
    let rec = null;   // kỷ lục lưu ngay lúc hết mạng (rời màn hình trong lúc chờ màn kết quả vẫn không mất)

    const hud = h('div', { class: 'blitzhud' });
    const timerBar = h('div', { class: 'progress timerbar' }, h('i', {}));
    const body = h('div', {});
    el.replaceChildren(gameTop('Sinh tồn ❤️'), hud, timerBar, body);

    const drawHud = () => {
      const left = Math.max(0, endAt - Date.now());
      hud.replaceChildren(
        h('span', { class: 'hearts', 'aria-label': `${lives} mạng` }, '❤️'.repeat(lives) + '🖤'.repeat(LIVES - lives)), h('span', { class: 'grow' }),
        h('span', { class: 'hudscore' }, `${score} câu`),
        h('span', { class: 'clock' + (left < 5000 ? ' low' : '') }, Math.ceil(left / 1000) + 's'));
      timerBar.firstChild.style.width = (total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0) + '%';
    };

    const next = () => {
      q = survivalPick(data.questions, store.get().stats, used);
      if (!q) return finish();
      used.add(q.id);
      total = survivalSeconds(score) * 1000;
      endAt = Date.now() + total;
      locked = false;
      body.replaceChildren(questionCard(q, { onPick: (i) => pick(i) }));
      drawHud();
      window.scrollTo(0, 0);
    };

    // lộ đáp án, trừ mạng (nếu sai), hiện nút tiếp tục
    const settle = (picked, ok) => {
      locked = true;
      // chỉ CHỌN SAI câu điểm liệt mới mất hết mạng; hết giờ thì mất 1 mạng như câu thường
      const crit = !ok && q.critical && picked !== undefined;
      if (!ok) {
        lives = crit ? 0 : lives - 1;
        critDeath = crit;
        wrongs.push({ q, picked });
        playSound('wrong');
      } else playSound('right');
      drawHud();
      const card = questionCard(q, { picked, reveal: true });
      if (!ok) shake(card);
      body.replaceChildren(...[
        crit ? h('div', { class: 'card fail center' }, h('b', {}, '💥 Điểm liệt!'), h('div', { class: 'sub' }, 'Sai câu điểm liệt — mất hết mạng.')) : null,
        picked === undefined ? h('div', { class: 'card fail center' }, h('b', {}, '⏰ Hết giờ!')) : null,
        card].filter(Boolean));
      if (ok) { T.timeout(next, 600); return; }
      if (lives <= 0) {
        rec = score > 0 && saveBest('sinhTon', score);
        T.timeout(finish, crit ? 1800 : 1500);
        return;
      }
      body.append(h('div', { class: 'row sticky-actions' }, h('button', { class: 'btn primary', onclick: next }, 'Tiếp tục ›')));
      window.scrollTo(0, document.body.scrollHeight);
    };

    const pick = (i) => {
      if (locked) return;
      ensureAudio();
      const ok = i === q.answer;
      recordAnswer(q.id, ok, ok ? 10 : 0);
      if (ok) score++;
      settle(i, ok);
    };

    const tick = () => {
      if (locked || !q) return;
      if (endAt - Date.now() <= 0) { recordAnswer(q.id, false, 0); settle(undefined, false); } else drawHud();
    };

    const finish = () => {
      T.clear();
      if (rec === null) rec = score > 0 && saveBest('sinhTon', score);   // hết câu trong bộ đề (không hết mạng)
      if (rec) { confetti(); playSound('record'); }
      el.replaceChildren(gameTop('Sinh tồn ❤️'),
        summary(critDeath ? 'Điểm liệt!' : 'Hết mạng', `${score} câu`, [`Kỷ lục: ${store.get().game.best.sinhTon} câu`], rec),
        h('div', { class: 'row' },
          h('a', { class: 'btn', href: '#/choi' }, 'Về Chơi'),
          h('button', { class: 'btn primary', onclick: () => { ensureAudio(); run(); } }, 'Chơi lại')));
      const wl = wrongList(wrongs);
      if (wl) el.append(wl);
      window.scrollTo(0, 0);
    };

    // đồng hồ từ Date.now(); iOS có thể dừng timer ở nền nên tick luôn so với endAt
    T.interval(tick, 250);
    next();
  };

  menu();
  return () => T.clear();
}
