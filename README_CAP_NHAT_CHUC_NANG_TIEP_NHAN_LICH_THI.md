# Cập nhật chức năng tiếp nhận lịch thi

## 1. Đợt thi
Form cho phép chọn 3 loại: HK1, HK2, HKH (học kỳ hè) và chọn năm học dạng 2026-2027.

## 2. Nhập ca thi
Thứ tự nhập: Học kỳ → Năm học → Ngày thi → Tiết/ca → Loại ca (Lý thuyết/Tự luận) → Số giảng viên cần cấp.

Các tiết theo project hiện tại: 1→2, 1→3, 3→4, 4→6, 5→6, 7→8, 7→9, 9→10, 10→12, 11→12.

Dữ liệu được POST về FastAPI và lưu vào SQL Server, không còn chỉ lưu localStorage. Đợt thi được tạo tự động nếu chưa tồn tại; khoảng ngày của đợt thi tự mở rộng khi nhập thêm ngày thi.

## 3. SQL
`DotThi` bổ sung `HocKy`, `NamHoc`, `LoaiDot`. Có procedure danh sách đợt/ca và CRUD ca thi. `CaThi` kiểm tra ngày nằm trong đợt, không cho trùng ngày + khoảng tiết. Việc tính định mức chỉ chạy khi đợt đã có giảng viên/định mức, nên có thể tiếp nhận lịch thi trước.

## 4. Giảng viên
Form đã có thêm dropdown Bộ môn. Backend truyền `MaBoMon` thật vào `sp_ThemGiangVien`/`sp_SuaGiangVien`, thay vì lấy Khoa CNTT làm Bộ môn mặc định.

## 5. Chạy
- Chạy SQL full file nếu đang dùng DB test vì file tạo lại database.
- Backend: `cd backend` rồi `uvicorn main:app --reload --host 127.0.0.1 --port 8000`.
- Frontend mở `frontend/index.html` bằng Live Server.
