# SCANMOBILE 📱📄

Ứng dụng web tĩnh (Pure HTML5, CSS3, JavaScript) hỗ trợ chụp ảnh tài liệu qua camera (Webcam / iPhone / Mobile) và xuất sang file PDF chuẩn hóa theo hồ sơ.

🌐 **Trang Web Trực Tiếp (GitHub Pages):**  
👉 [https://leviethang2509.github.io/SCANMOBILE/](https://leviethang2509.github.io/SCANMOBILE/)

---

## 🚀 Tính năng chính
- **B1**: Chọn thư mục lưu và ghi nhớ lịch sử thư mục (sử dụng File System Access API & IndexedDB & localStorage).
- **B2**: Chọn số trang bắt đầu quét và nhập tên hồ sơ (xem trước tên file thời gian thực).
- **B3**: Bật camera chụp lần lượt từng trang, có đánh số trang trực tiếp `ĐANG CHỤP TRANG X` để đối chiếu, hỗ trợ phím Space/Enter và rung phản hồi (Haptic).
- **B4**: Xem lại các trang đã chụp, hỗ trợ xoay 90°, phóng to kiểm tra nét chữ, đổi thứ tự hoặc xóa trang mờ trước khi lưu.
- **B5**: Tự động đặt tên file theo đúng cú pháp: `TenHoSo_p(trangBatDau)_p(trangKetThuc).pdf`.
- **B6**: Xuất lưu trực tiếp vào thư mục chỉ định, hỗ trợ chia sẻ / lưu vào Tệp (Files / AirDrop / Zalo) trên iPhone.
- **B7**: Dạng Web thuần HTML/CSS/JS chạy trực tiếp trên GitHub Pages và máy tính/di động mà không cần cài đặt backend phức tạp.

## 📱 Hỗ trợ iPhone & Thiết bị di động
- Tương thích hoàn toàn với iOS Safari (tránh lỗi phóng to tự động khi chạm vào ô nhập).
- Khung hình Camera ưu tiên tỉ lệ 3:4 dọc cho tài liệu A4.
- Thanh nút chụp ghim ở cạnh dưới (Sticky Bottom Thumb Bar) thao tác bằng ngón cái.
- Nút chuyển đổi nhanh camera trước/sau.

## 📦 Chạy cục bộ (Offline)
Bạn có thể mở trực tiếp file `index.html` trong bất kỳ trình duyệt nào, hoặc khởi động server cục bộ nếu muốn hỗ trợ thêm tính năng ghi vào ổ cứng Windows bằng Node.js:
```bash
# Khởi động máy chủ cục bộ (nếu có Node.js)
npm start
# Hoặc nhấp đúp file start.bat trên Windows
```
Truy cập: `http://localhost:3000`
