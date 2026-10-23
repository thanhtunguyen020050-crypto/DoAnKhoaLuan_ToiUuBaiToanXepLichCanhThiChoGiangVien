-- =====================================================================
-- ROLLBACK: GỠ BỎ CHỨC NĂNG GIẢNG VIÊN BÁO BẬN VÀ ADMIN DUYỆT ĐỔI LỊCH COI THI
-- Database: DB_XepLichCoiThi_Final
-- CẢNH BÁO: Script này sẽ XÓA VĨNH VIỄN dữ liệu trong các bảng liên quan.
--           Hãy sao lưu database trước khi chạy.
-- Thứ tự xóa: đảo ngược migration (xóa FK trước, rồi mới xóa bảng con → bảng cha)
-- =====================================================================

USE DB_XepLichCoiThi_Final;
GO

-- 1. Gỡ FK và cột YeuCauBaoBanID khỏi bảng ThongBao
IF OBJECT_ID(N'dbo.ThongBao', N'U') IS NOT NULL
BEGIN
    -- Xóa foreign key trước
    IF OBJECT_ID(N'dbo.FK_TB_YCBB', N'F') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.ThongBao DROP CONSTRAINT FK_TB_YCBB;
        PRINT N'>> Đã xóa FK FK_TB_YCBB trên dbo.ThongBao';
    END

    -- Xóa cột
    IF COL_LENGTH(N'dbo.ThongBao', N'YeuCauBaoBanID') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.ThongBao DROP COLUMN YeuCauBaoBanID;
        PRINT N'>> Đã xóa cột YeuCauBaoBanID khỏi dbo.ThongBao';
    END
END
GO

-- 2. Xóa bảng LichSuDieuChinhLich (bảng con, phụ thuộc YeuCauBaoBan)
IF OBJECT_ID(N'dbo.LichSuDieuChinhLich', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.LichSuDieuChinhLich;
    PRINT N'>> Đã xóa bảng dbo.LichSuDieuChinhLich';
END
ELSE
BEGIN
    PRINT N'>> Bảng dbo.LichSuDieuChinhLich không tồn tại, bỏ qua.';
END
GO

-- 3. Xóa bảng YeuCauBaoBan (bảng cha, xóa sau cùng)
IF OBJECT_ID(N'dbo.YeuCauBaoBan', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.YeuCauBaoBan;
    PRINT N'>> Đã xóa bảng dbo.YeuCauBaoBan';
END
ELSE
BEGIN
    PRINT N'>> Bảng dbo.YeuCauBaoBan không tồn tại, bỏ qua.';
END
GO

PRINT N'';
PRINT N'====================================================';
PRINT N'ROLLBACK HOÀN TẤT. Chức năng báo bận đã được gỡ bỏ.';
PRINT N'====================================================';
