# Hệ thống xếp lịch gác thi - SQL Server

Bản này dùng đúng SQL người dùng cung cấp: `DB_XepLichCoiThi_TheoKhoa_RangBuoc(3).sql`, với tên database thực tế là `DB_XepLichCoiThi_Final`.

## Cấu trúc
- `frontend/`: giao diện HTML/CSS/JS, đã tách thành các module.
- `backend/`: FastAPI + pyodbc, kết nối SQL Server.
- `database/`: script SQL dựng database.

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
