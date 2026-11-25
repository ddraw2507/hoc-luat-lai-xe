// Logic thuần (không DOM) cho sinh đề và chấm điểm — có test bằng `node --test tools/app/`.

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sinh đề. Trả về mảng câu hỏi (đã trộn thứ tự câu, KHÔNG trộn các ý trả lời).
 * Nếu ngân hàng ít câu hơn `count` thì lấy những gì có.
 */
export function generateExam(questions, structure, rng = Math.random) {
  const count = structure.count;
  const critical = questions.filter((q) => q.critical);
  const normal = questions.filter((q) => !q.critical);

  const picked = shuffle(critical, rng).slice(0, Math.min(structure.criticalCount || 0, count));
  const used = new Set(picked.map((q) => q.id));
  const room = () => count - picked.length;

  if (structure.perChapter) {
    for (const [chap, n] of Object.entries(structure.perChapter)) {
      const pool = shuffle(normal.filter((q) => String(q.chapter) === String(chap) && !used.has(q.id)), rng);
      for (const q of pool.slice(0, Math.min(n, room()))) { picked.push(q); used.add(q.id); }
    }
  }
  // Phần còn lại (perChapter null, hoặc perChapter chưa đủ số câu): ngẫu nhiên từ các câu thường chưa lấy.
  if (room() > 0) {
    const rest = shuffle(normal.filter((q) => !used.has(q.id)), rng).slice(0, room());
    rest.forEach((q) => { picked.push(q); used.add(q.id); });
  }
  return shuffle(picked, rng);
}

/**
 * Chấm điểm. answers: { [questionId]: chỉ số ý đã chọn }.
 * Đạt khi đúng ≥ passScore và không sai (kể cả bỏ trống) câu điểm liệt nào.
 * Nếu đề thực tế ít câu hơn passScore (ngân hàng nhỏ) thì ngưỡng đạt = số câu của đề.
 */
export function gradeExam(questions, answers, structure) {
  let correct = 0;
  const criticalWrong = [];
  const wrong = [];
  let unanswered = 0;
  for (const q of questions) {
    const a = answers[q.id];
    if (a === undefined || a === null) unanswered++;
    if (a === q.answer) correct++;
    else {
      wrong.push(q.id);
      if (q.critical) criticalWrong.push(q.id);
    }
  }
  const need = Math.min(structure.passScore, questions.length);
  const passed = questions.length > 0 && correct >= need && criticalWrong.length === 0;
  let reason = '';
  if (criticalWrong.length) reason = 'Sai câu điểm liệt';
  else if (correct < need) reason = `Chưa đủ số câu đúng (cần ≥ ${need})`;
  return { correct, total: questions.length, need, passed, criticalWrong, wrong, unanswered, reason };
}
