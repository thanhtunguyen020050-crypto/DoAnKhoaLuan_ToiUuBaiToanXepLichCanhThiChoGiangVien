# Import lịch bận giảng viên

## File Excel
Các cột bắt buộc:
1. STT
2. Họ tên
3. Ngày
4. Buổi
5. Lý do

`Buổi`: Sáng / Chiều / Cả ngày.
`Lý do`: chọn một trong 3 lý do cố định trong file mẫu.

## Chuẩn hóa
- Ngày `22/1/2026`, `22/01/2026`, `22-1-2026` được chuẩn hóa thành `2026-01-22`.
- Họ tên được đối chiếu không phân biệt hoa/thường, dấu tiếng Việt và khoảng trắng thừa.
- Không tìm thấy hoặc tên bị trùng trong CSDL: toàn bộ lượt import bị từ chối, không ghi dở dang.
- Không tạo giảng viên mới.
- Chỉ thay thế lịch bận của các giảng viên xuất hiện trong file.

## Lý do và mức ưu tiên
- Mức 1: Đi công tác, họp theo quyết định của Trường — ràng buộc cứng, phải né.
- Mức 2: Bận việc gia đình (Hiếu, hỷ) — ưu tiên né mạnh.
- Mức 3: Sự cố sức khỏe / Bận việc khẩn cấp đột xuất... — ưu tiên né sau cùng.

Nếu cùng một giảng viên + ngày + buổi có nhiều lý do, hệ thống giữ lý do có mức ưu tiên cao hơn.

`Cả ngày` được lưu thành hai block Sáng (1–6) và Chiều (7–12).
