# Quay về MetroPulse 4.7.4

Mốc trước đợt cập nhật VFX, lớp ngầm, kinh tế ngầm và bầu cử:

- Git: tag annotated `backup-4.7.4` trên `origin`, commit `e2665ea0a4d251ea125e76b16e2b2b0040cf1a8f`.
- Vercel: [deployment 4.7.4](https://vercel.com/thantaigocua/metropulse/BAMQQme5uS3BrD2f1o7UbdBUEbH6). Đây là liên kết trong trạng thái Vercel thành công của commit trên GitHub.
- Alias production: [metropulse-nu.vercel.app](https://metropulse-nu.vercel.app/). HTML tại alias đã được đối chiếu byte với bản trong tag.

## Quay lại bản chạy

1. Trong project **metropulse** trên Vercel, mở deployment 4.7.4 ở trên. Đối chiếu commit và môi trường **Production**, rồi chọn **Instant Rollback** về deployment đó. Không tạo deployment mới từ nhánh `main` nếu nhánh đã có các tính năng cần gỡ.
2. Kiểm tra trang production trả về `mp-release` là `4.7.4`; đối chiếu HTML, JavaScript và service worker với tag. Mở một phiên trình duyệt mới hoặc tải lại game để kiểm tra asset của bản cũ. Kiểm tra luồng tải/lưu bằng tài khoản thử nghiệm riêng, không dùng bản lưu của người chơi.
3. Rollback trên Vercel không đổi nhánh `main`. Nếu cần giữ 4.7.4 trên các lần triển khai sau, tạo commit hoàn tác các commit phát hành liên quan trên `main` qua quy trình thông thường; không ghi đè lịch sử Git hoặc di chuyển tag.

## Tương thích bản lưu

Rollback ứng dụng **không** khôi phục hay đặt lại MongoDB. Không xóa bản lưu, bản lịch sử hay chỉ mục khi thực hiện.

Giữ định dạng bản lưu `version: 2` và lưu trạng thái tính năng mới trong trường bổ sung riêng. Kiểm tra bản lưu đã chơi tính năng mới bằng cả `StorageManager.normalize()` và `inspectSave()` tại tag trước mỗi phát hành, gồm cả vòng đọc rồi lưu lại bằng 4.7.4. Kho vật liệu, nghiên cứu, địa giới, cấp công trình và danh mục công trình đang có ràng buộc trong bản cũ. Đặc biệt, một ID công trình mới trong `world.buildings` **làm 4.7.4 từ chối cả bản lưu**; nếu chưa có phương án tương thích, biểu diễn công trình mới qua dữ liệu bổ sung hoặc trên một ID nền hợp lệ và giữ nguyên ID đã lưu. Không triển khai thay đổi phá tương thích rồi dựa vào thao tác rollback ứng dụng để sửa dữ liệu.
