import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStages, stageUnlocked, nextStage, starsFor, comboMultiplier, updateStreak, activeStreak, prevDay, dayKey,
  levelFor, isReferential, makeTrueFalse, tfRound, tfUsable, tfPoints, survivalSeconds, survivalPick, signsRound,
  BADGES, newBadges,
} from '../../app/js/games/logic.js';
import { normalize } from '../../app/js/store.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');
const QS = JSON.parse(fs.readFileSync(path.join(APP, 'data/questions.json'), 'utf8')).questions;
const SIGNS = JSON.parse(fs.readFileSync(path.join(APP, 'data/signs.json'), 'utf8')).pairs;
function lcg(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

test('chặng: đúng 62 chặng, đúng cỡ từng chương, chặng cuối có thể ít hơn 10', () => {
  const st = buildStages(QS);
  assert.equal(st.length, 62);
  const per = {};
  for (const s of st) per[s.chapter] = (per[s.chapter] || 0) + 1;
  assert.deepEqual(per, { 1: 18, 2: 3, 3: 6, 4: 4, 5: 19, 6: 12 });
  assert.equal(new Set(st.map((s) => s.id)).size, 62);
  assert.equal(st[0].id, 'c1-1');
  assert.equal(st.reduce((a, s) => a + s.ids.length, 0), 600);
  for (const s of st) assert.ok(s.ids.length >= 1 && s.ids.length <= 10);
  // chương 1 có 180 câu = 18 chặng đủ 10; chương 2 có 25 câu → chặng cuối 5 câu
  assert.equal(st.find((s) => s.id === 'c2-3').ids.length, 5);
  assert.equal(st.find((s) => s.id === 'c1-18').ids.length, 10);
});

test('chặng: mở khoá theo sao chặng trước, chặng 1 mỗi chương luôn mở, nextStage', () => {
  const st = buildStages(QS);
  const c1 = st.filter((s) => s.chapter === 1);
  assert.equal(stageUnlocked(c1[0], st, {}), true);
  assert.equal(stageUnlocked(c1[1], st, {}), false);
  assert.equal(stageUnlocked(c1[1], st, { 'c1-1': 1 }), true);
  assert.equal(stageUnlocked(st.find((s) => s.id === 'c2-1'), st, {}), true);
  assert.equal(nextStage(st, {}).id, 'c1-1');
  assert.equal(nextStage(st, { 'c1-1': 2 }).id, 'c1-2');
  const all = Object.fromEntries(st.map((s) => [s.id, 1]));
  assert.equal(nextStage(st, all), null);
});

test('sao: 100% = 3, ≥80% = 2, ≥60% = 1, dưới 60% = 0; sai điểm liệt tối đa 1', () => {
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(9, 10), 2);
  assert.equal(starsFor(8, 10), 2);
  assert.equal(starsFor(7, 10), 1);
  assert.equal(starsFor(6, 10), 1);
  assert.equal(starsFor(5, 10), 0);
  assert.equal(starsFor(0, 0), 0);
  assert.equal(starsFor(9, 10, true), 1);
  assert.equal(starsFor(5, 10, true), 0);
  assert.equal(starsFor(4, 5), 2);
});

test('hệ số combo', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 20].map(comboMultiplier), [1, 1, 1, 2, 2, 3, 3]);
});

test('chuỗi ngày: cùng ngày giữ, hôm qua +1, cách ngày về 1, qua tháng/năm/năm nhuận', () => {
  assert.deepEqual(updateStreak({ days: 4, last: '2026-03-10' }, '2026-03-10'), { days: 4, last: '2026-03-10' });
  assert.deepEqual(updateStreak({ days: 4, last: '2026-03-09' }, '2026-03-10'), { days: 5, last: '2026-03-10' });
  assert.deepEqual(updateStreak({ days: 4, last: '2026-03-07' }, '2026-03-10'), { days: 1, last: '2026-03-10' });
  assert.deepEqual(updateStreak({ days: 0, last: '' }, '2026-03-10'), { days: 1, last: '2026-03-10' });
  assert.deepEqual(updateStreak({ days: 2, last: '2026-01-31' }, '2026-02-01'), { days: 3, last: '2026-02-01' });
  assert.deepEqual(updateStreak({ days: 9, last: '2025-12-31' }, '2026-01-01'), { days: 10, last: '2026-01-01' });
  assert.deepEqual(updateStreak({ days: 1, last: '2024-02-29' }, '2024-03-01'), { days: 2, last: '2024-03-01' });
  assert.deepEqual(updateStreak({ days: 1, last: '2025-02-28' }, '2025-03-01'), { days: 2, last: '2025-03-01' });
  assert.equal(prevDay('2026-01-01'), '2025-12-31');
  assert.equal(prevDay('2026-03-01'), '2026-02-28');
  assert.equal(activeStreak({ days: 5, last: '2026-03-09' }, '2026-03-10'), 5);
  assert.equal(activeStreak({ days: 5, last: '2026-03-08' }, '2026-03-10'), 0);
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('cấp độ: 1 + floor(sqrt(xp/40))', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(39).level, 1);
  assert.equal(levelFor(40).level, 2);
  assert.equal(levelFor(159).level, 2);
  assert.equal(levelFor(160).level, 3);
  assert.equal(levelFor(3600).level, 10);
  assert.equal(levelFor(0).name, 'Tập lái');
  assert.equal(levelFor(40 * 25).name, 'Lái thử');
  assert.equal(levelFor(40 * 400).name, 'Tài xế mẫu mực');
  assert.equal(levelFor(100).pct, Math.round(((100 - 40) / (160 - 40)) * 100));
});

test('Đúng/Sai: phương án tham chiếu bị loại, có 515 câu dùng được', () => {
  for (const t of ['Cả hai ý trên.', 'Cả ba ý trên.', 'Ý 1 và ý 2.', 'Ý 2 và ý 3', 'Không ý nào đúng.', 'Tất cả các ý trên', 'Cả hai biển.']) assert.equal(isReferential(t), true, t);
  for (const t of ['Được phép.', 'Buông cả hai tay khi lái xe.', 'Chỉ được phép nếu cả hai đội mũ bảo hiểm.']) assert.equal(isReferential(t), false, t);
  assert.equal(QS.filter(tfUsable).length, 515);
});

test('Đúng/Sai: không bao giờ hiện phương án tham chiếu, ~50% là đáp án đúng, isTrue khớp', () => {
  const rng = lcg(42);
  let total = 0, trues = 0;
  for (let k = 0; k < 200; k++) {
    for (const r of tfRound(QS, 20, rng)) {
      const q = QS.find((x) => x.id === r.qid);
      assert.equal(isReferential(r.text), false);
      assert.equal(r.text, q.options[r.optionIndex]);
      assert.equal(r.isTrue, r.optionIndex === q.answer);
      total++; if (r.isTrue) trues++;
    }
  }
  assert.equal(total, 4000);
  assert.ok(Math.abs(trues / total - 0.5) < 0.02, `tỉ lệ đúng ${trues / total}`);
  assert.equal(new Set(tfRound(QS, 20, lcg(3)).map((r) => r.qid)).size, 20);
  const bad = QS.find((q) => isReferential(q.options[q.answer]));
  assert.equal(makeTrueFalse(bad, true), null);
  assert.equal(tfPoints(true, 2000), 15);
  assert.equal(tfPoints(true, 3000), 10);
  assert.equal(tfPoints(false, 100), 0);
});

test('Sinh tồn: thời gian mỗi câu và chọn câu không lặp', () => {
  assert.deepEqual([0, 4, 5, 10, 55, 60, 100].map(survivalSeconds), [20, 20, 19, 18, 9, 8, 8]);
  const used = new Set();
  const rng = lcg(5);
  for (let i = 0; i < 300; i++) {
    const q = survivalPick(QS, {}, used, rng);
    assert.ok(!used.has(q.id));
    used.add(q.id);
  }
  assert.equal(survivalPick(QS.slice(0, 3), {}, new Set([1, 2, 3])), null);
  // ưu tiên câu sai: 1/3 số lần lấy từ nhóm sai, phần còn lại ngẫu nhiên (300/600 sai)
  const many = {};
  QS.slice(0, 300).forEach((q) => { many[q.id] = { last: 'wrong' }; });
  let w = 0; const r2 = lcg(8);
  for (let i = 0; i < 3000; i++) { const q = survivalPick(QS, many, new Set(), r2); if (many[q.id]) w++; }
  assert.ok(w / 3000 > 0.6 && w / 3000 < 0.75, `tỉ lệ ${w / 3000}`);
});

test('Ghép biển: 5 cặp khác nhau, hai cột là cùng một tập', () => {
  const r = signsRound(SIGNS, 5, lcg(1));
  assert.equal(r.left.length, 5);
  assert.deepEqual(r.left.map((p) => p.id).sort(), r.right.map((p) => p.id).sort());
  assert.equal(new Set(r.left.map((p) => p.id)).size, 5);
});

const ctx = { stages: buildStages(QS), criticalIds: QS.filter((q) => q.critical).map((q) => q.id) };
const fresh = () => normalize({});

test('huy hiệu: có 18 huy hiệu, id duy nhất, trạng thái trống không mở gì', () => {
  assert.equal(BADGES.length, 18);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 18);
  assert.deepEqual(newBadges(fresh(), ctx), []);
});

test('huy hiệu: điều kiện từng loại', () => {
  const ids = (s) => newBadges(s, ctx);
  let s = fresh();
  s.stats[1] = { right: 9, wrong: 0, last: 'right' };
  assert.ok(!ids(s).includes('khoi-dong'));
  s.stats[2] = { right: 1, wrong: 0, last: 'right' };
  assert.ok(ids(s).includes('khoi-dong'));

  s = fresh(); s.game.streak.days = 3;
  assert.deepEqual(ids(s), ['ba-ngay']);
  s.game.streak.days = 7; assert.deepEqual(ids(s), ['ba-ngay', 'mot-tuan']);
  s.game.streak.days = 30; assert.deepEqual(ids(s), ['ba-ngay', 'mot-tuan', 'ky-luat-thep']);

  s = fresh(); s.game.bestCombo = 9; assert.ok(!ids(s).includes('combo-10'));
  s.game.bestCombo = 10; assert.ok(ids(s).includes('combo-10'));
  s.game.best.chop = 299; assert.ok(!ids(s).includes('tia-chop'));
  s.game.best.chop = 300; assert.ok(ids(s).includes('tia-chop'));
  s.game.best.sinhTon = 49; assert.ok(!ids(s).includes('sinh-ton-50'));
  s.game.best.sinhTon = 50; assert.ok(ids(s).includes('sinh-ton-50'));
  s.game.perfectSigns = true; assert.ok(ids(s).includes('mat-dieu-hau'));

  s = fresh();
  for (const id of ctx.criticalIds.slice(1)) s.stats[id] = { right: 1, wrong: 0, last: 'right' };
  assert.ok(!ids(s).includes('khong-so-diem-liet'));
  s.stats[ctx.criticalIds[0]] = { right: 1, wrong: 1, last: 'wrong' };
  assert.ok(!ids(s).includes('khong-so-diem-liet'));
  s.stats[ctx.criticalIds[0]].last = 'right';
  assert.ok(ids(s).includes('khong-so-diem-liet'));
  assert.equal(ctx.criticalIds.length, 60);

  s = fresh();
  for (const st of ctx.stages.filter((x) => x.chapter === 2)) s.game.stages[st.id] = 1;
  assert.deepEqual(ids(s), ['chuong-2']);
  s.game.stages['c2-1'] = 0;
  assert.deepEqual(ids(s), []);

  s = fresh();
  ctx.stages.slice(0, 9).forEach((st) => { s.game.stages[st.id] = 3; });
  assert.ok(!ids(s).includes('ba-sao-10'));
  s.game.stages[ctx.stages[9].id] = 3;
  assert.ok(ids(s).includes('ba-sao-10'));
  s.game.stages[ctx.stages[9].id] = 2;
  assert.ok(!ids(s).includes('ba-sao-10'));

  s = fresh();
  s.history = [{ passed: false }, { passed: true }];
  assert.deepEqual(ids(s), ['do-thi-thu']);
  s.history = [{ passed: true }, { passed: true }, { passed: true }, { passed: true }, { passed: false }];
  assert.ok(!ids(s).includes('phong-do'));
  s.history[4].passed = true;
  assert.ok(ids(s).includes('phong-do'));

  s = fresh(); s.game.streak.days = 3; s.game.badges['ba-ngay'] = 1;
  assert.deepEqual(ids(s), []);
});

test('store.normalize: ép kiểu khoá game', () => {
  const g = normalize({ game: { xp: '12', streak: { days: -5, last: 'hôm qua' }, best: { chop: 'x', ghepBien: '12.5' }, stages: { 'c1-1': 7, 'c1-2': 'a' },
    badges: { a: 'zz' }, sound: 'yes', bestCombo: null } }).game;
  assert.equal(g.xp, 12);
  assert.deepEqual(g.streak, { days: 0, last: '' });
  assert.equal(g.best.chop, 0);
  assert.equal(g.best.ghepBien, 12.5);
  assert.equal(g.stages['c1-1'], 3);
  assert.equal(g.stages['c1-2'], 0);
  assert.equal(g.sound, true);
  assert.equal(g.bestCombo, 0);
  assert.deepEqual(normalize({ game: 5 }).game, normalize({}).game);
  assert.deepEqual(normalize({ game: [1] }).game, normalize({}).game);
});
