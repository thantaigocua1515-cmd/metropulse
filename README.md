# MetroPulse · Nhịp Đập Đô Thị

Game xây dựng thành phố isometric 2.5D vẽ bằng Canvas thuần (âm thanh tổng hợp bằng Web Audio; ảnh duy nhất là bộ chân dung nhân vật trong `public/img/npc`), kèm backend Express + MongoDB.

## Chạy cục bộ

```bash
npm install
cp .env.example .env   # điền MONGODB_URI
npm start              # http://localhost:8080
npm test               # kiểm thử API bằng MongoDB trong bộ nhớ
```

Không có `MONGODB_URI`, trò chơi vẫn chạy và lưu trên trình duyệt; các API đám mây trả về 503.

## Cấu trúc

- `public/` — giao diện: `index.html`, `css/`, `js/` (nạp bằng thẻ `<script>`, không cần bundler)
- `server/` — Express: tài khoản, lưu đám mây có kiểm tra phiên bản, bạn bè, bảng xếp hạng, hộp thư quà
- `api/index.js`, `vercel.json` — điểm vào khi deploy lên Vercel (đặt `MONGODB_URI` trong Environment Variables)
- `legacy/index.single.html` — bản một file ban đầu
- `docs/DESIGN.md` — ghi chú thiết kế
