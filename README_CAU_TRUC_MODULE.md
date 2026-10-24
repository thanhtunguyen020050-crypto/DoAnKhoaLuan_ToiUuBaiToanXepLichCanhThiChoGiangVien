# Cấu trúc module

Dự án được chia theo trách nhiệm để dễ bảo trì.

```text
KhoaLuan_XepLichCaThi/
├── frontend/
│   ├── src/              # React: app, components, API client, styles
│   ├── index.html        # Cổng quản trị (Vite entry)
│   ├── user.html         # Cổng giảng viên (Vite entry)
│   ├── login.html        # Đăng nhập React
│   ├── package.json
│   ├── vite.config.js
│   └── js/               # Màn hình và luồng cũ đang được chuyển dần
│       ├── api/       # Gọi API
│       ├── core/      # Dữ liệu, tiện ích, phân tích ràng buộc
│       ├── events/    # Xử lý thao tác người dùng
│       └── pages/     # Giao diện từng màn hình
├── backend/
│   ├── main.py             # Tạo ứng dụng và đăng ký Controller
│   ├── core/config.py      # Cấu hình môi trường tập trung
│   ├── ketnoi_sql.py       # Kết nối SQL Server
│   ├── controllers/        # FastAPI endpoints, một file cho mỗi nhóm chức năng
│   ├── models/             # Truy vấn SQL và xử lý dữ liệu
│   ├── schemas/            # Pydantic request/response models
│   ├── services/           # Thuật toán CP-SAT
│   ├── auth_utils.py       # Xác thực và phân quyền
│   ├── requirements.txt
│   └── README_BACKEND.md
└── database/
    └── DB_XepLichCoiThi_TheoKhoa_RangBuoc.sql
```

`main.py` chỉ tạo app và đăng ký Controller. Controller xử lý HTTP và gọi Model; Model làm việc với SQL Server; React hiển thị View. Request được kiểm tra bằng Pydantic schema, cấu hình nằm trong `core/config.py`, thuật toán tối ưu nằm trong `services/cpsat_solver.py`.

Không gộp logic solver vào `main.py`; không gộp lời gọi API vào mô hình toán; không gộp giao diện và nghiệp vụ backend.

Giao diện mới khởi chạy qua React + Vite. Trong giai đoạn chuyển đổi, `LegacyAppHost` nạp các màn hình cũ để giữ tương thích; màn hình đăng nhập và API client đã dùng module React/ESM. Chuyển từng màn hình sang component React sẽ thay dần lớp tương thích này.
