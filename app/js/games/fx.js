// Hiệu ứng: âm thanh tổng hợp (Web Audio) và pháo giấy. Không file âm thanh, không rung.
import { h } from '../util.js';
import * as store from '../store.js';

export const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let ctx = null;

/** Tạo AudioContext lần đầu — chỉ gọi từ trong handler chạm của người dùng. */
export function ensureAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // tôn trọng nút gạt im lặng của iPhone
      if (navigator.audioSession) { try { navigator.audioSession.type = 'ambient'; } catch { /* */ } }
      ctx = new AC();
    }
    // Safari có thể để 'interrupted' sau cuộc gọi / khi app vào nền
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch { ctx = null; }
  return ctx;
}

const NOTES = {
  right: [[660, 0], [880, 0.1]],
  wrong: [[180, 0]],
  record: [[660, 0], [880, 0.1], [1175, 0.2]],
};

/** kind: 'right' | 'wrong' | 'record'. Tắt khi game.sound === false. */
export function playSound(kind) {
  if (!store.get().game.sound) return;
  const ac = ensureAudio();
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const [freq, at] of NOTES[kind] || []) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = kind === 'wrong' ? 'sawtooth' : 'sine';
    o.frequency.value = freq;
    const len = kind === 'wrong' ? 0.28 : 0.14;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    o.connect(g); g.connect(ac.destination);
    o.start(t0 + at); o.stop(t0 + at + len + 0.02);
  }
}

const COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'];

/** Pháo giấy ngắn; bỏ qua khi người dùng chọn giảm chuyển động. */
export function confetti() {
  if (reducedMotion()) return;
  const layer = h('div', { class: 'confetti-layer', 'aria-hidden': 'true' });
  for (let i = 0; i < 36; i++) {
    const p = h('i', { class: 'confetti-p' });
    p.style.left = Math.round(Math.random() * 100) + '%';
    p.style.background = COLORS[i % COLORS.length];
    p.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
    p.style.animationDuration = (1.2 + Math.random() * 0.8).toFixed(2) + 's';
    p.style.setProperty('--dx', Math.round(Math.random() * 120 - 60) + 'px');
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2400);
}

/** Rung nhẹ bằng CSS (class .shake); không làm gì khi giảm chuyển động. */
export function shake(el) {
  if (reducedMotion() || !el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 450);
}
