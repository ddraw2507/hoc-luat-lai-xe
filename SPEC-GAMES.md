# Phần trò chơi — "Vừa học vừa chơi"

Bổ sung cho [SPEC.md](SPEC.md). Mục tiêu: ôn bộ 600 câu theo cách đỡ nhàm, có động lực quay lại mỗi ngày.
Mọi ràng buộc kỹ thuật của SPEC.md vẫn giữ nguyên (JS thuần, không build, offline, đường dẫn tương đối, tiếng Việt,
vùng chạm ≥ 44 px, 375 px không cuộn ngang, sáng/tối, iOS Safari).

## Điều hướng

- Thanh tab dưới: **Trang chủ · Học · Ôn tập · Chơi · Thi thử** (tab "Chơi" icon 🎮 thay vị trí tab Thống kê).
- Thống kê vẫn ở `#/thong-ke`, mở từ: biểu tượng 📊 trên header (cạnh bánh răng) và một thẻ trên Trang chủ.
- Trang chủ thêm: chuỗi ngày 🔥, cấp độ + thanh XP, nút "Chơi tiếp" (mở chặng Hành trình kế tiếp chưa đạt).

## Hệ thống động lực (lưu trong store, khoá `game`)

```js
game: {
  xp: 0,
  streak: { days: 0, last: '' },        // last = 'YYYY-MM-DD' theo GIỜ MÁY (không UTC)
  best: { chop: 0, sinhTon: 0, dungSai: 0, ghepBien: 0 },   // ghepBien = số giây nhanh nhất (0 = chưa có)
  bestCombo: 0,
  stages: {},                            // stageId -> số sao 0..3 (cao nhất từng đạt)
  badges: {},                            // badgeId -> ts mở khoá
  sound: true,
}
```
`normalize()` phải ép kiểu các trường này như với `settings` (số hữu hạn ≥ 0, object, boolean).

- **XP:** trả lời đúng trong trò chơi +10 (Chớp nhoáng: +10 × hệ số combo); trả lời đúng ở Ôn tập +2; thi thử ĐẠT +50;
  mỗi sao *mới* đạt được ở Hành trình +5. **Cấp:** `level = 1 + floor(sqrt(xp / 40))`; thanh tiến độ tới cấp sau.
  Tên cấp theo bậc (gợi ý): Tập lái → Lái thử → Vững tay lái → Tài xế cẩn thận → Tài xế mẫu mực (mỗi 5 cấp một tên).
- **Chuỗi ngày 🔥:** cập nhật khi trả lời bất kỳ câu nào (ôn tập, thi thử, trò chơi). `last` = hôm nay → giữ;
  `last` = hôm qua → `days + 1`; khác → `days = 1`. Ngày tính bằng giờ máy (đúng cả qua tháng/năm).
- **Mọi câu trả lời trong trò chơi** cũng ghi vào `stats[id]` (giống Ôn tập) để "Câu đang sai" phản ánh cả trò chơi.
  Riêng Đúng/Sai: ghi đúng/sai cho câu gốc theo việc người chơi phán đúng hay không.
- **Huy hiệu 🏅** (định nghĩa trong code, mỗi cái: id, tên, mô tả, emoji, hàm điều kiện trên store):
  1. Khởi động — trả lời đúng 10 câu bất kỳ
  2. Ba ngày liền — chuỗi 3 ngày · 3. Một tuần bền bỉ — 7 ngày · 4. Kỷ luật thép — 30 ngày
  5. Combo 10 — combo ≥ 10 trong Chớp nhoáng · 6. Tia chớp — Chớp nhoáng ≥ 300 điểm
  7. Sinh tồn 50 — Sinh tồn ≥ 50 câu · 8. Mắt diều hâu — Ghép biển báo 0 lần sai
  9. Không sợ điểm liệt — cả 60 câu điểm liệt có `stats.last === 'right'`
  10–15. Hoàn thành chương 1…6 — mọi chặng của chương ≥ 1 sao
  16. Ba sao x10 — 10 chặng 3 sao · 17. Đỗ thi thử — lần đầu thi thử ĐẠT · 18. Phong độ — 5 lần thi thử ĐẠT liên tiếp
  Mở huy hiệu mới → toast "🏅 <tên>" + hiệu ứng pháo giấy (tắt khi `prefers-reduced-motion`). Trang huy hiệu `#/choi/huy-hieu`
  hiện tất cả, cái chưa mở hiện mờ kèm điều kiện.
- **Âm thanh:** tiếng bíp tổng hợp bằng Web Audio (không file âm thanh): đúng (2 nốt lên), sai (nốt trầm), kỷ lục (3 nốt).
  Tạo `AudioContext` lần đầu khi người dùng chạm; đặt `navigator.audioSession.type = 'ambient'` nếu có (tôn trọng nút gạt im lặng).
  Bật/tắt trong Cài đặt và nút 🔊 ở trang Chơi. Không dùng rung (iOS Safari không hỗ trợ `navigator.vibrate`).

## Trang Chơi (`#/choi`)

Đầu trang: cấp + thanh XP, 🔥 chuỗi ngày, số huy hiệu (chạm → `#/choi/huy-hieu`). Dưới là 5 thẻ trò chơi, mỗi thẻ có
mô tả 1 dòng và kỷ lục cá nhân.

### 1. Hành trình 🗺️ (`#/choi/hanh-trinh`, chơi chặng: `#/choi/hanh-trinh/<stageId>`)
- Chia mỗi chương theo thứ tự số câu thành chặng 10 câu (chặng cuối của chương có thể ít hơn) → 18+3+6+4+19+12 = **62 chặng**.
  `stageId` = `c<chương>-<thứ tự chặng từ 1>`.
- Bản đồ: các chặng xếp thành đường đi theo từng chương (nút tròn có số chặng, sao đã đạt, ổ khoá). Chặng 1 của mỗi chương
  luôn mở; chặng sau mở khi chặng trước ≥ 1 sao.
- Chơi chặng: câu theo thứ tự ngẫu nhiên, báo đúng/sai ngay như Ôn tập, có nút "Câu tiếp". Hết chặng: % đúng →
  3 sao = 100 %, 2 sao ≥ 80 %, 1 sao ≥ 60 %, dưới 60 % = 0 sao (chưa qua). Sai câu điểm liệt thì tối đa 1 sao
  (ghi lý do). Lưu sao cao nhất; nút "Chơi lại", "Chặng tiếp".

### 2. Chớp nhoáng ⚡ (`#/choi/chop-nhoang`)
- Chọn nguồn câu: Tất cả / một chương / Câu đang sai (nếu ≥ 5 câu). 60 giây, đồng hồ theo `Date.now()` (không đếm nhịp).
- Đúng: điểm += 10 × hệ số (combo 0–2 → ×1, 3–5 → ×2, ≥ 6 → ×3), combo +1. Sai: combo về 0, trừ 5 giây, hiện đáp án đúng 0,8 s.
  Chọn xong là sang câu tiếp ngay (không cần bấm "Câu tiếp").
- Hết giờ: điểm, số câu đúng, combo cao nhất, "Kỷ lục mới!" nếu vượt; danh sách câu sai để xem lại.

### 3. Sinh tồn ❤️ (`#/choi/sinh-ton`)
- 3 mạng. Câu ngẫu nhiên không lặp, ưu tiên xen câu đang sai (khoảng 1/3). Mỗi câu có đồng hồ riêng: bắt đầu 20 s,
  cứ 5 câu đúng giảm 1 s, tối thiểu 8 s. Sai hoặc hết giờ → mất 1 mạng; **sai câu điểm liệt → mất hết mạng** ("Điểm liệt!").
- Điểm = số câu đúng. Kết thúc: điểm, kỷ lục, các câu đã sai.

### 4. Đúng hay Sai? ✅❌ (`#/choi/dung-sai`)
- 20 lượt. Mỗi lượt: câu hỏi (+ảnh) và **một** phương án; người chơi chọn "Đúng" hoặc "Sai" (nút lớn; vuốt phải = Đúng,
  vuốt trái = Sai bằng pointer events, ngưỡng 80 px).
- Phương án hiện: 50 % là đáp án đúng, 50 % là một phương án sai ngẫu nhiên của chính câu đó. **Bỏ** các phương án
  tham chiếu ("Cả hai ý trên", "Cả ba ý trên", "Ý 1 và ý 2", "Không ý nào…", "Tất cả…"); câu có đáp án đúng là phương án
  tham chiếu thì không dùng. (Đã đếm: còn 515 câu dùng được.)
- Điểm: đúng +10, trả lời < 3 s thêm +5. Sau mỗi lượt hiện ngắn đáp án đúng của câu.

### 5. Ghép biển báo 🚸 (`#/choi/ghep-bien`)
- Dữ liệu `app/data/signs.json` (`{source, pairs:[{id, image, meaning}]}`, 21 cặp, sinh bởi `tools/data/build_signs.py`).
- Mỗi ván 5 cặp ngẫu nhiên: cột trái 5 ảnh biển, cột phải 5 ý nghĩa (trộn riêng). Chạm một ảnh rồi một ý nghĩa
  (hoặc ngược lại): đúng → cả hai chuyển xanh và khoá; sai → rung nhẹ (CSS), lỗi +1. Đồng hồ đếm lên.
- Hết ván: thời gian, số lỗi, kỷ lục thời gian (chỉ tính ván 0–2 lỗi). Ghi `stats[id]` đúng cho mỗi cặp ghép đúng
  lần đầu, sai cho cặp bị ghép nhầm (theo ảnh).
- Trên màn hẹp: ảnh 72 px, chữ ý nghĩa 14 px, cho phép xuống dòng.

## Kỹ thuật

- Logic thuần (không DOM) trong `app/js/games/logic.js`: chia chặng, tính sao, hệ số combo, cập nhật chuỗi ngày (nhận ngày
  làm tham số để test), cấp từ XP, tạo lượt Đúng/Sai, chọn câu Sinh tồn, điều kiện huy hiệu. View trong `app/js/views/games/*.js`.
- Thêm `data/signs.json` và mọi file JS mới vào `SHELL` của `sw.js`; tăng `CACHE_VERSION` lên `v6`. `check_app.mjs` phải
  kiểm cả `signs.json` (định dạng, ảnh tồn tại).
- Trạng thái ván đang chơi giữ trong bộ nhớ (thoát giữa chừng thì bỏ ván), trừ kỷ lục / XP / sao / huy hiệu lưu ngay.
- Rời màn hình (routechange) phải dừng mọi `setInterval`/`requestAnimationFrame` của trò chơi.
- Test `node --test tools/app/`: thêm test cho logic.js (62 chặng đúng cỡ; sao; combo; chuỗi ngày qua ngày/tháng/năm,
  cùng ngày, cách ngày; cấp; Đúng/Sai không bao giờ hiện phương án tham chiếu và tỉ lệ đúng ~50 %; điều kiện huy hiệu).
