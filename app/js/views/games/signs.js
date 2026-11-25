// Ghép biển báo 🚸: nối 5 biển báo với ý nghĩa, đồng hồ đếm lên.
import { h } from '../../util.js';
import { loadData, loadSigns } from '../../data.js';
import * as store from '../../store.js';
import { signsRound } from '../../games/logic.js';
import { recordAnswer, saveBest, setPerfectSigns } from '../../games/progress.js';
import { ensureAudio, playSound, confetti, shake } from '../../games/fx.js';
import { gameTop, summary, secText, makeTimers } from './ui.js';

const PAIRS = 5;

export async function signsGame(el) {
  await loadData();
  const pairs = await loadSigns();
  const T = makeTimers();

  const menu = () => {
    const best = store.get().game.best.ghepBien;
    el.replaceChildren(gameTop('Ghép biển báo 🚸'),
      h('div', { class: 'card' },
        h('p', {}, `Mỗi ván có ${PAIRS} biển báo và ${PAIRS} ý nghĩa. Chạm một biển báo rồi chạm ý nghĩa tương ứng (hoặc ngược lại).`),
        h('p', {}, 'Kỷ lục thời gian chỉ tính các ván sai không quá 2 lần.'),
        h('div', { class: 'sub' }, best ? `Nhanh nhất: ${best.toFixed(1)} giây` : 'Chưa có kỷ lục')),
      h('button', { class: 'btn primary block', onclick: () => { ensureAudio(); run(); } }, 'Bắt đầu'));
  };

  const run = () => {
    const { left, right } = signsRound(pairs, PAIRS);
    const matched = new Set();
    let sel = null;   // { side: 'L'|'R', id }
    let errors = 0;
    const startAt = Date.now();
    const els = new Map();   // 'L'+id / 'R'+id -> button

    const clock = h('span', { class: 'clock' }, '0.0s');
    const errLbl = h('span', { class: 'sub' }, 'Lỗi: 0');
    const colL = h('div', { class: 'scol' });
    const colR = h('div', { class: 'scol' });
    el.replaceChildren(gameTop('Ghép biển báo 🚸', errLbl), h('div', { class: 'toprow' }, clock), h('div', { class: 'sgrid' }, colL, colR));

    const mk = (side, p) => {
      const b = h('button', { class: 'sitem ' + (side === 'L' ? 'simg' : 'stext'), type: 'button', onclick: () => tap(side, p) },
        side === 'L' ? h('img', { src: 'data/' + p.image, alt: 'Biển báo' }) : p.meaning);
      els.set(side + p.id, b);
      return b;
    };
    left.forEach((p) => colL.append(mk('L', p)));
    right.forEach((p) => colR.append(mk('R', p)));

    const clearSel = () => { if (sel) els.get(sel.side + sel.id).classList.remove('sel'); sel = null; };

    const tap = (side, p) => {
      ensureAudio();
      if (matched.has(p.id)) return;
      if (!sel || sel.side === side) {
        // chọn mới / đổi lựa chọn cùng cột (chạm lại đúng ô đang chọn thì bỏ chọn)
        const same = sel && sel.side === side && sel.id === p.id;
        clearSel();
        if (!same) { sel = { side, id: p.id }; els.get(side + p.id).classList.add('sel'); }
        return;
      }
      const a = sel; const b = { side, id: p.id };
      const imgId = a.side === 'L' ? a.id : b.id;   // lỗi tính theo ảnh
      const ea = els.get(a.side + a.id), eb = els.get(b.side + b.id);
      clearSel();
      if (a.id === b.id) {
        matched.add(p.id);
        ea.classList.add('ok'); eb.classList.add('ok'); ea.disabled = eb.disabled = true;
        recordAnswer(p.id, true, 10);
        playSound('right');
        if (matched.size === left.length) finish();
      } else {
        errors++;
        errLbl.textContent = 'Lỗi: ' + errors;
        recordAnswer(imgId, false, 0);
        playSound('wrong');
        [ea, eb].forEach((e) => { e.classList.add('bad'); shake(e); });
        T.timeout(() => [ea, eb].forEach((e) => e.classList.remove('bad')), 450);
      }
    };

    const finish = () => {
      T.clear();
      const secs = Math.round((Date.now() - startAt) / 100) / 10;
      const counts = errors <= 2;
      const rec = counts && saveBest('ghepBien', secs, true);
      if (errors === 0) setPerfectSigns();
      if (rec) { confetti(); playSound('record'); }
      const best = store.get().game.best.ghepBien;
      T.timeout(() => {
        el.replaceChildren(gameTop('Ghép biển báo 🚸'),
          summary('Hoàn thành', `${secs.toFixed(1)} giây`,
            [`Số lần sai: ${errors}`, counts ? (best ? `Nhanh nhất: ${best.toFixed(1)} giây` : '') : 'Sai quá 2 lần nên không tính kỷ lục'].filter(Boolean), rec),
          h('div', { class: 'row' },
            h('a', { class: 'btn', href: '#/choi' }, 'Về Chơi'),
            h('button', { class: 'btn primary', onclick: () => { ensureAudio(); run(); } }, 'Chơi lại')));
        window.scrollTo(0, 0);
      }, 600);
    };

    T.interval(() => { if (matched.size < left.length) clock.textContent = secText(Date.now() - startAt) + 's'; }, 100);
  };

  menu();
  return () => T.clear();
}
