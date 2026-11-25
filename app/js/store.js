// Lưu tiến độ trong localStorage, một khoá duy nhất `hlx.v1`. Hỏng/không có storage thì chạy trong bộ nhớ.
const KEY = 'hlx.v1';

function defaultGame() {
  return {
    xp: 0,
    streak: { days: 0, last: '' },   // last = 'YYYY-MM-DD' theo giờ máy
    best: { chop: 0, sinhTon: 0, dungSai: 0, ghepBien: 0 },   // ghepBien = giây nhanh nhất (0 = chưa có)
    bestCombo: 0,
    stages: {},    // stageId -> số sao 0..3 cao nhất
    badges: {},    // badgeId -> ts mở khoá
    sound: true,
    perfectSigns: false,   // đã từng ghép biển báo không sai lần nào (điều kiện huy hiệu Mắt diều hâu)
  };
}

export function defaults() {
  return {
    v: 1,
    settings: { examId: null, examDate: '', fontSize: 17, rate: 1, voice: '' },
    learned: {},   // lessonId -> ts
    scroll: {},    // lessonId -> scrollY
    stats: {},     // questionId -> {right, wrong, last, ts}
    stars: {},     // questionId -> true
    exam: null,    // bài thi đang làm
    lastResult: null,
    history: [],   // 50 lần thi gần nhất
    game: defaultGame(),
  };
}

/** Gộp với mặc định để thiếu trường cũng không vỡ. */
export function normalize(obj) {
  const d = defaults();
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return d;
  const o = { ...d, ...obj, settings: { ...d.settings, ...(obj.settings || {}) } };
  // dữ liệu nhập tay / bản cũ có thể sai kiểu → ép về kiểu đúng để màn hình không vỡ
  const st = o.settings;
  const num = (v, lo, hi, dflt) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, Number(v))) : dflt);
  st.rate = num(st.rate, 0.8, 1.4, d.settings.rate);
  st.fontSize = Math.round(num(st.fontSize, 15, 22, d.settings.fontSize));
  for (const k of ['examDate', 'voice']) if (typeof st[k] !== 'string') st[k] = '';
  if (st.examId !== null && typeof st.examId !== 'string') st.examId = null;
  for (const k of ['learned', 'scroll', 'stats', 'stars']) if (!o[k] || typeof o[k] !== 'object') o[k] = {};
  o.game = normalizeGame(obj.game);
  if (!Array.isArray(o.history)) o.history = [];
  o.history = o.history.filter(isObj).slice(0, 50);
  // stats[id] phải là object {right, wrong, last, ts}; mục hỏng (vd nhập tay) bị bỏ để recordAnswer không lỗi
  for (const [id, v] of Object.entries(o.stats)) {
    if (!isObj(v)) { delete o.stats[id]; continue; }
    v.right = Math.floor(nonNeg(v.right));
    v.wrong = Math.floor(nonNeg(v.wrong));
    if (v.last !== 'right' && v.last !== 'wrong') v.last = null;
  }
  return o;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const nonNeg = (v) => (v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

function normalizeGame(g) {
  const d = defaultGame();
  if (!isObj(g)) return d;
  const st = isObj(g.streak) ? g.streak : {};
  const b = isObj(g.best) ? g.best : {};
  const stages = {};
  if (isObj(g.stages)) for (const [k, v] of Object.entries(g.stages)) stages[k] = Math.min(3, Math.floor(nonNeg(v)));
  const badges = {};
  if (isObj(g.badges)) for (const [k, v] of Object.entries(g.badges)) badges[k] = nonNeg(v) || 1;
  return {
    xp: Math.floor(nonNeg(g.xp)),
    streak: { days: Math.floor(nonNeg(st.days)), last: typeof st.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(st.last) ? st.last : '' },
    best: { chop: Math.floor(nonNeg(b.chop)), sinhTon: Math.floor(nonNeg(b.sinhTon)), dungSai: Math.floor(nonNeg(b.dungSai)), ghepBien: nonNeg(b.ghepBien) },
    bestCombo: Math.floor(nonNeg(g.bestCombo)),
    stages, badges,
    sound: typeof g.sound === 'boolean' ? g.sound : d.sound,
    perfectSigns: g.perfectSigns === true,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return normalize(JSON.parse(raw));
  } catch { return defaults(); }
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage đầy/bị chặn: bỏ qua */ }
}

export const get = () => state;

export function update(fn) { fn(state); save(); }

export function replaceAll(obj) { state = normalize(obj); save(); }

export function reset() { state = defaults(); try { localStorage.removeItem(KEY); } catch { /* */ } }

export function exportJson() { return JSON.stringify(state, null, 1); }
