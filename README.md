# 🌍 AIoT-based Environmental Monitoring and Early Warning System

_(Hệ thống AIoT Giám sát và Cảnh báo sớm thông số môi trường)_

Một giải pháp hệ thống nhúng thông minh (IoT) kết hợp Trí tuệ nhân tạo (AI) giúp giám sát thời gian thực và dự báo sớm nguy cơ hỏa hoạn, ô nhiễm không khí tại các khu công nghiệp thông qua mạng viễn thông tầm xa LoRa và kiến trúc Microservices.

---

## 🚀 Giới thiệu (Introduction)

Các hệ thống quan trắc truyền thống hiện nay đa phần mang tính **"phản ứng thụ động"** (chỉ báo động khi sự cố đã xảy ra). Đồ án này giải quyết triệt để vấn đề đó bằng cách tích hợp mô hình Học sâu **LSTM (Long Short-Term Memory)**.

Thay vì chờ nhiệt độ chạm ngưỡng nguy hiểm, hệ thống phân tích "gia tốc" biến thiên của 4 thông số môi trường (Nhiệt độ, Độ ẩm, PM2.5, PM10) trong một cửa sổ thời gian (Sliding Window) để phát hiện xu hướng dị thường và đưa ra cảnh báo khẩn cấp trước khi thảm họa thực sự bùng phát.

## ✨ Tính năng nổi bật (Key Features)

- **Dự báo chủ động (AI Early Warning):** Mạng LSTM phân tích chuỗi thời gian (12 mốc = 3 giờ) để nội suy xác suất rủi ro hỏa hoạn trong tương lai.
- **Bộ lọc xung kích (Spike Filter):** Đi tắt qua chu kỳ của AI, ép hệ thống tính toán khẩn cấp ngay lập tức nếu phát hiện biến thiên gia tốc bất thường (Nhiệt độ tăng > 2°C hoặc PM2.5 vọt > 40µg/m³ trong 30s).
- **Quản lý N-Trạm động (Dynamic N-Nodes):** Tự động cấp phát vùng nhớ RAM và bộ đếm chu kỳ độc lập cho từng trạm mới ngay khi chúng kết nối vào mạng LoRa mà không cần khởi động lại Server.
- **Tự chữa lành dữ liệu (Data Healing):** Thuật toán Forward Fill tự động điền bù dữ liệu nếu mạng LoRa bị rớt gói tin, giúp AI không bị "mù" lịch sử.
- **Tối ưu hóa cơ sở dữ liệu (Deduplication):** Lọc và chặn các gói tin tĩnh (không biến động > 0.1) lưu vào MongoDB để tiết kiệm băng thông và dung lượng.
- **Hệ thống điều phối lai (Hybrid Alerting):** Kết hợp cảnh báo tĩnh (Còi hú tại biên) và cảnh báo thông minh (Hệ thống tự động điều phối gửi Email theo chu kỳ dãn cách).

## 🏗️ Kiến trúc hệ thống (System Architecture)

Hệ thống được thiết kế theo tiêu chuẩn **Event-Driven Microservices**, phân rã thành 4 lớp độc lập:

1. **Edge Layer (Hạ tầng Biên):** Các node cảm biến (Arduino/ESP32 + PMS5003T) thu thập dữ liệu và truyền qua sóng vô tuyến LoRa (tích hợp cơ chế Multi-hop). Năng lượng được duy trì bằng Pin mặt trời.
2. **Ingestion Layer (Dịch vụ nền - `worker.cjs`):** Tiến trình nền bắt gói tin MQTT (HiveMQ), lọc rác dữ liệu, đối chiếu ngưỡng tĩnh và kích hoạt luồng cảnh báo Email.
3. **AI Compute Layer (Dịch vụ Trí tuệ nhân tạo - `ai_service.py`):** REST API Server bằng FastAPI nạp mô hình `.h5` (đã được fix DTypePolicy), chịu trách nhiệm suy luận ma trận đa chiều.
4. **Delivery Layer (Dịch vụ Trung tâm - `server.js`):** Node.js Backend phục vụ dữ liệu cấu hình, trạng thái và tọa độ cho Frontend WebGIS Dashboard.

## 🛠️ Công nghệ sử dụng (Technologies)

- **Phần cứng (Hardware):** Arduino UNO, ESP32, PMS5003T, LoRa SX1278, Solar Panel.
- **AI / Học máy (Deep Learning):** Python, TensorFlow/Keras, Pandas, NumPy, Scikit-learn.
- **Backend:** Node.js, Express, FastAPI, Uvicorn.
- **Giao thức & Lưu trữ:** MQTT (HiveMQ Cloud), MongoDB Atlas.
- **Frontend:** React, Vite, Tailwind CSS, Leaflet (WebGIS).

---

## ⚙️ Hướng dẫn cài đặt & Khởi chạy (Installation & Usage)

### 1. Khởi chạy Dịch vụ AI (Python)

_Yêu cầu: Python 3.8+_

```bash
# Cài đặt thư viện
pip install fastapi uvicorn tensorflow numpy h5py pydantic

# Khởi chạy AI Server (Mặc định chạy ở cổng 8000)
python ai_service.py
```

### 2. Khởi chạy Backend & Worker (Node.js)

_Yêu cầu: Node.js 16+_

```bash
# Cài đặt thư viện
npm install

# Khởi chạy dịch vụ nền (Lắng nghe MQTT & Gửi Email)
node worker.cjs

# Khởi chạy API Server phục vụ WebGIS (Chạy ở cổng 5000)
npm start
# hoặc
node server.js
```

### 3. Cấu hình Biến môi trường (Tùy chọn)

```bash
Thay đổi các tham số nhạy cảm trong code hoặc thông qua file .env:

Chuỗi kết nối MongoDB Atlas.

Tài khoản & Mật khẩu HiveMQ.

App Password của Gmail để nodemailer có thể gửi thư.
```

### 👨‍💻 Nhóm phát triển (Team Members)

```bash
Đồ án Tốt nghiệp - Ngành Công nghệ Thông tin (Niên khóa 2022 - 2026) Trường Đại học Hàng hải Việt Nam

Nguyễn Quang Linh - Kiến trúc sư AI & Tiền xử lý dữ liệu (Data & AI Model).

Đỗ Danh Toàn - Kỹ sư Hệ thống nhúng & Truyền thông LoRa (IoT Hardware & Firmware).

Nguyễn Viết Thiên Kim - Kỹ sư Phần mềm & Kiến trúc Backend (WebGIS & Backend API).

Giảng viên hướng dẫn: ThS. Phạm Trung Minh

```
