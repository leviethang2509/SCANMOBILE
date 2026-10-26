# SCANMOBILE

Ứng dụng web hỗ trợ chụp ảnh tài liệu qua camera (Webcam / iPhone / Mobile) và xuất sang file PDF chuẩn hóa.

## 🚀 Tính năng chính
- **B1**: Chọn thư mục lưu và ghi nhớ lịch sử thư mục (sử dụng File System Access API & IndexedDB).
- **B2**: Chọn số trang bắt đầu quét và nhập tên hồ sơ.
- **B3**: Bật camera chụp lần lượt từng trang, có đánh số trang trực tiếp để đối chiếu.
- **B4**: Xem lại các trang đã chụp, hỗ trợ xoay 90°, phóng to kiểm tra nét chữ, xóa trang mờ trước khi lưu.
- **B5**: Đặt tên file tự động theo cú pháp: `TenHoSo_p(trangBatDau)_p(trangKetThuc).pdf`.
- **B6**: Xuất lưu trực tiếp vào thư mục chỉ định.
- **B7**: Dạng Web Landing Page, tương thích tối ưu và responsive riêng cho iPhone & thiết bị di động.

## 📦 Cài đặt & Khởi động
```bash
# Cài đặt thư viện
npm install

# Khởi động ứng dụng
npm start
# Hoặc nhấp đúp vào start.bat trên Windows
```
Truy cập: `http://localhost:3000`
