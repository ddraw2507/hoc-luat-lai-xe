// Ghi nhận tiến độ dùng chung cho Ôn tập, Thi thử và trò chơi: stats, chuỗi ngày, XP, sao, kỷ lục, huy hiệu.
import * as store from '../store.js';
import { toast } from '../util.js';
import { peekData } from '../data.js';
import { dayKey, updateStreak, newBadges, BADGES, buildStages } from './logic.js';
import { confetti, playSound } from './fx.js';

let ctxCache = null;
function badgeCtx() {
  const data = peekData();
  if (!data) return null;
  if (!ctxCache || ctxCache.n !== data.questions.length) {
    ctxCache = { n: data.questions.length, stages: buildStages(data.questions), criticalIds: data.questions.filter((q) => q.critical).map((q) => q.id) };
  }
  return ctxCache;
}

/** Mở huy hiệu mới (nếu đủ điều kiện), báo toast + pháo giấy. Trả mảng id vừa mở. */
export function checkBadges() {
  const ctx = badgeCtx();
  if (!ctx) return [];
  const fresh = newBadges(store.get(), ctx);
  if (!fresh.length) return [];
  const now = Date.now();
  store.update((s) => { for (const id of fresh) s.game.badges[id] = now; });
  const defs = fresh.map((id) => BADGES.find((b) => b.id === id));
  toast(defs.map((b) => `🏅 ${b.name}`).join(' · '));
  confetti();
  playSound('record');
  return fresh;
}

/**
 * Ghi một câu trả lời: stats[id], chuỗi ngày, XP (nếu có). `check` = false khi ghi hàng loạt (gọi checkBadges sau).
 * Dùng cho Ôn tập (+2 XP khi đúng), trò chơi (+10 XP khi đúng) và thi thử (0 XP mỗi câu).
 */
export function recordAnswer(id, isRight, xp = 0, check = true) {
  const now = Date.now();
  store.update((s) => {
    const st = s.stats[id] || { right: 0, wrong: 0, last: null, ts: 0 };
    if (isRight) st.right++; else st.wrong++;
    st.last = isRight ? 'right' : 'wrong';
    st.ts = now;
    s.stats[id] = st;
    s.game.streak = updateStreak(s.game.streak, dayKey(new Date(now)));
    if (xp > 0) s.game.xp += xp;
  });
  if (check) checkBadges();
}

export function addXp(n) {
  if (n > 0) store.update((s) => { s.game.xp += n; });
}

/** Sau khi nộp bài thi thử (lịch sử đã ghi): ĐẠT +50 XP, rồi kiểm huy hiệu. */
export function finishExam(passed) {
  if (passed) addXp(50);
  checkBadges();
}

/** Lưu sao cao nhất của chặng; mỗi sao mới +5 XP. Trả số sao mới đạt thêm. */
export function saveStage(stageId, stars) {
  let gained = 0;
  store.update((s) => {
    const old = s.game.stages[stageId] || 0;
    if (stars > old) { gained = stars - old; s.game.stages[stageId] = stars; s.game.xp += gained * 5; }
  });
  checkBadges();
  return gained;
}

/** Lưu kỷ lục (cao hơn là tốt; lowerIsBetter cho thời gian). Trả true nếu phá kỷ lục. */
export function saveBest(key, value, lowerIsBetter = false) {
  let isRecord = false;
  store.update((s) => {
    const old = s.game.best[key] || 0;
    if (lowerIsBetter ? (value > 0 && (old === 0 || value < old)) : value > old) { s.game.best[key] = value; isRecord = true; }
  });
  checkBadges();
  return isRecord;
}

export function saveBestCombo(n) {
  store.update((s) => { if (n > s.game.bestCombo) s.game.bestCombo = n; });
  checkBadges();
}

export function setPerfectSigns() {
  store.update((s) => { s.game.perfectSigns = true; });
  checkBadges();
}

export function setSound(on) {
  store.update((s) => { s.game.sound = !!on; });
}
