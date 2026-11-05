BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Xóa tài khoản của giảng viên thuộc khoa KHUD trước (tránh lỗi khóa ngoại FK_TKGV_GiangVien)
    DELETE FROM dbo.TaiKhoanGiangVien
    WHERE MaGV IN (
        SELECT gv.MaGV
        FROM dbo.GiangVien gv
        INNER JOIN dbo.BoMon bm ON gv.MaBoMon = bm.MaBoMon
        WHERE bm.MaKhoa = 'KHUD'
    ) OR MaGV LIKE 'KHUD%';

    -- 2. Xóa giảng viên thuộc các bộ môn của KHUD
    DELETE FROM dbo.GiangVien
    WHERE MaBoMon IN (
        SELECT MaBoMon
        FROM dbo.BoMon
        WHERE MaKhoa = 'KHUD'
    ) OR MaGV LIKE 'KHUD%';

    -- 3. Xóa các bộ môn thuộc KHUD
    DELETE FROM dbo.BoMon
    WHERE MaKhoa = 'KHUD';

    -- 4. Xóa khoa KHUD
    DELETE FROM dbo.Khoa
    WHERE MaKhoa = 'KHUD';

    COMMIT TRANSACTION;

    PRINT N'Đã xóa dữ liệu Khoa Khoa học Ứng dụng thành công.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT N'Lỗi khi xóa dữ liệu: ' + ERROR_MESSAGE();
END CATCH;
GO

-- =============================================
-- THÊM DỮ LIỆU KHOA KHOA HỌC ỨNG DỤNG
-- =============================================
INSERT INTO dbo.Khoa(MaKhoa, TenKhoa)
VALUES('KHUD', N'Khoa Khoa học Ứng dụng');
GO

-- =============================================
-- CÁC BỘ MÔN
-- =============================================
INSERT INTO dbo.BoMon(MaBoMon, MaKhoa, TenBoMon)
VALUES
('KHUD_TOAN', 'KHUD', N'Toán học'),
('KHUD_VLY', 'KHUD', N'Vật lý');
GO

-- =============================================
-- GIẢNG VIÊN BỘ MÔN
-- =============================================
INSERT INTO dbo.GiangVien(MaGV, HoTen, HocVi, ChucVu, Email, MaBoMon)
VALUES
-- GIẢNG VIÊN BỘ MÔN TOÁN
('KHUD0001', N'Đinh Vinh Hiển', N'Tiến sĩ', N'Phó trưởng khoa, Trưởng bộ môn Toán', NULL, 'KHUD_TOAN'),
('KHUD0002', N'Nguyễn Văn Hiếu', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0003', N'Trần Đăng Hùng', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0004', N'Nguyễn Đình Inh', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0005', N'Dương Hoàng Kiệt', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0006', N'Bùi Đức Nam', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0007', N'Vũ Thị Phượng', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0008', N'Đoàn Thị Như Quỳnh', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0009', N'Võ Thành Sơn', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0010', N'Lê Hữu Kỳ Sơn', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0011', N'Dương Thị Mộng Thường', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0012', N'Đỗ Đức Tân', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0013', N'Nguyễn Quốc Tiến', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0014', N'Đào Thị Trang', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),
('KHUD0015', N'Nguyễn Văn Ý', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_TOAN'),

-- GIẢNG VIÊN BỘ MÔN VẬT LÝ
('KHUD0016', N'Nguyễn Tuấn Anh', N'Tiến sĩ', N'Trưởng khoa', NULL, 'KHUD_VLY'),
('KHUD0017', N'Hoàng Minh Đồng', N'PGS.Tiến sĩ', N'Trưởng bộ môn Vật lý', NULL, 'KHUD_VLY'),
('KHUD0018', N'Nguyễn Thị Thu Hiền', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_VLY'),
('KHUD0019', N'Trang Huỳnh Đăng Khoa', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_VLY'),
('KHUD0020', N'Lê Mai Trinh', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_VLY'),
('KHUD0021', N'Bùi Quốc Trung', N'Thạc sĩ', N'Giảng viên', NULL, 'KHUD_VLY'),
('KHUD0022', N'Tạ Thị Kim Tuyến', N'Tiến sĩ', N'Giảng viên', NULL, 'KHUD_VLY');
GO

-- =============================================
-- LỆNH TẠO TÀI KHOẢN
-- =============================================
INSERT INTO dbo.TaiKhoanGiangVien
    (MaGV, PasswordHash, MustChangePassword, IsActive)
SELECT gv.MaGV, NULL, 1, 1
FROM dbo.GiangVien gv
WHERE gv.TrangThai = N'Đang công tác'
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.TaiKhoanGiangVien tk
      WHERE tk.MaGV = gv.MaGV
  );
GO