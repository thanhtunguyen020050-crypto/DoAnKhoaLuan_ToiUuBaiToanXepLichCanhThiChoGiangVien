# HƯỚNG DẪN IMPORT CA THI

File import ca thi hỗ trợ cả định dạng **.xlsx**, **.xls**, **.csv**.

---

## 1. Cấu trúc bảng gồm 4 cột:

| Ngày thi | Ca/tiết | Số GV cần | Loại ca |
| :--- | :--- | :---: | :--- |
| `dd/mm/yyyy` (ví dụ `26/10/2026`) | `1 → 2` hoặc `Ca 1` | `2` | `Lý thuyết` (hoặc `LT`) |
| `26/10/2026` | `3 → 4` hoặc `Ca 2` | `2` | `Lý thuyết` |
| `26/10/2026` | `7 → 8` hoặc `Ca 3` | `2` | `Tự luận` (hoặc `TL`) |
| `26/10/2026` | `9 → 10` hoặc `Ca 4` | `2` | `Tự luận` |

---

## 2. Các quy định về dữ liệu:

- **Ngày thi**: Ngày thực tế định dạng `dd/mm/yyyy` (ví dụ: `26/10/2026`).
- **Ca/tiết**: Chấp nhận các dạng:
  - Dạng tiết: `1 → 2`, `1 → 3`, `3 → 4`, `4 → 6`, `5 → 6`, `7 → 8`, `7 → 9`, `9 → 10`, `10 → 12`, `11 → 12` (hoặc viết dấu gạch ngang `1-2`, `3-4`,...).
  - Dạng ca: `Ca 1`, `Ca 2`, `Ca 3`, `Ca 4`.
- **Số GV cần**: Số nguyên từ 1 đến 30.
- **Loại ca**: `Lý thuyết` (hoặc viết tắt `LT`), `Tự luận` (hoặc viết tắt `TL`).

---

## 3. File mẫu có sẵn trong thư mục:
- File mẫu: `docs/Mau_Import_Ca_Thi.csv`
