# Chức năng: Chọn giảng viên tham gia đợt gác thi

Vào **Quản lý giảng viên → Chọn GV tham gia đợt**, tick những giảng viên sẽ gác thi trong đợt thi mới nhất rồi bấm **Lưu danh sách**.

## Cách hoạt động
- Danh sách tham gia đợt = các dòng của `DinhMucPhanCong` theo `MaDot` (không thêm bảng mới).
- Tick thêm: tạo dòng định mức mặc định 100%. Bỏ tick: xóa dòng; bị chặn nếu GV đã có phân công trong đợt.
- GV chưa tick: hiện chip "Không tham gia đợt", khóa ô định mức, không đưa vào solver CP-SAT, không hiện ở danh sách chọn tay.
- Backend đối chiếu danh sách solver và phân công lưu với `DinhMucPhanCong`; request có giảng viên chưa tham gia đợt sẽ bị từ chối.
- Đợt cũ đã có định mức thì các GV đó tự hiện là đã tick.

## File đã sửa
- `database/DB_XepLichCoiThi_TheoKhoa_RangBuoc.sql`: `sp_DatDinhMucChung` không tự thêm GV mới. **Phải chạy lại thủ tục này trong SSMS** (CREATE OR ALTER, không mất dữ liệu).
- `backend/schemas/admin.py`, `models/admin_system.py`, `controllers/admin_system.py`: endpoint `PUT /api/dot-thi/{ma_dot}/giang-vien-tham-gia`; `update_lecturer` không tự thêm GV vào đợt.
- `backend/models/scheduling.py`, `models/admin_exams.py`: bỏ INSERT tự thêm định mức.
- `frontend/js/`: `api/api.js`, `api/ketnoi-sql.js`, `core/tienich.js`, `core/xeplich.js`, `pages/giaodien.js`, `pages/hienthi.js`, `events/thaydoi.js`, `events/hanhdong.js`.
