import { h } from '../util.js';
import { loadData, currentStructure } from '../data.js';
import * as store from '../store.js';

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - today) / 86400000);
}

export async function home(el) {
  const data = await loadData();
  const s = store.get();
  const struct = currentStructure(data, s.settings);
  const lessons = data.lessons.filter((l) => l.html);
  const learned = lessons.filter((l) => s.learned[l.id]).length;
  const right = data.questions.filter((q) => s.stats[q.id] && s.stats[q.id].last === 'right').length;
  const wrong = data.questions.filter((q) => s.stats[q.id] && s.stats[q.id].last === 'wrong').length;
  const next = lessons.find((l) => !s.learned[l.id]);

  el.append(h('h1', {}, 'Chào bạn 👋'),
    h('p', { class: 'sub' }, 'Mỗi ngày một ít, đến ngày thi sẽ vững.'));

  const days = daysUntil(s.settings.examDate);
  if (days !== null) {
    el.append(h('div', { class: 'card center' },
      days > 0 ? [h('div', { class: 'big' }, String(days)), h('div', {}, 'ngày nữa đến ngày thi')]
        : days === 0 ? h('div', { class: 'big' }, 'Hôm nay thi!') : h('div', {}, 'Ngày thi dự kiến đã qua')));
  }

  el.append(h('div', { class: 'card' },
    h('b', {}, struct.label),
    h('div', { class: 'sub' }, `${struct.count} câu · ${struct.minutes} phút · đúng ≥ ${struct.passScore} · không sai câu điểm liệt`)),
  h('div', { class: 'stats3' },
    h('div', { class: 'card center' }, h('div', { class: 'big' }, `${learned}/${lessons.length}`), h('div', { class: 'sub' }, 'bài đã học')),
    h('div', { class: 'card center' }, h('div', { class: 'big' }, `${right}/${data.questions.length}`), h('div', { class: 'sub' }, 'câu làm đúng')),
    h('div', { class: 'card center' }, h('div', { class: 'big' }, String(wrong)), h('div', { class: 'sub' }, 'câu đang sai'))),
  h('div', { class: 'quick' },
    h('a', { class: 'btn primary block', href: next ? '#/hoc/' + next.id : '#/hoc' }, next ? 'Học tiếp: ' + next.title : 'Học'),
    h('a', { class: 'btn block', href: '#/on/critical' }, 'Ôn câu điểm liệt'),
    h('a', { class: 'btn block', href: '#/thi' }, 'Thi thử')));
}
