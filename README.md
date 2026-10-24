# Hệ thống xếp lịch gác thi - SQL Server

Bản này dùng đúng SQL người dùng cung cấp: `DB_XepLichCoiThi_TheoKhoa_RangBuoc(3).sql`, với tên database thực tế là `DB_XepLichCoiThi_Final`.

## Cấu trúc
- `frontend/`: React + Vite làm khung giao diện; CSS và các màn hình hiện có được giữ tương thích trong giai đoạn chuyển đổi.
- `backend/`: FastAPI + pyodbc, kết nối SQL Server.
- `database/`: script SQL dựng database.

## Chạy giao diện
Mở terminal tại thư mục `frontend` và chạy:

```powershell
npm install
npm run dev
```

Mở địa chỉ Vite in ra, mặc định `http://127.0.0.1:5173`. Chạy FastAPI riêng theo hướng dẫn trong `backend/README_BACKEND.md`; địa chỉ API mặc định là `http://127.0.0.1:8000/api`. Nếu backend ở địa chỉ khác, tạo `frontend/.env.local` với `VITE_API_BASE_URL=http://<host>:<port>/api`.

Các trang quản trị, đăng nhập và giảng viên đều vào qua React/Vite. Màn hình đăng nhập đã viết bằng React; những luồng quản trị và giảng viên hiện được nạp qua lớp tương thích để giữ nguyên tính năng trong lúc chuyển từng màn hình sang component React.

## Không dùng file SQL để kết nối
File SQL chỉ dùng để tạo database. Ứng dụng kết nối bằng backend + chuỗi kết nối.

## Chuỗi kết nối mặc định
Server: `LAPTOP-V7CFUSHA\\SQLEXPRESS01`
Database: `DB_XepLichCoiThi_Final`
Driver: `ODBC Driver 17 for SQL Server`
Authentication: Windows/Trusted Connection

## Chức năng đặt định mức chung
SQL đã có `dbo.sp_DatDinhMucChung`. Thủ tục cập nhật/tạo định mức rồi gọi `dbo.sp_TinhDinhMucTheoTyLe`, dùng Largest Remainder để tổng `SoCaQuyDinh` khớp tổng nhu cầu `SoGVCanCap`.


## Phân tách Lịch dạy và Lịch bận
- `LichDayGV`: dữ liệu IMPORT từ lịch giảng dạy chính thức; là ràng buộc cứng (hard constraint) 100%, tuyệt đối không được xếp gác trùng. Import chỉ khớp với giảng viên đã có trong CSDL, không tự tạo giảng viên.
- `LichBanGV`: dữ liệu bận phát sinh cá nhân; là ràng buộc mềm (soft constraint), thuật toán ưu tiên né nhưng có thể xếp khi bắt buộc.
- Import lịch dạy không ghi vào `LichBanGV`.
