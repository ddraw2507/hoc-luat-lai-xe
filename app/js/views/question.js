// Thẻ câu hỏi dùng chung cho Ôn tập, Thi thử và xem lại kết quả.
import { h } from '../util.js';

function zoomImage(src) {
  const close = () => ov.remove();
  const ov = h('div', { class: 'overlay zoom', onclick: close },
    h('img', { src, alt: 'Hình câu hỏi (phóng to)' }),
    h('button', { class: 'btn small zoom-close', onclick: close }, 'Đóng'));
  document.body.append(ov);
}

/**
 * opts: { picked, reveal, onPick(i), chapterName, number }
 *  - reveal=false: chỉ tô ý đã chọn (chế độ thi)
 *  - reveal=true: tô xanh ý đúng, đỏ ý sai đã chọn
 */
export function questionCard(q, opts = {}) {
  const { picked, reveal, onPick, chapterName, number } = opts;
  const card = h('section', { class: 'card qcard' });
  const meta = h('div', { class: 'qmeta' },
    number ? h('span', { class: 'qnum' }, 'Câu ' + number) : null,
    h('span', { class: 'qid' }, '#' + q.id),
    q.critical ? h('span', { class: 'badge crit' }, 'Điểm liệt') : null,
    chapterName ? h('span', { class: 'qchap' }, chapterName) : null);
  card.append(meta, h('p', { class: 'qtext' }, q.text));
  if (q.image) {
    card.append(h('button', { class: 'qimg', 'aria-label': 'Phóng to hình', onclick: () => zoomImage('data/' + q.image) },
      h('img', { src: 'data/' + q.image, alt: 'Hình minh hoạ câu hỏi' })));
  }
  const list = h('div', { class: 'opts' });
  q.options.forEach((text, i) => {
    let cls = 'opt';
    if (reveal) {
      if (i === q.answer) cls += ' right';
      else if (i === picked) cls += ' wrong';
    } else if (i === picked) cls += ' picked';
    const b = h('button', { class: cls, type: 'button', disabled: reveal && onPick ? true : null,
      onclick: onPick ? () => onPick(i) : null },
      h('span', { class: 'onum' }, String(i + 1)), h('span', { class: 'otext' }, text),
      reveal && i === q.answer ? h('span', { class: 'mark' }, '✓') : null,
      reveal && i === picked && i !== q.answer ? h('span', { class: 'mark' }, '✗') : null);
    list.append(b);
  });
  card.append(list);
  return card;
}

/** Lưới số câu trong bottom sheet. states: mảng 'done'|'right'|'wrong'|'' theo thứ tự. */
export function gridButtons(count, states, current, onJump) {
  const g = h('div', { class: 'grid' });
  for (let i = 0; i < count; i++) {
    g.append(h('button', { class: `gcell ${states[i] || ''} ${i === current ? 'cur' : ''}`, type: 'button',
      onclick: () => onJump(i) }, String(i + 1)));
  }
  return g;
}
