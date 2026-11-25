// Chớp nhoáng ⚡: 60 giây, combo nhân điểm, sai trừ 5 giây.
import { h } from '../../util.js';
import { loadData } from '../../data.js';
import * as store from '../../store.js';
import { shuffle } from '../../exam.js';
import { comboMultiplier } from '../../games/logic.js';
import { recordAnswer, saveBest, saveBestCombo } from '../../games/progress.js';
import { ensureAudio, playSound, confetti } from '../../games/fx.js';
import { questionCard } from '../question.js';
import { gameTop, summary, wrongList, secText, makeTimers } from './ui.js';

const DURATION = 60000;
const PENALTY = 5000;
const REVEAL_MS = 800;

function sources(data) {
  const s = store.get();
  const wrong = data.questions.filter((q) => s.stats[q.id] && s.stats[q.id].last === 'wrong');
  const list = [{ key: 'all', label: 'Tất cả câu hỏi', pool: data.questions }];
  for (const c of data.chapters) list.push({ key: 'ch' + c.id, label: `Chương ${c.id}`, pool: data.questions.filter((q) => q.chapter === c.id) });
  if (wrong.length >= 5) list.unshift({ key: 'wrong', label: `Câu đang sai (${wrong.length})`, pool: wrong });
  return list;
}

export async function blitz(el) {
  const data = await loadData();
  const T = makeTimers();

  const menu = () => {
    el.replaceChildren();
    const best = store.get().game.best.chop;   // đọc lại mỗi lần vào menu để kỷ lục mới hiện ngay
    const list = sources(data);
    let chosen = list.find((x) => x.key === 'all');
    const box = h('div', { class: 'chips' });
    const drawChips = () => box.replaceChildren(...list.map((x) => h('button', { class: 'chip' + (x === chosen ? ' on' : ''), type: 'button',
      onclick: () => { chosen = x; drawChips(); } }, x.label)));
    drawChips();
    el.append(gameTop('Chớp nhoáng ⚡'),
      h('div', { class: 'card' }, h('p', {}, '60 giây. Trả lời đúng được 10 điểm nhân hệ số combo (3 câu liền ×2, 6 câu liền ×3). Sai thì mất combo và trừ 5 giây.'),
        h('div', { class: 'sub' }, best ? `Kỷ lục: ${best} điểm` : 'Chưa có kỷ lục')),
      h('h2', {}, 'Nguồn câu hỏi'), box,
      h('button', { class: 'btn primary block', onclick: () => { ensureAudio(); run(chosen.pool); } }, 'Bắt đầu'));
  };

  const run = (pool) => {
    let order = shuffle(pool);
    let pos = 0;
    let endAt = Date.now() + DURATION;
    let score = 0, combo = 0, maxCombo = 0, right = 0;
    const wrongs = [];
    let locked = false;
    let over = false;

    const hud = h('div', { class: 'blitzhud' });
    const body = h('div', {});
    el.replaceChildren(gameTop('Chớp nhoáng ⚡'), hud, body);

    const drawHud = () => {
      const left = endAt - Date.now();
      hud.replaceChildren(
        h('span', { class: 'clock' + (left < 10000 ? ' low' : '') }, secText(left) + 's'), h('span', { class: 'grow' }),
        h('span', { class: 'hudscore' }, `${score} điểm`),
        h('span', { class: 'hudcombo' }, combo ? `🔥 ×${comboMultiplier(combo)} · combo ${combo}` : 'combo 0'));
    };

    const show = (picked) => {
      const q = order[pos % order.length];
      body.replaceChildren(questionCard(q, { picked, reveal: picked !== undefined, onPick: (i) => pick(q, i) }));
    };

    const pick = (q, i) => {
      if (locked || over) return;
      ensureAudio();
      const ok = i === q.answer;
      if (ok) {
        const mult = comboMultiplier(combo);
        score += 10 * mult; combo++; right++;
        maxCombo = Math.max(maxCombo, combo);
        recordAnswer(q.id, true, 10 * mult);
        playSound('right');
        pos++; drawHud(); show();
        window.scrollTo(0, 0);
      } else {
        combo = 0;
        endAt -= PENALTY;
        wrongs.push({ q, picked: i });
        recordAnswer(q.id, false, 0);
        playSound('wrong');
        locked = true;
        drawHud();
        show(i);
        T.timeout(() => { locked = false; pos++; if (!over) { show(); window.scrollTo(0, 0); } }, REVEAL_MS);
      }
    };

    const tick = () => {
      if (over) return;
      if (endAt - Date.now() <= 0) return finish();
      drawHud();
    };

    const finish = () => {
      over = true;
      T.clear();
      saveBestCombo(maxCombo);
      const rec = score > 0 && saveBest('chop', score);
      if (rec) { confetti(); playSound('record'); }
      el.replaceChildren(gameTop('Chớp nhoáng ⚡'),
        summary('Hết giờ!', `${score} điểm`, [`${right} câu đúng · combo cao nhất ${maxCombo}`, `Kỷ lục: ${store.get().game.best.chop} điểm`], rec),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: menu }, 'Đổi nguồn câu'),
          h('button', { class: 'btn primary', onclick: () => { ensureAudio(); run(pool); } }, 'Chơi lại')));
      const wl = wrongList(wrongs);
      if (wl) el.append(wl);
      window.scrollTo(0, 0);
    };

    drawHud(); show();
    // đồng hồ tính từ Date.now() (iOS tạm dừng timer khi app ở nền)
    T.interval(tick, 200);
  };

  menu();
  return () => T.clear();
}
