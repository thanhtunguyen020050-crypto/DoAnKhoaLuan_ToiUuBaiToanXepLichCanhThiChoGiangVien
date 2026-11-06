# Thuật toán xếp lịch CP-SAT (Python)

## Phân chia module

- `main.py`: tạo ứng dụng FastAPI và đăng ký các Controller.
- `controllers/admin_*.py`: endpoint quản trị, chuyển xử lý cho Models.
- `schemas/admin.py`: request models quản trị được kiểm tra bằng Pydantic.
- `core/config.py`: cấu hình tập trung đọc từ `.env`.
- `models/admin_*.py`: truy vấn SQL và xử lý dữ liệu theo chức năng.
- `models/admin_helpers.py`: hàm hỗ trợ truy xuất dữ liệu dùng chung.
- `controllers/scheduling.py`: nhận yêu cầu tại `POST /api/xep-lich/cpsat/start`; giao diện lấy kết quả theo mã lần chạy để kết nối không phải chờ suốt thời gian giải.
- `schemas/scheduling.py`: kiểm tra cấu trúc request/response bằng Pydantic.
- `services/cpsat_solver.py`: mô hình Google OR-Tools CP-SAT; không chứa HTTP hoặc SQL.
- `ketnoi_sql.py`: kết nối SQL Server, độc lập với solver.

## Cài đặt

Từ thư mục `backend` trong PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Luồng chạy

1. Giao diện gửi danh sách giảng viên, ca thi, lịch dạy, lịch bận, phân công khóa và các tùy chọn mềm tới `POST /api/xep-lich/cpsat/start`.
2. FastAPI kiểm tra dữ liệu, tạo mã lần chạy và trả mã ngay; bộ giải chạy nền để trình duyệt không phải giữ một yêu cầu HTTP mở suốt thời gian xếp lịch.
3. Giao diện theo dõi tiến trình qua `GET /api/xep-lich/run-status` và lấy kết quả của lần chạy qua `GET /api/xep-lich/cpsat/result/{ma_dot}/{run_id}`.
4. Khi hoàn tất, giao diện hiển thị trạng thái CP-SAT, số lượt đã xếp/còn thiếu, điểm đánh giá và thời gian; nếu lỗi thì hiện thông báo lỗi thay vì chỉ hiện đồng hồ.
5. Với trạng thái `OPTIMAL` hoặc `FEASIBLE`, giao diện cập nhật lịch nháp và thống kê; quản trị viên có thể lưu/công bố theo luồng hiện có.

Thời gian chạy có ba lựa chọn: Xếp nhanh 30 giây, Tiêu chuẩn 120 giây (mặc định) và Tối ưu sâu 300 giây. Cả ba chế độ đều tìm nghiệm thỏa ràng buộc cứng rồi dành thời gian còn lại để tối ưu điểm phạt; chế độ nhanh dành tối đa khoảng 15 giây cho pha tìm nghiệm. `UNKNOWN` có nghĩa là chưa tìm thấy nghiệm trong thời gian cho phép, không tự nó chứng minh dữ liệu chắc chắn xung đột.

## Các ràng buộc được mô hình hóa
- Mỗi ca thi có đúng số giảng viên cần cấp.
- Mỗi giảng viên được phân đúng số lượt theo tỷ lệ định mức.
- Không phân công trùng thời gian cho cùng giảng viên.
- Không xếp gác trùng lịch dạy hoặc lịch trực đề.
- H7/RB7: chỉ lịch dạy khác cơ sở được so với ca thi cùng ngày; khoảng nghỉ phải đạt số tiết di chuyển trong cấu hình SQL.
- RB8 (mềm, bật/tắt riêng theo đợt): ưu tiên tránh ngày có ca từ tiết 13 trở đi khi tổng tải dạy, trực đề và coi thi vượt 12 tiết; phạt 10.000.000 điểm cho mỗi giảng viên-ngày vi phạm.
- S1: gom lịch để giảm số ngày tới trường; tránh ngày chỉ có đúng một ca coi thi mà không có lịch dạy hoặc trực đề.
- H9/RB9: số ca trắc nghiệm/tự luận được phép phụ thuộc lịch dạy và trực đề; nếu có ca bắt đầu từ tiết 13, không để 3 lịch trở lên nối liền nhau.
- Tránh lịch bận ưu tiên mức 1 như ràng buộc cứng; lịch bận mức 2/3 được tính điểm phạt.

Mức phạt mềm theo thứ tự ưu tiên: RB8 10.000.000/giảng viên-ngày; S1 1.000.000/ngày có lịch và thêm 1.000.000 nếu đó là ngày chỉ có một ca thi; S3 500.000/tiết trống; S2 200.000/đơn vị lệch (ca tối tính gấp đôi); S4 10.000/giảng viên-tuần; S5 1.000/đơn vị lệch hình thức; S6 100/ca bận mức 2; S7 10/ca bận mức 3. Các độ lệch theo định mức được chuẩn hóa thành đơn vị phân công trước khi nhân điểm. S4 chỉ phạt số tuần có lịch, không còn thưởng cặp ca liền nhau. Trạng thái bật/tắt được lưu trong `CauHinhRangBuocMem` theo `MaDot`; thủ tục khởi tạo đồng bộ trọng số/thứ tự mới và giữ nguyên trạng thái bật/tắt.

Với database đang dùng, chạy `database/migrations/20261106_soft_rule_priorities_weights.sql` một lần để cập nhật cấu hình theo từng đợt mà không xóa dữ liệu.
- Không xếp hai loại hình thi khác nhau trong cùng buổi/ngày cho một giảng viên.
- Ranh giới buổi khớp với SQL: tiết 1–6, 7–12 và 13–16.
- Giữ các phân công đã khóa.
- Pha 2 tối thiểu hóa tổng điểm phạt của cả tám ràng buộc mềm; báo cáo sau xếp dùng đúng số đơn vị vi phạm và trọng số của hàm mục tiêu.

## Kiểm tra endpoint

Khởi động backend rồi mở `http://127.0.0.1:8000/docs`, tìm nhóm **Xếp lịch CP-SAT**.

> Lưu ý: môi trường phát triển phải cài được `ortools` từ `requirements.txt`. Nếu CP-SAT báo `INFEASIBLE`, cần rà soát tổng định mức, số lượng giảng viên rảnh, lịch dạy, lịch bận mức 1 và phân công khóa. Không nên tự động nới các ràng buộc cứng mà không có quyết định nghiệp vụ.
