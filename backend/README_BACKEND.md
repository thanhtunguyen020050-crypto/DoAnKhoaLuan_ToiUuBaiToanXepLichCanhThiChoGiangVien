# Kết nối SQL Server

Backend này phục vụ riêng phần dữ liệu giảng viên/lịch bận của giao diện.
Backend được tổ chức theo MVC: `controllers/` nhận request FastAPI, `models/` truy vấn và xử lý dữ liệu SQL, `schemas/` kiểm tra dữ liệu vào/ra, còn giao diện React trong `frontend/` là View. `services/` giữ thuật toán CP-SAT; `core/config.py` đọc cấu hình và `ketnoi_sql.py` quản lý kết nối SQL Server.

## 1. Cấu hình

Mặc định:
- Server: đọc từ `SQL_SERVER` trong `backend/.env` (mẫu nằm trong `.env.example`)
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
python run.py
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

Chạy FastAPI theo mục 3, sau đó mở terminal thứ hai và chạy giao diện bằng Vite:

```powershell
cd C:\KhoaLuan_XepLichCaThi\frontend
npm install
npm run dev
```

Mở `http://127.0.0.1:5173`. Không chạy các trang qua Live Server nữa. Giao diện gọi API tại `http://127.0.0.1:8000/api`.

## Lưu ý

- Không còn Import danh sách giảng viên.
- Import lịch thi vẫn giữ nguyên.
- Import lịch dạy vẫn giữ nguyên.
- Excel vẫn được giữ cho các chức năng còn lại, không bị xóa toàn bộ.
- Xóa giảng viên trên giao diện chuyển `TrangThai` thành `Ngừng công tác`, không xóa vật lý dữ liệu.
