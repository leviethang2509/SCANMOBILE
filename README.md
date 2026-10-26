# SCANMOBILE 📱📄

Ứng dụng web tĩnh (Pure HTML5, CSS3, JavaScript) hỗ trợ chụp ảnh tài liệu qua camera (Webcam / iPhone / Mobile) và xuất sang file PDF chuẩn hóa theo cây thư mục hồ sơ.

🌐 **Trang Web Trực Tiếp (GitHub Pages):**  
👉 [https://leviethang2509.github.io/SCANMOBILE/](https://leviethang2509.github.io/SCANMOBILE/)

---

## 🚀 Tính năng chính
- **B1**: **Quản lý & Chọn Cây Thư Mục**: Giao diện cây thư mục trực quan, hỗ trợ tạo thư mục mới, thư mục con nhiều cấp và ghi nhớ vĩnh viễn trên trình duyệt.
- **B2**: Chọn số trang bắt đầu quét và nhập tên hồ sơ (xem trước tên file thời gian thực).
- **B3**: Bật camera chụp lần lượt từng trang, có đánh số trang trực tiếp `ĐANG CHỤP TRANG X` để đối chiếu, hỗ trợ phím Space/Enter và rung phản hồi (Haptic).
- **B4**: Xem lại các trang đã chụp, hỗ trợ xoay 90°, phóng to kiểm tra nét chữ, đổi thứ tự hoặc xóa trang mờ trước khi lưu.
- **B5**: Tự động đặt tên file theo đúng cú pháp: `TenHoSo_p(trangBatDau)_p(trangKetThuc).pdf`.
- **B6**: **Xuất lưu vào Cây Thư Mục trên iPhone & Android (APK)**:
  - **Trên iPhone**: Bấm *"📱 Chọn Cây Thư Mục Lưu"* ➔ Chọn *"Lưu vào Tệp (Files)"* ➔ Duyệt đến bất kỳ thư mục nào trên máy hoặc iCloud Drive!
  - **Trên Android (APK)**: Hỗ trợ lưu thẳng vào ứng dụng Quản lý tệp của máy hoặc Google Drive.
- **B7**: Dạng Web thuần HTML/CSS/JS chạy trực tiếp trên GitHub Pages, hỗ trợ cài đặt dạng PWA / WebAPK trên Android.

## 📱 Hỗ trợ iPhone & Android (APK)
- Tương thích hoàn toàn với iOS Safari (tránh lỗi phóng to tự động khi chạm vào ô nhập).
- Khung hình Camera ưu tiên tỉ lệ 3:4 dọc cho tài liệu A4.
- Thanh nút chụp ghim ở cạnh dưới (Sticky Bottom Thumb Bar) thao tác bằng ngón cái.
- Nút chuyển đổi nhanh camera trước/sau.
- Cài đặt dạng APK/PWA: Nhấn menu trình duyệt (3 chấm) ➔ *"Cài đặt ứng dụng / Thêm vào màn hình chính"*.

## 📦 Chạy cục bộ (Offline)
Bạn có thể mở trực tiếp file `index.html` trong bất kỳ trình duyệt nào, hoặc khởi động server cục bộ nếu muốn hỗ trợ thêm tính năng ghi vào ổ cứng Windows bằng Node.js:
```bash
# Khởi động máy chủ cục bộ (nếu có Node.js)
npm start
# Hoặc nhấp đúp file start.bat trên Windows
```
Truy cập: `http://localhost:3000`
