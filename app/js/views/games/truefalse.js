// Đúng hay Sai? ✅❌: 20 lượt, vuốt phải = Đúng, vuốt trái = Sai.
import { h } from '../../util.js';
import { loadData } from '../../data.js';
import * as store from '../../store.js';
import { tfRound, tfPoints } from '../../games/logic.js';
import { recordAnswer, saveBest } from '../../games/progress.js';
import { ensureAudio, playSound, confetti, shake } from '../../games/fx.js';
import { gameTop, summary, bar, makeTimers } from './ui.js';

const ROUNDS = 20;
const SWIPE = 80;
const FEEDBACK_MS = 1800;

export async function trueFalse(el) {
  const data = await loadData();
  const T = makeTimers();

  const menu = () => {
    const best = store.get().game.best.dungSai;
    el.replaceChildren(gameTop('Đúng hay Sai? ✅❌'),
      h('div', { class: 'card' },
        h('p', {}, `${ROUNDS} lượt. Mỗi lượt có một câu hỏi và một phương án trả lời — phương án đó đúng hay sai?`),
        h('p', {}, 'Chọn nút Đúng / Sai, hoặc vuốt thẻ sang phải (Đúng) / sang trái (Sai). Đúng +10 điểm, trả lời dưới 3 giây +5 điểm.'),
        h('div', { class: 'sub' }, best ? `Kỷ lục: ${best} điểm` : 'Chưa có kỷ lục')),
      h('button', { class: 'btn primary block', onclick: () => { ensureAudio(); run(); } }, 'Bắt đầu'));
  };

  const run = () => {
    const rounds = tfRound(data.questions, ROUNDS);
    let i = 0, score = 0, right = 0;
    let shownAt = 0, locked = false, advance = null;

    const body = h('div', {});
    el.replaceChildren(gameTop('Đúng hay Sai?', h('span', { class: 'sub nowrap' }, '')), body);
    const counter = el.querySelector('.toprow .sub');

    const show = () => {
      if (i >= rounds.length) return finish();
      const r = rounds[i];
      const q = data.byId.get(r.qid);
      locked = false;
      counter.textContent = `${i + 1}/${rounds.length} · ${score} điểm`;
      const card = h('div', { class: 'card qcard tfcard' },
        h('div', { class: 'qmeta' }, q.critical ? h('span', { class: 'badge crit' }, 'Điểm liệt') : null, h('span', { class: 'qid' }, '#' + q.id)),
        h('p', { class: 'qtext' }, q.text),
        q.image ? h('div', { class: 'qimg static' }, h('img', { src: 'data/' + q.image, alt: 'Hình minh hoạ câu hỏi' })) : null,
        h('div', { class: 'tfopt' }, h('div', { class: 'sub' }, 'Phương án:'), h('b', {}, r.text)));
      const fb = h('div', {});
      const btnT = h('button', { class: 'btn tfbtn yes', type: 'button', onclick: () => answer(true) }, '✅ Đúng');
      const btnF = h('button', { class: 'btn tfbtn no', type: 'button', onclick: () => answer(false) }, '❌ Sai');

      // vuốt bằng pointer events
      let sx = null, dx = 0;
      card.addEventListener('pointerdown', (e) => { if (locked) return; sx = e.clientX; dx = 0; });
      card.addEventListener('pointermove', (e) => {
        if (sx === null || locked) return;
        dx = e.clientX - sx;
        card.style.transform = `translateX(${Math.max(-120, Math.min(120, dx))}px) rotate(${dx / 30}deg)`;
        card.classList.toggle('swipe-yes', dx > SWIPE / 2);
        card.classList.toggle('swipe-no', dx < -SWIPE / 2);
      });
      const end = () => {
        if (sx === null) return;
        const d = dx; sx = null; dx = 0;
        card.style.transform = '';
        card.classList.remove('swipe-yes', 'swipe-no');
        if (d >= SWIPE) answer(true); else if (d <= -SWIPE) answer(false);
      };
      card.addEventListener('pointerup', end);
      card.addEventListener('pointercancel', () => { sx = null; card.style.transform = ''; card.classList.remove('swipe-yes', 'swipe-no'); });

      const answer = (said) => {
        if (locked) return;
        locked = true;
        ensureAudio();
        const ok = said === r.isTrue;
        const pts = tfPoints(ok, Date.now() - shownAt);
        score += pts; if (ok) right++;
        recordAnswer(q.id, ok, ok ? 10 : 0);
        playSound(ok ? 'right' : 'wrong');
        btnT.disabled = btnF.disabled = true;
        const bubble = h('div', { class: 'card tffb ' + (ok ? 'pass' : 'fail') },
          h('b', {}, ok ? `Đúng rồi! +${pts}` : 'Chưa đúng'),
          h('div', { class: 'sub' }, `Đáp án đúng của câu: ${q.options[q.answer]}`),
          h('div', { class: 'sub' }, 'Chạm để sang lượt tiếp'));
        bubble.addEventListener('click', go);
        fb.replaceChildren(bubble);
        if (!ok) shake(bubble);
        counter.textContent = `${i + 1}/${rounds.length} · ${score} điểm`;
        advance = T.timeout(go, FEEDBACK_MS);
      };
      const go = () => { T.clearTimeout(advance); if (!locked) return; locked = false; i++; show(); window.scrollTo(0, 0); };

      body.replaceChildren(bar((i / rounds.length) * 100), card, h('div', { class: 'row tfbtns' }, btnF, btnT), fb);
      shownAt = Date.now();
    };

    const finish = () => {
      T.clear();
      const rec = score > 0 && saveBest('dungSai', score);
      if (rec) { confetti(); playSound('record'); }
      el.replaceChildren(gameTop('Đúng hay Sai? ✅❌'),
        summary('Hoàn thành', `${score} điểm`, [`${right}/${rounds.length} lượt đúng`, `Kỷ lục: ${store.get().game.best.dungSai} điểm`], rec),
        h('div', { class: 'row' },
          h('a', { class: 'btn', href: '#/choi' }, 'Về Chơi'),
          h('button', { class: 'btn primary', onclick: () => { ensureAudio(); run(); } }, 'Chơi lại')));
      window.scrollTo(0, 0);
    };

    show();
  };

  menu();
  return () => T.clear();
}
