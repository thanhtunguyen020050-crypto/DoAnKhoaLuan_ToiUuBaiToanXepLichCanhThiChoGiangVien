# Cấu trúc module sau khi tích hợp CP-SAT

Dự án được chia theo trách nhiệm để dễ bảo trì.

```text
KhoaLuan_XepLichCaThi/
├── frontend/
│   └── js/
│       ├── api/       # Gọi API
│       ├── core/      # Dữ liệu, tiện ích, phân tích ràng buộc
│       ├── events/    # Xử lý thao tác người dùng
│       └── pages/     # Giao diện từng màn hình
├── backend/
│   ├── main.py       # Khởi tạo FastAPI và API dữ liệu hiện có
│   ├── ketnoi_sql.py # Kết nối SQL Server
│   ├── routers/
│   │   └── scheduling.py  # API gọi CP-SAT
│   ├── schemas/
│   │   └── scheduling.py  # Request/response của chức năng xếp lịch
│   ├── services/
│   │   └── cpsat_solver.py # Mô hình tối ưu CP-SAT
│   ├── requirements.txt
│   └── README_CPSAT.md
└── database/
    └── DB_XepLichCoiThi_TheoKhoa_RangBuoc.sql
```

Không gộp logic solver vào `main.py`; không gộp lời gọi API vào mô hình toán; không gộp giao diện và nghiệp vụ backend.
