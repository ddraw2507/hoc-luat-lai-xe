import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateExam, gradeExam, shuffle } from '../../app/js/exam.js';
import { chunkText } from '../../app/js/tts.js';

// ngân hàng giả: 3 chương x 40 câu, 10 câu điểm liệt (chương 1)
function bank() {
  const qs = [];
  let id = 1;
  for (let ch = 1; ch <= 3; ch++) {
    for (let i = 0; i < 40; i++) {
      qs.push({ id: id++, chapter: ch, text: 't', options: ['a', 'b', 'c'], answer: i % 3, critical: ch === 1 && i < 10, image: null });
    }
  }
  return qs;
}
// rng xác định để test lặp lại được
function lcg(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

const S25 = { count: 30, minutes: 20, passScore: 27, criticalCount: 1, perChapter: null };

test('đúng số câu, đúng số câu điểm liệt, không trùng', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ex = generateExam(bank(), S25, lcg(seed));
    assert.equal(ex.length, 30);
    assert.equal(ex.filter((q) => q.critical).length, 1);
    assert.equal(new Set(ex.map((q) => q.id)).size, 30);
  }
});

test('perChapter: lấy đúng số câu mỗi chương (không tính điểm liệt)', () => {
  const st = { count: 21, minutes: 20, passScore: 18, criticalCount: 1, perChapter: { 1: 8, 2: 6, 3: 6 } };
  const ex = generateExam(bank(), st, lcg(7));
  assert.equal(ex.length, 21);
  assert.equal(ex.filter((q) => q.critical).length, 1);
  const non = ex.filter((q) => !q.critical);
  assert.equal(non.filter((q) => q.chapter === 1).length, 8);
  assert.equal(non.filter((q) => q.chapter === 2).length, 6);
  assert.equal(non.filter((q) => q.chapter === 3).length, 6);
});

test('không trộn thứ tự các ý trả lời', () => {
  const ex = generateExam(bank(), S25, lcg(3));
  for (const q of ex) assert.deepEqual(q.options, ['a', 'b', 'c']);
});

test('ngân hàng nhỏ hơn count: lấy những gì có, không lỗi', () => {
  const small = bank().slice(8, 20); // 2 câu điểm liệt + 10 câu thường
  const ex = generateExam(small, S25, lcg(5));
  assert.equal(ex.length, 11); // 1 điểm liệt (criticalCount) + 10 câu thường
  assert.equal(new Set(ex.map((q) => q.id)).size, 11);
  assert.deepEqual(generateExam([], S25), []);
  // ngân hàng không có câu điểm liệt
  const none = bank().filter((q) => !q.critical);
  assert.equal(generateExam(none, S25, lcg(2)).filter((q) => q.critical).length, 0);
});

test('shuffle giữ nguyên tập phần tử', () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(shuffle(a, lcg(9)).sort(), a);
});

function answersAll(ex, wrongIds = [], blankIds = []) {
  const a = {};
  for (const q of ex) {
    if (blankIds.includes(q.id)) continue;
    a[q.id] = wrongIds.includes(q.id) ? (q.answer + 1) % 3 : q.answer;
  }
  return a;
}

test('chấm: đúng hết → ĐẠT', () => {
  const ex = generateExam(bank(), S25, lcg(11));
  const g = gradeExam(ex, answersAll(ex), S25);
  assert.equal(g.correct, 30);
  assert.equal(g.passed, true);
});

test('chấm: đúng 27/30 và không sai điểm liệt → ĐẠT; 26/30 → KHÔNG ĐẠT', () => {
  const ex = generateExam(bank(), S25, lcg(12));
  const normal = ex.filter((q) => !q.critical).map((q) => q.id);
  const g27 = gradeExam(ex, answersAll(ex, normal.slice(0, 3)), S25);
  assert.equal(g27.correct, 27);
  assert.equal(g27.passed, true);
  const g26 = gradeExam(ex, answersAll(ex, normal.slice(0, 4)), S25);
  assert.equal(g26.correct, 26);
  assert.equal(g26.passed, false);
});

test('chấm: sai câu điểm liệt → KHÔNG ĐẠT dù đủ điểm; bỏ trống điểm liệt cũng trượt', () => {
  const ex = generateExam(bank(), S25, lcg(13));
  const crit = ex.find((q) => q.critical).id;
  const g = gradeExam(ex, answersAll(ex, [crit]), S25);
  assert.equal(g.correct, 29);
  assert.equal(g.passed, false);
  assert.deepEqual(g.criticalWrong, [crit]);
  const g2 = gradeExam(ex, answersAll(ex, [], [crit]), S25);
  assert.equal(g2.passed, false);
  assert.equal(g2.unanswered, 1);
});

test('chấm: cấu trúc 50 câu / đạt 45', () => {
  const S27 = { count: 50, minutes: 33, passScore: 45, criticalCount: 1, perChapter: null };
  const ex = generateExam(bank(), S27, lcg(14));
  assert.equal(ex.length, 50);
  const normal = ex.filter((q) => !q.critical).map((q) => q.id);
  assert.equal(gradeExam(ex, answersAll(ex, normal.slice(0, 5)), S27).passed, true);
  assert.equal(gradeExam(ex, answersAll(ex, normal.slice(0, 6)), S27).passed, false);
});

test('chunkText: mỗi đoạn ≤ 200 ký tự, không mất chữ', () => {
  const long = Array.from({ length: 60 }, (_, i) => `từ${i}`).join(' ') + '. ' +
    Array.from({ length: 80 }, (_, i) => `ý${i}`).join(', ') + '! Câu ngắn. ' + 'x'.repeat(450);
  const chunks = chunkText(long, 200);
  assert.ok(chunks.length > 3);
  for (const c of chunks) assert.ok(c.length <= 200, `đoạn dài ${c.length}`);
  const norm = (s) => s.replace(/\s+/g, '');
  assert.equal(norm(chunks.join(' ')), norm(long));
  assert.deepEqual(chunkText('   '), []);
});
