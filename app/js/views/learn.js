// Học: danh sách bài (accordion + tìm kiếm) và trang bài học (nghe đọc, cỡ chữ, đã học, lưu vị trí cuộn).
import { h, fold, sanitize } from '../util.js';
import { loadData } from '../data.js';
import * as store from '../store.js';
import * as tts from '../tts.js';
import { applyFont } from './settings.js';

const textOf = (html) => String(html || '').replace(/<[^>]*>/g, ' ');

export async function learnList(el) {
  const data = await loadData();
  const s = store.get();
  const index = new Map(data.lessons.map((l) => [l.id, fold(`${l.num} ${l.title} ${textOf(l.html)}`)]));

  const input = h('input', { type: 'search', class: 'search', placeholder: 'Tìm bài học…', 'aria-label': 'Tìm bài học', autocomplete: 'off' });
  const list = h('div', {});
  const draw = () => {
    const q = fold(input.value.trim());
    list.replaceChildren();
    for (const p of data.parts) {
      const part = h('details', { class: 'acc', open: true }, h('summary', {}, p.title));
      let partHits = 0;
      for (const g of p.groups) {
        const ls = g.lessons.filter((l) => !q || index.get(l.id).includes(q));
        if (!ls.length) continue;
        partHits += ls.length;
        const grp = h('details', { class: 'acc sub-acc', open: !!q || undefined }, h('summary', {}, g.title));
        for (const l of ls) {
          const done = !!s.learned[l.id];
          grp.append(h('a', { class: 'lesson-row' + (l.html ? '' : ' dim'), href: '#/hoc/' + l.id },
            h('span', { class: 'lnum' }, l.num), h('span', { class: 'ltitle' }, l.title),
            l.html ? (done ? h('span', { class: 'tick' }, '✓') : null) : h('span', { class: 'badge' }, 'Sắp có')));
        }
        part.append(grp);
      }
      if (partHits) list.append(part);
    }
    if (!list.children.length) list.append(h('div', { class: 'card empty' }, 'Không tìm thấy bài phù hợp.'));
  };
  input.addEventListener('input', draw);
  el.append(h('h1', {}, 'Học'), input, list);
  draw();
}

export async function lesson(el, { id }) {
  const data = await loadData();
  const idx = data.lessons.findIndex((l) => l.id === id);
  if (idx < 0) { el.append(h('div', { class: 'card empty' }, 'Không tìm thấy bài học.'), h('a', { class: 'btn', href: '#/hoc' }, 'Về danh sách')); return; }
  const L = data.lessons[idx];
  const st = store.get();

  const body = h('div', { class: 'lesson-body' });
  if (L.html) body.append(sanitize(L.html));
  else body.append(h('p', { class: 'empty' }, 'Nội dung đang được cập nhật.'));

  // --- thanh công cụ ---
  const ttsBtns = h('div', { class: 'row wrap' });
  const drawTts = (state) => {
    ttsBtns.replaceChildren();
    const opts = () => ({ rate: store.get().settings.rate, voiceURI: store.get().settings.voice });
    const text = () => `${L.title}. ${body.textContent}`;
    if (state === 'idle') ttsBtns.append(h('button', { class: 'btn', onclick: () => tts.speak(text(), opts()) }, '🔊 Nghe'));
    if (state === 'playing') ttsBtns.append(h('button', { class: 'btn', onclick: tts.pause }, '⏸ Tạm dừng'));
    if (state === 'paused') ttsBtns.append(h('button', { class: 'btn', onclick: tts.resume }, '▶ Tiếp tục'));
    if (state !== 'idle') ttsBtns.append(h('button', { class: 'btn', onclick: tts.stop }, '⏹ Dừng'));
  };
  const toolbar = h('div', { class: 'card toolbar' });
  if (L.html && tts.supported()) {
    tts.onState(drawTts);
    drawTts('idle');
    const rate = h('input', { type: 'range', min: '0.8', max: '1.4', step: '0.1', value: String(st.settings.rate), 'aria-label': 'Tốc độ đọc',
      oninput: (e) => { store.update((s) => { s.settings.rate = parseFloat(e.target.value); }); rateLbl.textContent = '×' + st.settings.rate.toFixed(1); } });
    const rateLbl = h('span', { class: 'sub' }, '×' + st.settings.rate.toFixed(1));
    toolbar.append(ttsBtns, h('label', { class: 'row rate' }, h('span', { class: 'sub' }, 'Tốc độ'), rate, rateLbl));
  } else if (L.html) toolbar.append(h('p', { class: 'sub' }, 'Thiết bị không hỗ trợ đọc to.'));

  const fontStep = (d) => {
    store.update((s) => { s.settings.fontSize = Math.min(22, Math.max(15, s.settings.fontSize + d)); });
    applyFont();
  };
  const learnBtn = h('button', { class: 'btn' });
  const drawLearn = () => {
    const done = !!store.get().learned[L.id];
    learnBtn.textContent = done ? '✓ Đã học (chạm để bỏ)' : 'Đánh dấu đã học';
    learnBtn.classList.toggle('primary', !done);
  };
  learnBtn.addEventListener('click', () => {
    store.update((s) => { if (s.learned[L.id]) delete s.learned[L.id]; else s.learned[L.id] = Date.now(); });
    drawLearn();
  });
  drawLearn();
  toolbar.append(h('div', { class: 'row wrap' },
    h('button', { class: 'btn small', 'aria-label': 'Giảm cỡ chữ', onclick: () => fontStep(-1) }, 'A−'),
    h('button', { class: 'btn small', 'aria-label': 'Tăng cỡ chữ', onclick: () => fontStep(1) }, 'A+'),
    L.html ? learnBtn : null));

  const prev = data.lessons[idx - 1];
  const next = data.lessons[idx + 1];
  el.append(h('div', { class: 'crumb' }, h('a', { href: '#/hoc' }, '‹ Danh sách bài')),
    h('h1', {}, `${L.num}. ${L.title}`),
    L.source ? h('p', { class: 'sub' }, 'Nguồn: ' + L.source) : '',
    toolbar, body,
    h('div', { class: 'row' },
      prev ? h('a', { class: 'btn', href: '#/hoc/' + prev.id }, '‹ Bài trước') : h('span', { class: 'grow' }),
      next ? h('a', { class: 'btn', href: '#/hoc/' + next.id }, 'Bài sau ›') : null));

  // --- lưu / khôi phục vị trí cuộn ---
  const saved = st.scroll[L.id];
  if (saved) requestAnimationFrame(() => window.scrollTo(0, saved));
  let t = null;
  const onScroll = () => {
    clearTimeout(t);
    t = setTimeout(() => store.update((s) => { s.scroll[L.id] = Math.round(window.scrollY); }), 250);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(t);
    if (window.scrollY > 0) store.update((s) => { s.scroll[L.id] = Math.round(window.scrollY); });
    tts.stop();
  };
}
