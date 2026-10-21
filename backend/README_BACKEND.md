# Kết nối SQL Server

Backend này phục vụ riêng phần dữ liệu giảng viên/lịch bận của giao diện.

## 1. Cấu hình

Mặc định:
- Server: `LAPTOP-V7CFUSHA\SQLEXPRESS01`
- Database: `DB_XepLichCoiThi_Final`
- Driver: `ODBC Driver 17 for SQL Server`
- Windows Authentication

Có thể sao chép `.env.example` thành `.env` để đổi cấu hình.

## 2. Cài thư viện

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 3. Chạy API

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Kiểm tra: `http://127.0.0.1:8000/api/kiem-tra-ket-noi`

Swagger: `http://127.0.0.1:8000/docs`

## 4. Đặt lại mật khẩu Admin thủ công

Không thể xem lại mật khẩu cũ vì cơ sở dữ liệu chỉ lưu bản băm. Nhà phát triển có thể đặt mật khẩu mới trực tiếp vào tài khoản Admin bằng lệnh dưới đây:

```powershell
cd C:\KhoaLuan_XepLichCaThi\backend
.\.venv\Scripts\python.exe .\reset_admin_password.py
```

Nhập mật khẩu mới hai lần khi được hỏi. Script chấp nhận bất kỳ mật khẩu nào không để trống và chỉ in thông báo thành công, không hiển thị mật khẩu.

## 5. Chạy giao diện

Mở thư mục gốc bằng VS Code và chạy `index.html` bằng Live Server. Giao diện gọi API tại `http://127.0.0.1:8000/api`.

## Lưu ý

- Không còn Import danh sách giảng viên.
- Import lịch thi vẫn giữ nguyên.
- Import lịch dạy vẫn giữ nguyên.
- Excel vẫn được giữ cho các chức năng còn lại, không bị xóa toàn bộ.
- Xóa giảng viên trên giao diện chuyển `TrangThai` thành `Ngừng công tác`, không xóa vật lý dữ liệu.
