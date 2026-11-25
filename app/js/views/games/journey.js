// Hành trình: bản đồ chặng (#/choi/hanh-trinh) và màn chơi một chặng (#/choi/hanh-trinh/<stageId>).
import { h, toast, pct } from '../../util.js';
import { loadData } from '../../data.js';
import * as store from '../../store.js';
import { go } from '../../router.js';
import { shuffle } from '../../exam.js';
import { buildStages, stageUnlocked, starsFor, followingStage } from '../../games/logic.js';
import { recordAnswer, saveStage } from '../../games/progress.js';
import { confetti, playSound } from '../../games/fx.js';
import { questionCard } from '../question.js';
import { bar, gameTop } from './ui.js';

const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export async function journeyMap(el) {
  const data = await loadData();
  const stages = buildStages(data.questions);
  const stars = store.get().game.stages;
  el.append(gameTop('Hành trình 🗺️'), h('p', { class: 'sub' }, 'Qua mỗi chặng với ít nhất 1 sao (đúng ≥ 60 %) để mở chặng kế tiếp.'));
  for (const c of data.chapters) {
    const list = stages.filter((s) => s.chapter === c.id);
    const done = list.filter((s) => stars[s.id] > 0).length;
    el.append(h('h2', {}, `Chương ${c.id} · ${done}/${list.length} chặng`), h('div', { class: 'subsmall sub' }, c.name));
    const path = h('div', { class: 'stagepath' });
    list.forEach((s) => {
      const open = stageUnlocked(s, stages, stars);
      const n = stars[s.id] || 0;
      const node = h(open ? 'a' : 'button', {
        class: 'stage' + (open ? '' : ' locked') + (n ? ' done' : ''),
        href: open ? '#/choi/hanh-trinh/' + s.id : null, type: open ? null : 'button',
        'aria-label': `Chặng ${s.index} chương ${c.id}${open ? '' : ' (đang khoá)'}`,
        onclick: open ? null : () => toast('Qua chặng trước với ít nhất 1 sao để mở khoá'),
      }, h('span', { class: 'snum' }, open ? String(s.index) : '🔒'), h('span', { class: 'sstars' }, h('b', {}, '★'.repeat(n)), '☆'.repeat(3 - n)));
      path.append(node);
    });
    el.append(path);
  }
}

export async function stageRun(el, { id }) {
  const data = await loadData();
  const stages = buildStages(data.questions);
  const stage = stages.find((s) => s.id === id);
  if (!stage) { go('/choi/hanh-trinh'); return; }
  if (!stageUnlocked(stage, stages, store.get().game.stages)) { toast('Chặng này chưa mở'); go('/choi/hanh-trinh'); return; }

  const qs = shuffle(stage.ids.map((x) => data.byId.get(x)).filter(Boolean));
  const picks = {};
  let idx = 0;

  const draw = () => {
    el.replaceChildren();
    if (idx >= qs.length) return finish();
    const q = qs[idx];
    const answered = picks[q.id] !== undefined;
    el.append(gameTop(`Chương ${stage.chapter} · chặng ${stage.index}`, h('span', { class: 'sub' }, `${idx + 1}/${qs.length}`)),
      bar(pct(idx + (answered ? 1 : 0), qs.length)),
      questionCard(q, { number: idx + 1, picked: picks[q.id], reveal: answered, onPick: (i) => {
        if (picks[q.id] !== undefined) return;
        picks[q.id] = i;
        const ok = i === q.answer;
        playSound(ok ? 'right' : 'wrong');
        recordAnswer(q.id, ok, ok ? 10 : 0);
        draw();
        window.scrollTo(0, document.body.scrollHeight);
      } }),
      h('div', { class: 'row sticky-actions' },
        h('button', { class: 'btn primary', disabled: answered ? null : true, onclick: () => { idx++; draw(); window.scrollTo(0, 0); } },
          idx === qs.length - 1 ? 'Xem kết quả' : 'Câu tiếp ›')));
  };

  const finish = () => {
    const correct = qs.filter((q) => picks[q.id] === q.answer).length;
    const critWrong = qs.some((q) => q.critical && picks[q.id] !== q.answer);
    const raw = starsFor(correct, qs.length, false);
    const n = starsFor(correct, qs.length, critWrong);
    const before = store.get().game.stages[stage.id] || 0;
    const gained = saveStage(stage.id, n);
    if (n === 3) { confetti(); playSound('record'); }
    const next = followingStage(stage, stages);
    const nextOpen = next && stageUnlocked(next, stages, store.get().game.stages);
    el.append(gameTop(`Chương ${stage.chapter} · chặng ${stage.index}`),
      h('div', { class: 'card center ' + (n ? 'pass' : 'fail') },
        h('div', { class: 'verdict' }, n ? 'Qua chặng!' : 'Chưa qua chặng'),
        h('div', { class: 'bigstars' }, starText(n)),
        h('div', { class: 'big' }, `${correct}/${qs.length} đúng · ${pct(correct, qs.length)}%`),
        critWrong && raw > n ? h('div', { class: 'reason' }, 'Sai câu điểm liệt nên tối đa 1 sao.') : null,
        !n && !critWrong ? h('div', { class: 'sub' }, 'Cần đúng ≥ 60 % để qua chặng.') : null,
        !n && critWrong ? h('div', { class: 'reason' }, 'Cần đúng ≥ 60 % để qua chặng. Chú ý câu điểm liệt.') : null,
        gained ? h('div', { class: 'sub' }, `+${gained * 5} XP cho ${gained} sao mới`) : (before ? h('div', { class: 'sub' }, `Kỷ lục chặng này: ${starText(before)}`) : null)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { stageRun(el, { id }); } }, 'Chơi lại'),
        nextOpen ? h('a', { class: 'btn primary', href: '#/choi/hanh-trinh/' + next.id }, 'Chặng tiếp ›') : h('a', { class: 'btn primary', href: '#/choi/hanh-trinh' }, 'Bản đồ')),
      h('a', { class: 'btn block', href: '#/choi/hanh-trinh' }, 'Về bản đồ'));
    window.scrollTo(0, 0);
  };

  draw();
}
