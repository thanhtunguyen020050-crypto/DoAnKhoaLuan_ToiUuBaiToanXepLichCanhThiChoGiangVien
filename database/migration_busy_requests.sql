-- =====================================================================
-- MIGRATION: BỔ SUNG CHỨC NĂNG GIẢNG VIÊN BÁO BẬN VÀ ADMIN DUYỆT ĐỔI LỊCH COI THI
-- Database: DB_XepLichCoiThi_Final
-- An toàn: Kiểm tra tồn tại trước khi tạo, không xóa hay ghi đè dữ liệu cũ.
-- =====================================================================

USE DB_XepLichCoiThi_Final;
GO

-- 1. Tạo bảng YeuCauBaoBan
IF OBJECT_ID(N'dbo.YeuCauBaoBan', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.YeuCauBaoBan (
        MaYeuCau BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_YeuCauBaoBan PRIMARY KEY,
        MaGV VARCHAR(20) NOT NULL,
        MaCa VARCHAR(50) NULL,
        ThoiGianBatDauBan DATETIME2 NOT NULL,
        ThoiGianKetThucBan DATETIME2 NOT NULL,
        LyDoBaoBan NVARCHAR(500) NOT NULL,
        GhiChuGV NVARCHAR(500) NULL,
        TrangThai VARCHAR(20) NOT NULL CONSTRAINT DF_YCBB_TrangThai DEFAULT 'PENDING',
        LyDoTuChoi NVARCHAR(500) NULL,
        GhiChuAdmin NVARCHAR(500) NULL,
        NguoiXuLy NVARCHAR(100) NULL,
        ThoiGianGui DATETIME2 NOT NULL CONSTRAINT DF_YCBB_ThoiGianGui DEFAULT SYSDATETIME(),
        ThoiGianXuLy DATETIME2 NULL,
        CONSTRAINT FK_YCBB_GiangVien FOREIGN KEY (MaGV) REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT FK_YCBB_CaThi FOREIGN KEY (MaCa) REFERENCES dbo.CaThi(MaCa),
        CONSTRAINT CK_YCBB_ThoiGian CHECK (ThoiGianBatDauBan < ThoiGianKetThucBan),
        CONSTRAINT CK_YCBB_TrangThai CHECK (TrangThai IN ('PENDING', 'APPROVED', 'REJECTED'))
    );

    CREATE INDEX IX_YCBB_GV_TrangThai ON dbo.YeuCauBaoBan(MaGV, TrangThai, ThoiGianGui DESC);
    CREATE INDEX IX_YCBB_TrangThai ON dbo.YeuCauBaoBan(TrangThai, ThoiGianGui DESC);
    CREATE INDEX IX_YCBB_Ca ON dbo.YeuCauBaoBan(MaCa);

    PRINT N'>> Đã tạo thành công bảng dbo.YeuCauBaoBan';
END
ELSE
BEGIN
    PRINT N'>> Bảng dbo.YeuCauBaoBan đã tồn tại, bỏ qua tạo mới.';
END
GO

-- 2. Tạo bảng LichSuDieuChinhLich
IF OBJECT_ID(N'dbo.LichSuDieuChinhLich', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LichSuDieuChinhLich (
        MaLichSu BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LichSuDieuChinhLich PRIMARY KEY,
        MaYeuCau BIGINT NOT NULL,
        MaGV VARCHAR(20) NOT NULL,
        MaGVThayThe VARCHAR(20) NULL,
        MaCa VARCHAR(50) NOT NULL,
        PhanCongTruoc NVARCHAR(500) NOT NULL,
        PhanCongSau NVARCHAR(500) NOT NULL,
        NguoiThucHien NVARCHAR(100) NOT NULL,
        ThoiDiem DATETIME2 NOT NULL CONSTRAINT DF_LSDCL_ThoiDiem DEFAULT SYSDATETIME(),
        HanhDong NVARCHAR(100) NOT NULL,
        LyDo NVARCHAR(500) NULL,
        CONSTRAINT FK_LSDCL_YeuCau FOREIGN KEY (MaYeuCau) REFERENCES dbo.YeuCauBaoBan(MaYeuCau),
        CONSTRAINT FK_LSDCL_GiangVien FOREIGN KEY (MaGV) REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT FK_LSDCL_GiangVienThayThe FOREIGN KEY (MaGVThayThe) REFERENCES dbo.GiangVien(MaGV),
        CONSTRAINT FK_LSDCL_CaThi FOREIGN KEY (MaCa) REFERENCES dbo.CaThi(MaCa)
    );

    CREATE INDEX IX_LSDCL_YeuCau ON dbo.LichSuDieuChinhLich(MaYeuCau, ThoiDiem DESC);
    CREATE INDEX IX_LSDCL_GV ON dbo.LichSuDieuChinhLich(MaGV, ThoiDiem DESC);

    PRINT N'>> Đã tạo thành công bảng dbo.LichSuDieuChinhLich';
END
ELSE
BEGIN
    PRINT N'>> Bảng dbo.LichSuDieuChinhLich đã tồn tại, bỏ qua tạo mới.';
END
GO

-- 3. Bổ sung cột YeuCauBaoBanID vào bảng ThongBao nếu chưa có
IF OBJECT_ID(N'dbo.ThongBao', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ThongBao', N'YeuCauBaoBanID') IS NULL
BEGIN
    ALTER TABLE dbo.ThongBao ADD YeuCauBaoBanID BIGINT NULL;
    ALTER TABLE dbo.ThongBao ADD CONSTRAINT FK_TB_YCBB FOREIGN KEY (YeuCauBaoBanID) REFERENCES dbo.YeuCauBaoBan(MaYeuCau);
    PRINT N'>> Đã bổ sung cột YeuCauBaoBanID vào bảng dbo.ThongBao';
END
GO
