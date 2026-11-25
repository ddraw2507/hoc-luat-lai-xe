// Đọc văn bản bằng speechSynthesis. iOS: phải bắt đầu từ thao tác chạm, cắt câu dài, giọng nạp bất đồng bộ.

/** Cắt thành các đoạn ≤ max ký tự, ưu tiên ranh giới câu rồi dấu phẩy rồi khoảng trắng. */
export function chunkText(text, max = 200) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?;:…])\s+/);
  const out = [];
  const push = (s) => { if (s) out.push(s); };
  // chia một câu quá dài tại dấu phẩy, rồi tại khoảng trắng; trả phần dư chưa đẩy ra
  const splitLong = (s) => {
    let buf = '';
    for (const p of s.split(/(?<=,)\s+/)) {
      if (p.length > max) {
        push(buf); buf = '';
        let rest = p;
        while (rest.length > max) {
          let cut = rest.lastIndexOf(' ', max);
          if (cut <= 0) cut = max;
          push(rest.slice(0, cut).trim());
          rest = rest.slice(cut).trim();
        }
        buf = rest;
      } else if ((buf + ' ' + p).trim().length > max) { push(buf); buf = p; }
      else buf = (buf + ' ' + p).trim();
    }
    return buf;
  };
  let cur = '';
  for (const s of sentences) {
    if (s.length > max) { push(cur); cur = splitLong(s); continue; }
    if ((cur + ' ' + s).trim().length > max) { push(cur); cur = s; }
    else cur = (cur + ' ' + s).trim();
  }
  push(cur);
  return out;
}

const synth = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
export const supported = () => !!synth() && typeof SpeechSynthesisUtterance !== 'undefined';

export function getViVoices() {
  const s = synth();
  if (!s) return [];
  return s.getVoices().filter((v) => /^vi([-_]|$)/i.test(v.lang));
}

/** Gọi cb mỗi khi danh sách giọng sẵn sàng/thay đổi (iOS nạp trễ). Trả hàm huỷ. */
export function onVoices(cb) {
  const s = synth();
  if (!s) return () => {};
  const f = () => cb(getViVoices());
  s.addEventListener('voiceschanged', f);
  f();
  return () => s.removeEventListener('voiceschanged', f);
}

let session = 0;
let state = 'idle'; // idle | playing | paused
let listener = null;
export function onState(cb) { listener = cb; }
function setState(s) { state = s; if (listener) listener(s); }
export const getState = () => state;

/** Phải gọi trực tiếp từ handler của thao tác chạm. */
export function speak(text, { rate = 1, voiceURI = '' } = {}) {
  const s = synth();
  if (!s) return false;
  s.cancel();
  const my = ++session;
  const chunks = chunkText(text, 200);
  if (!chunks.length) return false;
  const voices = getViVoices();
  const voice = voices.find((v) => v.voiceURI === voiceURI) || voices[0] || null;
  chunks.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c);
    u.lang = voice ? voice.lang : 'vi-VN';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = () => { if (my === session && i === chunks.length - 1) setState('idle'); };
    u.onerror = (e) => { if (my === session && e.error !== 'interrupted' && e.error !== 'canceled') setState('idle'); };
    s.speak(u);
  });
  setState('playing');
  return true;
}

export function pause() { const s = synth(); if (s && state === 'playing') { s.pause(); setState('paused'); } }
export function resume() { const s = synth(); if (s && state === 'paused') { s.resume(); setState('playing'); } }
export function stop() { const s = synth(); session++; if (s) s.cancel(); setState('idle'); listener = null; }
