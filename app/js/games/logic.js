// Logic thuần (không DOM) của phần trò chơi — có test bằng `node --test tools/app/`.
import { shuffle } from '../exam.js';

export const STAGE_SIZE = 10;

/** Chia mỗi chương theo thứ tự số câu thành chặng 10 câu. stageId = c<chương>-<thứ tự chặng từ 1>. */
export function buildStages(questions) {
  const byChap = new Map();
  for (const q of questions) {
    if (!byChap.has(q.chapter)) byChap.set(q.chapter, []);
    byChap.get(q.chapter).push(q);
  }
  const stages = [];
  for (const chapter of [...byChap.keys()].sort((a, b) => a - b)) {
    const ids = byChap.get(chapter).slice().sort((a, b) => a.id - b.id).map((q) => q.id);
    for (let i = 0, n = 1; i < ids.length; i += STAGE_SIZE, n++) {
      stages.push({ id: `c${chapter}-${n}`, chapter, index: n, ids: ids.slice(i, i + STAGE_SIZE) });
    }
  }
  return stages;
}

/** Chặng 1 của mỗi chương luôn mở; các chặng sau mở khi chặng trước ≥ 1 sao. */
export function stageUnlocked(stage, stages, stars) {
  if (stage.index === 1) return true;
  const prev = stages.find((s) => s.chapter === stage.chapter && s.index === stage.index - 1);
  return !prev || (stars[prev.id] || 0) >= 1;
}

/** Chặng kế tiếp chưa đạt (0 sao) và đã mở; null nếu hết. */
export function nextStage(stages, stars) {
  return stages.find((s) => !(stars[s.id] > 0) && stageUnlocked(s, stages, stars)) || null;
}

/** Chặng đứng ngay sau `stage` trong bản đồ (qua chương cũng được) hoặc null. */
export function followingStage(stage, stages) {
  const i = stages.findIndex((s) => s.id === stage.id);
  return i >= 0 && i < stages.length - 1 ? stages[i + 1] : null;
}

/** 3 sao = 100 %, 2 sao ≥ 80 %, 1 sao ≥ 60 %, còn lại 0. Sai câu điểm liệt thì tối đa 1 sao. */
export function starsFor(correct, total, criticalWrong = false) {
  if (!total) return 0;
  const p = correct / total;
  let n = p >= 1 ? 3 : p >= 0.8 ? 2 : p >= 0.6 ? 1 : 0;
  if (criticalWrong && n > 1) n = 1;
  return n;
}

/** Hệ số combo (Chớp nhoáng), tính theo combo trước khi cộng: 0–2 → ×1, 3–5 → ×2, ≥ 6 → ×3. */
export function comboMultiplier(combo) {
  return combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
}

// ---- Ngày & chuỗi ngày (giờ máy, không UTC) ----

const p2 = (n) => String(n).padStart(2, '0');

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Ngày liền trước của 'YYYY-MM-DD' (tính thuần theo lịch, đúng qua tháng/năm/năm nhuận). */
export function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

/** Trả streak mới: last = hôm nay → giữ; last = hôm qua → days + 1; khác → days = 1. */
export function updateStreak(streak, today) {
  const last = streak && typeof streak.last === 'string' ? streak.last : '';
  const days = streak && Number.isFinite(streak.days) ? streak.days : 0;
  if (last === today) return { days: Math.max(1, days), last };
  if (last && last === prevDay(today)) return { days: days + 1, last: today };
  return { days: 1, last: today };
}

/** Số ngày chuỗi đang hiển thị: đã đứt (last không phải hôm nay/hôm qua) thì 0. */
export function activeStreak(streak, today) {
  if (!streak || !streak.last) return 0;
  return streak.last === today || streak.last === prevDay(today) ? streak.days : 0;
}

// ---- Cấp độ ----

export const LEVEL_NAMES = ['Tập lái', 'Lái thử', 'Vững tay lái', 'Tài xế cẩn thận', 'Tài xế mẫu mực'];

export function levelFor(xp) {
  const x = Math.max(0, xp || 0);
  const level = 1 + Math.floor(Math.sqrt(x / 40));
  const from = 40 * (level - 1) ** 2;
  const to = 40 * level ** 2;
  return {
    level, name: LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((level - 1) / 5))],
    from, to, into: x - from, need: to - from, pct: Math.round(((x - from) / (to - from)) * 100),
  };
}

// ---- Đúng / Sai ----

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().trim();

const REFERENTIAL = /^(ca (hai|ba|bon|2|3|4)\b|tat ca\b|(cac )?y ?\d|khong (co )?y nao|(ca )?(hai|ba) y\b|deu (dung|sai))/;

/** Phương án tham chiếu các ý khác ("Cả hai ý trên", "Ý 1 và ý 2", "Không ý nào…", "Tất cả…") — không dùng trong Đúng/Sai. */
export function isReferential(text) {
  return REFERENTIAL.test(fold(text));
}

export function tfUsable(q) {
  return !isReferential(q.options[q.answer]) && q.options.some((o, i) => i !== q.answer && !isReferential(o));
}

/** Một lượt Đúng/Sai: wantTrue = true → hiện đáp án đúng; false → một phương án sai (không tham chiếu). */
export function makeTrueFalse(q, wantTrue, rng = Math.random) {
  if (!tfUsable(q)) return null;
  let idx = q.answer;
  if (!wantTrue) {
    const wrongs = q.options.map((o, i) => i).filter((i) => i !== q.answer && !isReferential(q.options[i]));
    idx = wrongs[Math.floor(rng() * wrongs.length)];
  }
  return { qid: q.id, optionIndex: idx, text: q.options[idx], isTrue: idx === q.answer };
}

/** n lượt, đúng một nửa là "Đúng" (xáo trộn), mỗi câu gốc một lần. */
export function tfRound(questions, n = 20, rng = Math.random) {
  const pool = shuffle(questions.filter(tfUsable), rng).slice(0, n);
  const flags = shuffle(pool.map((_, i) => i < Math.ceil(pool.length / 2)), rng);
  return pool.map((q, i) => makeTrueFalse(q, flags[i], rng));
}

/** Điểm một lượt Đúng/Sai: đúng +10, trả lời < 3 s thêm +5. */
export function tfPoints(correct, ms) {
  return correct ? 10 + (ms < 3000 ? 5 : 0) : 0;
}

// ---- Sinh tồn ----

/** Giây cho mỗi câu: bắt đầu 20, cứ 5 câu đúng giảm 1, tối thiểu 8. */
export function survivalSeconds(correctCount) {
  return Math.max(8, 20 - Math.floor(correctCount / 5));
}

/**
 * Chọn câu kế tiếp: không lặp (used = Set id), khoảng 1/3 lần ưu tiên câu đang sai (stats[id].last === 'wrong').
 * Hết câu chưa dùng thì trả null.
 */
export function survivalPick(questions, stats, used, rng = Math.random) {
  const fresh = questions.filter((q) => !used.has(q.id));
  if (!fresh.length) return null;
  const wrong = fresh.filter((q) => stats[q.id] && stats[q.id].last === 'wrong');
  const pool = wrong.length && rng() < 1 / 3 ? wrong : fresh;
  return pool[Math.floor(rng() * pool.length)];
}

// ---- Ghép biển báo ----

/** Một ván: n cặp ngẫu nhiên; cột trái (ảnh) và phải (ý nghĩa) trộn riêng. */
export function signsRound(pairs, n = 5, rng = Math.random) {
  const pick = shuffle(pairs, rng).slice(0, Math.min(n, pairs.length));
  return { left: shuffle(pick, rng), right: shuffle(pick, rng) };
}

// ---- Huy hiệu ----

const sumRight = (s) => Object.values(s.stats || {}).reduce((a, x) => a + ((x && x.right) || 0), 0);
const chapterDone = (c) => (s, ctx) => {
  const list = ctx.stages.filter((st) => st.chapter === c);
  return list.length > 0 && list.every((st) => (s.game.stages[st.id] || 0) >= 1);
};

/** id, tên, mô tả (= điều kiện), emoji, test(state, ctx). ctx = { stages, criticalIds }. */
export const BADGES = [
  { id: 'khoi-dong', name: 'Khởi động', emoji: '🚦', desc: 'Trả lời đúng 10 câu bất kỳ', test: (s) => sumRight(s) >= 10 },
  { id: 'ba-ngay', name: 'Ba ngày liền', emoji: '🔥', desc: 'Chuỗi 3 ngày', test: (s) => s.game.streak.days >= 3 },
  { id: 'mot-tuan', name: 'Một tuần bền bỉ', emoji: '📅', desc: 'Chuỗi 7 ngày', test: (s) => s.game.streak.days >= 7 },
  { id: 'ky-luat-thep', name: 'Kỷ luật thép', emoji: '🛡️', desc: 'Chuỗi 30 ngày', test: (s) => s.game.streak.days >= 30 },
  { id: 'combo-10', name: 'Combo 10', emoji: '⚡', desc: 'Combo ≥ 10 trong Chớp nhoáng', test: (s) => s.game.bestCombo >= 10 },
  { id: 'tia-chop', name: 'Tia chớp', emoji: '🌩️', desc: 'Chớp nhoáng từ 300 điểm', test: (s) => s.game.best.chop >= 300 },
  { id: 'sinh-ton-50', name: 'Sinh tồn 50', emoji: '❤️', desc: 'Sinh tồn từ 50 câu', test: (s) => s.game.best.sinhTon >= 50 },
  { id: 'mat-dieu-hau', name: 'Mắt diều hâu', emoji: '🦅', desc: 'Ghép biển báo không sai lần nào', test: (s) => s.game.perfectSigns === true },
  { id: 'khong-so-diem-liet', name: 'Không sợ điểm liệt', emoji: '🎯', desc: 'Cả 60 câu điểm liệt đang đúng',
    test: (s, ctx) => ctx.criticalIds.length > 0 && ctx.criticalIds.every((id) => s.stats[id] && s.stats[id].last === 'right') },
  ...[1, 2, 3, 4, 5, 6].map((c) => ({ id: `chuong-${c}`, name: `Hoàn thành chương ${c}`, emoji: '🗺️',
    desc: `Mọi chặng chương ${c} đạt ≥ 1 sao`, test: chapterDone(c) })),
  { id: 'ba-sao-10', name: 'Ba sao x10', emoji: '🌟', desc: '10 chặng đạt 3 sao',
    test: (s) => Object.values(s.game.stages).filter((n) => n >= 3).length >= 10 },
  { id: 'do-thi-thu', name: 'Đỗ thi thử', emoji: '🎓', desc: 'Thi thử ĐẠT lần đầu', test: (s) => s.history.some((r) => r.passed) },
  { id: 'phong-do', name: 'Phong độ', emoji: '🏆', desc: '5 lần thi thử ĐẠT liên tiếp',
    test: (s) => s.history.length >= 5 && s.history.slice(0, 5).every((r) => r.passed) },
];

/** Id các huy hiệu thoả điều kiện nhưng chưa mở. */
export function newBadges(state, ctx) {
  return BADGES.filter((b) => !state.game.badges[b.id] && b.test(state, ctx)).map((b) => b.id);
}
