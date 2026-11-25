// Lưu tiến độ trong localStorage, một khoá duy nhất `hlx.v1`. Hỏng/không có storage thì chạy trong bộ nhớ.
const KEY = 'hlx.v1';

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
  if (!Array.isArray(o.history)) o.history = [];
  o.history = o.history.slice(0, 50);
  return o;
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

export function recordAnswer(id, isRight) {
  update((s) => {
    const st = s.stats[id] || { right: 0, wrong: 0, last: null, ts: 0 };
    if (isRight) st.right++; else st.wrong++;
    st.last = isRight ? 'right' : 'wrong';
    st.ts = Date.now();
    s.stats[id] = st;
  });
}
