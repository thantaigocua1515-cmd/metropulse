# MetroPulse 2.0 — ghi chú thiết kế

Cấu trúc: `public/` (index.html, css/style.css, js/*.js nạp theo thứ tự bằng thẻ script thường, chạy được cả file://),
`server/` (Express + MongoDB), `legacy/index.single.html` (bản 1 file gốc).

Thứ tự script: config → content → audio → core → simulation → crisis → progression → social → renderer → storage → cloud → tutorial → ui → main.

## Hệ thống mới
- Công trình: 28 loại, cấp 1–10, 3 bậc tiến hóa (cấp 4, 7), chuyên môn hóa A/B ở cấp 5.
- Quy hoạch: nối đường (−20% nếu thiếu), công viên, dân cư ↔ thương mại, Ga Metro, ô nhiễm.
- Tri thức + cây nghiên cứu 12 công nghệ × 3 cấp (3 nhánh).
- Cốt truyện 6 chương (nhân vật: Mai, Bách, Vy, Hạnh, Quân, Lam), hội thoại mở/đóng chương.
- Hướng dẫn tân thủ có spotlight.
- Giữ chân: điểm danh 7 ngày, 3 nhiệm vụ ngày, thành tựu 3 bậc, túi thuế trên bản đồ, thư quyết định, danh hiệu đô thị, quân hàm đội NPC.
- Backend: tài khoản khách + liên kết tên/mật khẩu, lưu đám mây có rev, BXH toàn cầu, kết bạn theo mã, quà chi viện.

## Trạng thái phát triển (ghi chú nội bộ)
- Chạy: `npm start` (đọc `.env`); Vercel: `api/index.js` + `vercel.json`; DB tạm: `node scripts/dev-db.js` (cổng 27018); kiểm thử API: `npm test`.
- Kiểm thử giao diện bằng Playwright qua CDP: `~/mp-tools/run.js <script>` (t2.js chạy hết hướng dẫn tân thủ).
- Atlas: chuỗi kết nối đặt trong `.env` (cục bộ) hoặc biến môi trường `MONGODB_URI` (Vercel); không commit.
- Đã kiểm: boot, hội thoại chương 1, 8 bước hướng dẫn, đồng bộ đám mây khách, 4 nhóm test API.
- Còn phải kiểm: nghiên cứu, đội NPC, thư quyết định, điểm danh, lên cấp, nâng cấp/tiến hóa/chuyên môn, thăm bạn + bạn trực tuyến, BXH toàn cầu, đăng ký/đăng nhập, tải lại + khôi phục từ máy chủ, bản lưu v1 cũ, màn hình mobile, file://.
