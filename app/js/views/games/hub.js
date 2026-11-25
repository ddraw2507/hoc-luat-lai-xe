// Trang Chơi (#/choi) và trang Huy hiệu (#/choi/huy-hieu).
import { h } from '../../util.js';
import { loadData } from '../../data.js';
import * as store from '../../store.js';
import { BADGES, levelFor, activeStreak, dayKey, buildStages } from '../../games/logic.js';
import { setSound } from '../../games/progress.js';
import { ensureAudio } from '../../games/fx.js';
import { bar } from './ui.js';

/** Thẻ cấp độ + thanh XP (dùng ở trang Chơi và Trang chủ). */
export function levelCard(g) {
  const lv = levelFor(g.xp);
  return h('div', { class: 'card levelcard' },
    h('div', { class: 'toprow' }, h('b', {}, `Cấp ${lv.level} · ${lv.name}`), h('span', { class: 'grow' }), h('span', { class: 'sub' }, `${g.xp} XP`)),
    bar(lv.pct), h('div', { class: 'sub' }, `${lv.into}/${lv.need} XP để lên cấp ${lv.level + 1}`));
}

export async function play(el) {
  await loadData();
  const g = store.get().game;
  const streak = activeStreak(g.streak, dayKey());
  const nBadges = BADGES.filter((b) => g.badges[b.id]).length;

  const soundBtn = h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Bật hoặc tắt âm thanh', onclick: () => {
    const on = !store.get().game.sound;
    setSound(on);
    if (on) ensureAudio();
    soundBtn.textContent = on ? '🔊' : '🔇';
  } }, g.sound ? '🔊' : '🔇');

  const card = (href, emoji, title, desc, rec) => h('a', { class: 'card link gamecard', href },
    h('span', { class: 'gemoji' }, emoji),
    h('div', { class: 'ginfo' }, h('b', {}, title), h('div', { class: 'sub' }, desc), rec ? h('div', { class: 'rec' }, rec) : null),
    h('span', { class: 'chev' }, '›'));

  const stars = Object.values(g.stages).reduce((a, n) => a + n, 0);
  const done = Object.values(g.stages).filter((n) => n > 0).length;
  const total = buildStages((await loadData()).questions).length;

  el.append(h('div', { class: 'toprow' }, h('h1', {}, 'Chơi'), h('span', { class: 'grow' }), soundBtn),
    levelCard(g),
    h('div', { class: 'stats3' },
      h('div', { class: 'card center' }, h('div', { class: 'big' }, '🔥 ' + streak), h('div', { class: 'sub' }, 'ngày liền')),
      h('a', { class: 'card center', href: '#/choi/huy-hieu' }, h('div', { class: 'big' }, `🏅 ${nBadges}/${BADGES.length}`), h('div', { class: 'sub' }, 'huy hiệu ›')),
      h('div', { class: 'card center' }, h('div', { class: 'big' }, '⭐ ' + stars), h('div', { class: 'sub' }, 'sao đã đạt'))),
    card('#/choi/hanh-trinh', '🗺️', 'Hành trình', 'Qua từng chặng 10 câu, lấy tối đa 3 sao', `${done}/${total} chặng đã qua`),
    card('#/choi/chop-nhoang', '⚡', 'Chớp nhoáng', '60 giây, trả lời càng nhanh càng nhiều điểm', g.best.chop ? `Kỷ lục: ${g.best.chop} điểm` : 'Chưa có kỷ lục'),
    card('#/choi/sinh-ton', '❤️', 'Sinh tồn', '3 mạng, mỗi câu có đồng hồ riêng', g.best.sinhTon ? `Kỷ lục: ${g.best.sinhTon} câu` : 'Chưa có kỷ lục'),
    card('#/choi/dung-sai', '✅', 'Đúng hay Sai?', '20 lượt phán đoán nhanh, vuốt phải/trái', g.best.dungSai ? `Kỷ lục: ${g.best.dungSai} điểm` : 'Chưa có kỷ lục'),
    card('#/choi/ghep-bien', '🚸', 'Ghép biển báo', 'Nối 5 biển báo với ý nghĩa của chúng', g.best.ghepBien ? `Nhanh nhất: ${g.best.ghepBien.toFixed(1)} giây` : 'Chưa có kỷ lục'));
}

export async function badgesView(el) {
  await loadData();
  const g = store.get().game;
  el.append(h('div', { class: 'toprow' }, h('a', { class: 'btn small', href: '#/choi' }, '‹ Chơi'), h('h1', {}, 'Huy hiệu')),
    h('p', { class: 'sub' }, `Đã mở ${BADGES.filter((b) => g.badges[b.id]).length}/${BADGES.length} huy hiệu.`));
  const list = h('div', { class: 'badges' });
  for (const b of BADGES) {
    const got = !!g.badges[b.id];
    list.append(h('div', { class: 'card bcard' + (got ? '' : ' locked') },
      h('span', { class: 'bemoji' }, got ? b.emoji : '🔒'),
      h('div', {}, h('b', {}, b.name), h('div', { class: 'sub' }, b.desc), got ? h('div', { class: 'sub' }, 'Đã mở ✓') : null)));
  }
  el.append(list);
}
