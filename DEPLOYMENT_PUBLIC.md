# Triển khai hệ thống lên Internet

## Bản demo tạm thời cho giảng viên chạy thử

Nếu chỉ cần chia sẻ để chạy thử, có thể dùng Cloudflare Quick Tunnel từ máy đang chạy ứng dụng; chưa cần thuê VPS hoặc mua tên miền. Link `trycloudflare.com` được tạo tạm và chỉ hoạt động khi máy, API, máy chủ demo và `cloudflared` đều đang chạy. Cloudflare Quick Tunnel hỗ trợ giới hạn truy cập theo email.

1. Dùng cơ sở dữ liệu thử nghiệm hoặc bản sao của database, không dùng dữ liệu cá nhân thật. Đảm bảo `backend/.env` đang trỏ đến SQL Server trên máy bạn; không mở cổng SQL Server ra Internet.
2. Mở PowerShell thứ nhất, chạy FastAPI:

   ```powershell
   cd C:\KhoaLuan_XepLichCaThi\backend
   .\.venv\Scripts\python.exe run.py
   ```

3. Mở PowerShell thứ hai, build và chạy frontend cùng proxy API:

   ```powershell
   cd C:\KhoaLuan_XepLichCaThi\frontend
   $env:VITE_API_BASE_URL = '/api'
   npm run build
   npm run serve:demo
   ```

   Giữ cửa sổ này mở. Bản demo phục vụ ở `http://127.0.0.1:8080`; `/api` được chuyển tiếp tới FastAPI tại `127.0.0.1:8000`.

4. Cài `cloudflared` theo [hướng dẫn chính thức cho Windows](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/). Mở PowerShell thứ ba và chạy lệnh sau, thay email bằng email của cô giáo:

   ```powershell
   cloudflared tunnel --url http://127.0.0.1:8080 --allowed-mail "email-cua-co@example.edu.vn"
   ```

5. Gửi cô giáo link `https://…trycloudflare.com` hiện trong cửa sổ đó. Cô sẽ xác thực email bằng mã một lần rồi đăng nhập tài khoản của ứng dụng. Dừng tunnel bằng `Ctrl+C`; link sẽ hết hiệu lực và lần sau thường sẽ đổi.

Quick Tunnel dành cho thử nghiệm, không có cam kết hoạt động liên tục; ai qua được lớp xác thực và có tài khoản ứng dụng phù hợp có thể truy cập dữ liệu ứng dụng. Vì vậy nên dùng database thử nghiệm và chỉ cho email của người cần thử.

Tham khảo: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Máy chủ chạy lâu dài

## Kiến trúc phù hợp với dự án hiện tại

Dự án đang dùng FastAPI, `pyodbc` và SQL Server. Cách ít phải thay đổi nhất là dùng một máy chủ Windows có địa chỉ Internet:

1. Tên miền trỏ đến IP công khai của máy chủ.
2. IIS phục vụ các file tĩnh trong `frontend/dist` qua HTTPS và chuyển đường dẫn `/api` đến FastAPI chạy nội bộ trên máy chủ.
3. FastAPI kết nối SQL Server trong mạng riêng của máy chủ.
4. Không mở cổng SQL Server (thường là 1433) ra Internet. Chỉ IIS nhận kết nối web HTTPS.

Có thể tách frontend, API và cơ sở dữ liệu sang các dịch vụ cloud khác nhau, nhưng sẽ cần cấu hình ODBC Driver, mạng/firewall SQL Server và CORS riêng. Với Azure App Service, FastAPI được hỗ trợ trên Linux; nếu triển khai `pyodbc`, cần bảo đảm image/runtime có Microsoft ODBC Driver phù hợp.

## Cấu hình

1. Sao lưu database SQL Server hiện tại rồi chuyển bản sao lên máy chủ đích. Chạy các migration cần thiết trước khi mở website.
2. Sao chép `backend/.env.production.example` thành `backend/.env` trên máy chủ. Điền domain trong `CORS_ORIGINS`, thông tin kết nối database và một `AUTH_SECRET_KEY` ngẫu nhiên dài tối thiểu 32 ký tự.
3. Nếu dùng SQL Authentication, đặt `SQL_TRUSTED_CONNECTION=no` cùng SQL login riêng có quyền tối thiểu cần thiết. Nếu dùng Windows Authentication, cấp quyền cho chính tài khoản chạy dịch vụ FastAPI.
4. Sao chép `frontend/.env.production.example` thành `frontend/.env.production`; giữ `VITE_API_BASE_URL=/api` khi IIS chuyển tiếp `/api` tới FastAPI.
5. Build frontend:

   ```powershell
   cd frontend
   npm ci
   npm run build
   ```

   IIS phục vụ thư mục `frontend/dist`.

6. Chạy FastAPI như một Windows service bằng `python run.py`, với thư mục làm việc là `backend`. Cấu hình IIS chuyển tiếp `/api/*` tới `http://127.0.0.1:8000/api/*`.
7. Trỏ DNS tên miền đến máy chủ, bật HTTPS trong IIS, và giới hạn Windows Firewall để chỉ cho phép cổng web cần thiết.

## Bí mật và dữ liệu

- Không đưa `backend/.env`, mật khẩu database, `AUTH_SECRET_KEY` hoặc file sao lưu database lên Git hay thư mục frontend.
- `APP_ENV=production` buộc phải có CORS cụ thể, SQL Server/database cụ thể và khóa ký token riêng. API sẽ không khởi động nếu thiếu các giá trị này.
- Thay mật khẩu mặc định của tài khoản quản trị trước khi công bố website. Không dùng dữ liệu cá nhân thật cho môi trường thử nghiệm công khai.
