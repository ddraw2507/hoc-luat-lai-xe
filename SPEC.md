# Học Luật Lái Xe — PWA cho iPhone

App web cài lên màn hình chính iPhone (iOS 18, iPhone 16) để học lý thuyết và ôn thi GPLX hạng B.
Chạy hoàn toàn offline sau lần mở đầu, không cần đăng nhập, dữ liệu học lưu trên máy.

## Ràng buộc kỹ thuật

- HTML + CSS + JavaScript thuần (ES modules), **không có bước build**, không dùng npm package lúc chạy.
  Phải host được như site tĩnh (GitHub Pages / Vercel) ở một thư mục con bất kỳ → mọi đường dẫn đều tương đối.
- Thư mục app: `app/`. Dữ liệu: `app/data/questions.json`, `app/data/lessons.json`, `app/data/exam.json`, ảnh câu hỏi `app/data/img/`.
- Định tuyến bằng hash (`#/hoc`, `#/hoc/<lessonId>`, `#/on`, `#/on/<mode>`, `#/thi`, `#/thi/ket-qua`, `#/thong-ke`, `#/cai-dat`).
- Lưu tiến độ trong `localStorage` dưới một khoá duy nhất `hlx.v1` (JSON). Mọi đọc/ghi bọc try/catch; app vẫn chạy khi storage hỏng (bắt đầu lại từ trống).
- Service worker `app/sw.js`: precache toàn bộ app shell + 3 file JSON + mọi ảnh liệt kê trong `questions.json`
  (tạo danh sách lúc install bằng cách đọc `questions.json`). Chiến lược cache-first, đổi `CACHE_VERSION` để cập nhật.
  Có thông báo nhỏ "Đã có bản mới — chạm để tải lại" khi SW mới sẵn sàng.
- `app/manifest.webmanifest`: name "Học Luật Lái Xe", short_name "Luật Lái Xe", display standalone, start_url "./", scope "./",
  theme/background color, icon 192 và 512 (PNG). Thêm `apple-touch-icon` 180×180, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style` = `default`, `apple-mobile-web-app-title`.
- Viewport `width=device-width, initial-scale=1, viewport-fit=cover`; dùng `env(safe-area-inset-*)` cho thanh tab dưới và header.
- Giao diện tiếng Việt, font hệ thống (`-apple-system, system-ui`), chế độ sáng/tối theo `prefers-color-scheme`.
  Vùng chạm tối thiểu 44×44 px. Không cuộn ngang ở 375 px. Chữ thân bài 17 px, chỉnh được trong Cài đặt (15–22 px).
- Icon app: vẽ bằng script Python (Pillow nếu có, nếu không thì viết PNG thủ công) — hình tròn/biển báo cách điệu, không dùng logo của ai.

## Dữ liệu (định dạng cố định — app chỉ đọc theo đúng định dạng này)

### `questions.json`
```json
{
  "source": "Bộ 600 câu hỏi — Công văn 2262/CSGT-P5 ngày 07/05/2025",
  "chapters": [ { "id": 1, "name": "Quy định chung và quy tắc giao thông đường bộ" } ],
  "questions": [
    {
      "id": 1,                     // số câu 1..600 theo bộ đề
      "chapter": 1,                // id chương
      "text": "Nội dung câu hỏi",
      "options": ["Ý 1", "Ý 2", "Ý 3"],   // 2–4 ý
      "answer": 0,                 // chỉ số ý đúng (0-based)
      "critical": false,           // true = câu điểm liệt
      "image": "img/q001.png"      // hoặc null; đường dẫn tương đối với app/data/
    }
  ]
}
```

### `lessons.json`
```json
{
  "parts": [
    {
      "id": "luat", "title": "Luật Trật tự, an toàn giao thông đường bộ",
      "groups": [
        {
          "title": "Chương 1. Quy định chung",
          "lessons": [
            { "id": "luat-1-1", "num": "1.1", "title": "Phạm vi điều chỉnh",
              "source": "Điều 1, Luật 36/2024/QH15 (VBHN 55/VBHN-VPQH)",
              "html": "<p>…</p>" }      // null = chưa có nội dung → hiện "Nội dung đang được cập nhật"
          ]
        }
      ]
    }
  ]
}
```
`html` chỉ gồm `<p> <ol> <ul> <li> <b> <i> <h3> <h4> <table> <tr> <td> <th> <img>`. Hiển thị bằng innerHTML sau khi lọc
bỏ mọi thẻ/thuộc tính khác (viết hàm sanitize đơn giản theo whitelist; `<img>` chỉ giữ `src` tương đối và `alt`).

### `exam.json`
```json
{
  "default": "B-2025",
  "structures": [
    { "id": "B-2025", "label": "Hạng B — hiện hành", "note": "…",
      "count": 30, "minutes": 20, "passScore": 27,
      "criticalCount": 1,                       // số câu điểm liệt trong đề
      "perChapter": { "1": 8, "2": 1 }          // số câu lấy từ mỗi chương (không tính câu điểm liệt); null = ngẫu nhiên toàn bộ
    }
  ]
}
```
Sinh đề: lấy `criticalCount` câu ngẫu nhiên trong các câu `critical`, rồi lấy theo `perChapter` từ các câu không critical
(nếu `perChapter` null: lấy ngẫu nhiên phần còn lại từ toàn bộ câu không critical). Trộn thứ tự câu. **Không** trộn thứ tự
các ý trả lời (đề thật giữ nguyên thứ tự). Đạt khi số câu đúng ≥ `passScore` **và** không sai câu điểm liệt nào.

## Màn hình

1. **Trang chủ** (`#/`): lời chào ngắn, cấu trúc đề đang chọn (vd "30 câu · 20 phút · đúng ≥ 27 · không sai câu điểm liệt"),
   tiến độ: số bài đã học / tổng, số câu đã làm đúng / 600, số câu đang sai, nút nhanh: "Học tiếp", "Ôn câu điểm liệt",
   "Thi thử". Nếu có `examDate` trong cài đặt: đếm ngược số ngày.
2. **Học** (`#/hoc`): danh sách phần → nhóm → bài (accordion), mỗi bài có dấu ✓ nếu đã học, bài `html: null` hiện mờ
   với nhãn "Sắp có". Ô tìm kiếm lọc theo tiêu đề và nội dung (bỏ dấu tiếng Việt khi so khớp).
   **Bài học** (`#/hoc/<id>`): tiêu đề, nguồn, nội dung; thanh công cụ: Nghe (đọc bằng `speechSynthesis`, giọng `vi-VN`
   nếu có — chia văn bản thành câu ≤ 200 ký tự rồi đọc nối tiếp, vì iOS cắt câu dài; có Tạm dừng/Tiếp tục/Dừng; tốc độ
   0.8–1.4), cỡ chữ, nút "Đánh dấu đã học", Bài trước / Bài sau. Tự lưu vị trí cuộn của bài đang đọc.
3. **Ôn tập** (`#/on`): các chế độ — theo chương (hiện số câu và % đúng mỗi chương), 60 câu điểm liệt, câu đang sai,
   câu đã đánh dấu sao, câu chưa làm, toàn bộ 600 câu. Màn làm câu (`#/on/<mode>`): một câu mỗi màn, ảnh (nếu có, chạm để
   phóng to), các ý dạng nút lớn đánh số 1-2-3-4. Chọn xong hiện ngay đúng/sai (xanh/đỏ, đánh dấu ý đúng), nút "Câu tiếp".
   Thanh tiến độ trên cùng, nút sao, lưới số câu để nhảy nhanh (bottom sheet). Câu điểm liệt có nhãn đỏ "Điểm liệt".
   Ghi nhận mỗi lần trả lời: `stats[id] = { right, wrong, last: "right"|"wrong", ts }`. "Câu đang sai" = `last === "wrong"`.
4. **Thi thử** (`#/thi`): chọn cấu trúc đề (từ `exam.json`), nút Bắt đầu. Màn thi: đồng hồ đếm ngược, lưới câu để nhảy,
   chọn ý không hiện đúng/sai, nút Nộp bài (xác nhận nếu còn câu chưa làm), tự nộp khi hết giờ. Trạng thái đề đang thi lưu
   vào storage để không mất khi app bị iOS tắt nền. **Kết quả** (`#/thi/ket-qua`): ĐẠT / KHÔNG ĐẠT, điểm, lý do (sai câu
   điểm liệt nào), xem lại từng câu với đáp án đúng. Lưu lịch sử 50 lần thi gần nhất (ngày, cấu trúc, điểm, đạt/không).
5. **Thống kê** (`#/thong-ke`): % đúng theo chương (thanh ngang), lịch sử thi thử (danh sách), số bài đã học.
6. **Cài đặt** (`#/cai-dat`): cấu trúc đề mặc định, ngày thi dự kiến, cỡ chữ, tốc độ đọc, chọn giọng đọc (liệt kê giọng vi),
   xuất/nhập tiến độ (tải file JSON / dán JSON), xoá toàn bộ tiến độ (xác nhận 2 bước), mục "Giới thiệu": nguồn dữ liệu,
   ghi chú "App ôn tập cá nhân, không thay thế giờ học bắt buộc trên hệ thống của cơ sở đào tạo", hướng dẫn cài lên iPhone
   (Safari → Chia sẻ → Thêm vào MH chính).

Thanh tab dưới: Trang chủ · Học · Ôn tập · Thi thử · Thống kê (Cài đặt mở từ biểu tượng bánh răng trên header).

## Kiểm tra (bắt buộc trước khi báo xong)

- `tools/check_app.py` (hoặc `.mjs` chạy bằng Node 24): kiểm tra JSON đúng định dạng trên, mọi ảnh được tham chiếu tồn tại,
  mọi file trong danh sách precache tồn tại, không có đường dẫn tuyệt đối `/…` trong HTML/JS/manifest.
- Chạy server tĩnh `python -m http.server 8765 -d app` và tự kiểm bằng script Node (không cần trình duyệt): tải `index.html`,
  `manifest.webmanifest`, `sw.js`, 3 file JSON → 200. Logic sinh đề và chấm điểm tách ra module thuần (`app/js/exam.js`) và
  có test bằng `node --test` (đúng số câu, đúng số câu điểm liệt, không trùng câu, chấm ĐẠT/KHÔNG ĐẠT đúng luật).
