# Thuật toán xếp lịch CP-SAT (Python)

## Phân chia module

- `main.py`: khởi tạo FastAPI và giữ các API dữ liệu hiện có.
- `routers/scheduling.py`: endpoint `POST /api/xep-lich/cpsat`.
- `schemas/scheduling.py`: kiểm tra cấu trúc request/response bằng Pydantic.
- `services/cpsat_solver.py`: mô hình Google OR-Tools CP-SAT; không chứa HTTP hoặc SQL.
- `ketnoi_sql.py`: kết nối SQL Server, độc lập với solver.

## Cài đặt

Từ thư mục `backend` trong PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Luồng chạy

1. Giao diện gửi danh sách giảng viên, ca thi, lịch dạy, lịch bận, phân công khóa và các tùy chọn mềm.
2. FastAPI kiểm tra dữ liệu request.
3. `services/cpsat_solver.py` tạo mô hình CP-SAT và giải bài toán.
4. API trả trạng thái (`OPTIMAL`, `FEASIBLE`, hoặc trạng thái không tìm được nghiệm), danh sách phân công, giá trị mục tiêu và thời gian giải.
5. Giao diện cập nhật lịch, thống kê và lưu trạng thái ứng dụng hiện có.

## Các ràng buộc được mô hình hóa
- Mỗi ca thi có đúng số giảng viên cần cấp.
- Mỗi giảng viên được phân đúng số lượt theo tỷ lệ định mức.
- Không phân công trùng thời gian cho cùng giảng viên.
- Không xếp gác trùng lịch dạy.
- Tránh lịch bận ưu tiên mức 1 như ràng buộc cứng; lịch bận mức 2/3 được tính điểm phạt.
- Không xếp hai loại hình thi khác nhau trong cùng buổi/ngày cho một giảng viên.
- Ranh giới buổi khớp với SQL: tiết 1–6, 7–12 và 13–16.
- Giữ các phân công đã khóa.
- Có hàm mục tiêu ưu tiên giảm lịch bận và giảm khoảng trống giữa các buổi trong ngày.

## Kiểm tra endpoint

Khởi động backend rồi mở `http://127.0.0.1:8000/docs`, tìm nhóm **Xếp lịch CP-SAT**.

> Lưu ý: môi trường phát triển phải cài được `ortools` từ `requirements.txt`. Nếu CP-SAT báo `INFEASIBLE`, cần rà soát tổng định mức, số lượng giảng viên rảnh, lịch dạy, lịch bận mức 1 và phân công khóa. Không nên tự động nới các ràng buộc cứng mà không có quyết định nghiệp vụ.
