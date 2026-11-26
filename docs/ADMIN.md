# Bảng điều hành MetroPulse

`/admin` là giao diện điều hành riêng cho **một** chủ sở hữu. Tài khoản quản trị độc lập với tài khoản người chơi. Không có tài khoản hay mật khẩu mặc định, không có đăng ký công khai.

## Thiết lập trên Vercel

1. Trong **Vercel → MetroPulse → Settings → Environment Variables → Production**, đặt `ADMIN_ORIGIN=https://metropulse-nu.vercel.app` (chỉ một origin HTTPS, không có đường dẫn). Nếu sử dụng tên miền khác, thay bằng tên miền chính thức. Khi không đặt biến này, máy chủ chỉ chấp nhận origin suy ra từ `VERCEL_PROJECT_PRODUCTION_URL`. Triển khai lại nếu vừa đổi biến.
2. Trong terminal riêng, cung cấp `MONGODB_URI` (và `MONGODB_DB` nếu đã đặt) bằng **chính cấu hình Production của cùng dự án**. Dùng kho bí mật hoặc bản tải xuống môi trường Production nếu Vercel cho phép; không dùng URI từ Preview/Development, không in hoặc dán URI vào chat, không commit tệp môi trường. Thiết lập cùng `ADMIN_ORIGIN` như trên.
3. Từ thư mục dự án, chạy `node scripts/admin-setup-token.js`. Gửi liên kết mà script in ra qua kênh riêng. Liên kết có hiệu lực 30 phút, dùng một lần; chạy lại trước khi tạo tài khoản sẽ vô hiệu hóa liên kết cũ. Với tệp môi trường riêng, có thể chạy `node --env-file=/đường/dẫn/riêng/production.env scripts/admin-setup-token.js`.
4. Mở liên kết trên đúng origin. Đặt tên, mật khẩu dài ít nhất 14 ký tự và quét mã bằng ứng dụng xác thực. Nhập mã 6 số. Lưu mã khôi phục vào trình quản lý mật khẩu hoặc nơi an toàn; chúng chỉ hiện một lần.

Phiên quản trị hết hạn sau 30 phút không có yêu cầu xác thực hoặc tối đa 12 giờ. Sau khi dùng một mã TOTP, đợi mã kế tiếp trước khi dùng lại TOTP. Đổi mật khẩu hoặc đặt lại xác thực thu hồi mọi phiên quản trị. Nếu mất ứng dụng xác thực, dùng mã khôi phục để đăng nhập; thay thiết bị xác thực cần mã TOTP từ thiết bị hiện tại như biện pháp bảo vệ. Nếu mất toàn bộ yếu tố xác thực, không có đường tắt qua ứng dụng.

## Dữ liệu và giới hạn đo

- **Online**: định danh duy nhất có tín hiệu hiện diện trong 150 giây; các thiết bị của cùng tài khoản được gộp. Người chơi không đăng nhập được nhận diện theo trình duyệt. Offline, thiết bị không gửi được tín hiệu, hoặc xóa dữ liệu trình duyệt không thể được đối chiếu đáng tin cậy.
- **Đồng thời theo thời gian**: mẫu đầu phút có tín hiệu, biểu đồ lấy mẫu cao nhất trong mỗi khoảng 15 phút (24 giờ) hoặc 1 giờ (7/30 ngày). Không suy luận lưu lượng trước khi bật ghi nhận; khoảng trống không có mẫu.
- **DAU/WAU/MAU**: số định danh có hoạt động trong ngày hiện tại, 7 hoặc 30 ngày theo giờ Việt Nam. **D1/D7/D30** tính theo ngày tạo tài khoản trên nhóm có dữ liệu, không tính người chơi trình duyệt chưa đăng nhập. Không có kết quả cho mốc chưa đến. **Phiên trung bình** là thời lượng quan sát theo các tín hiệu, không phải thời gian chính xác đến từng giây.
- **Nhập lịch sử (tùy chọn)**: chỉ sau khi xác nhận target và quyền, chạy `node scripts/admin-backfill-analytics.js --apply` với cùng biến môi trường. Script thêm ngày hoạt động gần nhất đã ghi trong hồ sơ (trong 60 ngày), không suy diễn các ngày còn thiếu, không tạo phiên online hoặc mẫu CCU giả. Có thể chạy lại. Số tài khoản mới đã dùng ngày tạo trực tiếp, không cần backfill.
- **Sự kiện:** cấu hình trên máy chủ ghi đè lịch và Vàng theo mốc; hệ số áp dụng vào Vàng. Khi có hai lịch chủ động trùng, lịch có giờ bắt đầu mới hơn được ưu tiên trong cùng loại. Khi không có mạng, game dùng lịch và phần thưởng có sẵn. Game hiện vẫn là mô hình bản lưu do client quản lý, không phải một hệ thống chống sửa save.
- **Khóa tài khoản** ngăn đăng nhập và các API đã xác thực (gồm trò chuyện), không chặn chơi ngoại tuyến hay tạo một danh tính khác. Xóa tài khoản không thể xóa bản lưu đã nằm trên thiết bị người chơi.
