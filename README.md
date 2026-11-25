# Học Luật Lái Xe — PWA cho iPhone

App học lý thuyết và ôn thi GPLX hạng B, cài lên màn hình chính iPhone qua Safari, chạy offline.
Đặc tả: [SPEC.md](SPEC.md). Mục lục bài học bám theo khoá "Pháp Luật Giao thông Đường Bộ" của cơ sở đào tạo lái xe.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `app/` | Toàn bộ app tĩnh (HTML/CSS/JS thuần, không build). Đây là thư mục đem đi host. |
| `app/data/questions.json` | 600 câu (Cục CSGT, CV 2262/CSGT-P5) — sinh bởi `tools/data/` |
| `app/data/lessons.json` | 83 bài; 48 bài phần Luật có nội dung (Luật 36/2024, VBHN 55/VBHN-VPQH) |
| `app/data/exam.json` | Cấu trúc đề: hạng B hiện hành (30 câu/20'/≥27) và từ 01/3/2027 (50/33'/≥45) |
| `app/data/signs.json` | 21 cặp biển báo ↔ ý nghĩa cho trò Ghép biển báo — sinh bởi `tools/data/build_signs.py` |
| `app/js/games/`, `app/js/views/games/` | Phần trò chơi (đặc tả: [SPEC-GAMES.md](SPEC-GAMES.md)): Hành trình, Chớp nhoáng, Sinh tồn, Đúng hay Sai, Ghép biển báo; XP, chuỗi ngày, huy hiệu |
| `tools/data/` | Script tách dữ liệu từ PDF gốc |
| `tools/app/` | Test, kiểm tra app, server phát triển |

## Lệnh

Tạo lại dữ liệu (PDF gốc để ngoài repo; cần PyMuPDF + Pillow):

```powershell
python -E -P tools/data/law_parse.py <55-vbhn-vpqh.pdf> tools/data/out/law_articles.json
python -E -P tools/data/build_lessons.py
python -E -P tools/data/q600_parse.py "<Bo 600 cau hoi ... .pdf>" tools/data/out
python -E -P tools/data/build_questions.py
python -E -P tools/data/build_signs.py
Copy-Item tools/data/out/lessons.json, tools/data/out/exam.json app/data/
```

Sau mỗi lần đổi code hoặc dữ liệu: tăng `CACHE_VERSION` trong `app/sw.js` (máy đã cài sẽ tải bản mới).

Kiểm tra:

```powershell
node --test tools/app/
node tools/app/check_app.mjs
python tools/app/devserver.py 8766   # mở http://localhost:8766
```

## Nguồn dữ liệu

- Bộ 600 câu hỏi dùng cho sát hạch lái xe cơ giới đường bộ — Cục CSGT, 2025 (đáp án = ý gạch chân trong PDF).
- Danh sách 60 câu điểm liệt → `tools/data/critical.json`. 30 câu xác nhận từ Phụ lục 1–2 bản PDF chính thức của
  Công văn 2262/CSGT-P5; 30 câu còn lại theo hai nguồn không chính thức trùng khớp (chưa có bản Phụ lục III gốc).
- Luật Trật tự, an toàn giao thông đường bộ 36/2024/QH15, văn bản hợp nhất 55/VBHN-VPQH (datafiles.chinhphu.vn).

## Việc còn lại

- Đối chiếu 30 câu điểm liệt chưa xác nhận khi có bản Phụ lục III gốc.
- Nội dung 35 bài: báo hiệu (QCVN 41:2024/BGTVT), tốc độ (TT 38/2024/TT-BGTVT), xử phạt (NĐ 168/2024), sa hình.
- Host lên HTTPS (GitHub Pages hoặc Vercel) để cài lên iPhone; thử offline + đọc to trên máy thật.
