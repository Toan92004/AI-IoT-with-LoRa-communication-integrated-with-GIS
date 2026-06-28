# Hệ thống AIoT Giám sát và Cảnh báo Thông số Môi trường 🌍

Dự án Hệ thống AIoT quan trắc đa điểm, ứng dụng công nghệ truyền dẫn không dây tầm xa LoRa tích hợp hệ thống Thông tin Địa lý (GIS) và Trí tuệ Nhân tạo (AI) để phân tích, dự báo rủi ro môi trường.

---

## 🏗 Kiến trúc Hệ thống (Hybrid Architecture)

Hệ thống sử dụng mô hình kết hợp (Hybrid) giữa giao tiếp phần cứng nội bộ (I2C), truyền thông vô tuyến tầm xa (LoRa), giao thức truyền tin thời gian thực đám mây (MQTT) và cơ sở dữ liệu NoSQL chuyên xử lý chuỗi thời gian (MongoDB).

### 1. Phân hệ Phần cứng & Cảm biến (Edge Devices)

- **Trạm thu thập (Sensor Node & Aggregator):** Sử dụng vi điều khiển **Arduino Uno R3** kết hợp cảm biến đa năng **PMS5003T** (đo Nhiệt độ, Độ ẩm, PM2.5, PM10). Truyền dữ liệu nội bộ qua **LoRa SX1278 (433MHz)**.
- **Trạm trung chuyển (LoRa Gateway):** Sử dụng **ESP32**. Đóng vai trò cầu nối, nhận dữ liệu I2C từ Arduino Master, giải mã và đóng gói JSON đẩy lên Internet qua Wi-Fi.
- **Nguồn điện:** Sử dụng pin lưu trữ Lithium 18650 kết hợp mạch sạc TP4056 và năng lượng mặt trời. Cơ cấu chấp hành sử dụng Còi hú (Buzzer) báo động tại chỗ.

### 2. Phân hệ Máy chủ & Lưu trữ (Backend & Database)

- **Máy chủ:** Node.js (Express.js), quản lý luồng dữ liệu hai chiều (Upstream/Downlink) thông qua giao thức MQTT kết nối với Broker HiveMQ Cloud.
- **Cơ sở dữ liệu:** MongoDB Atlas. Lưu trữ dữ liệu cảm biến (Time-Series) và cấu hình không gian trạm đo (GeoJSON).
- **Dịch vụ thông báo:** Tích hợp Nodemailer tự động điều phối gửi Email khẩn cấp khi có sự cố.

### 3. Phân hệ Trí tuệ Nhân tạo (AI Service)

- **Mô hình:** Mạng nơ-ron hồi quy bộ nhớ ngắn-dài (**LSTM**).
- **Nhiệm vụ:** Phân tích đặc trưng phi tuyến của chuỗi dữ liệu cửa sổ trượt (Sliding Window 12 mốc thời gian), phát hiện bất thường và tính toán xác suất rủi ro (Risk Score).
- **Triển khai:** Chạy độc lập dưới dạng Microservice (Python/FastAPI) trên nền tảng Render.

### 4. Phân hệ Giao diện (WebGIS Dashboard)

- **Công nghệ:** Core UI Framework kết hợp thư viện bản đồ số Leaflet/Mapbox.
- **Tính năng:** Trực quan hóa dữ liệu bằng AI Heatmap (Bản đồ nhiệt), biểu đồ xu hướng, quản lý thiết bị, cấu hình ngưỡng cảnh báo phần cứng từ xa (Downlink OTA).

---

## 🚀 Hướng dẫn Cài đặt & Vận hành

### Yêu cầu tiền quyết (Prerequisites)

- Arduino IDE (với các thư viện: `LoRa.h`, `Wire.h`, `PubSubClient.h`, `WiFiClientSecure.h`).
- Node.js (v16+).
- Python 3.8+ (cho AI Service).
- Tài khoản MongoDB Atlas và HiveMQ Cloud.

### Bước 1: Nạp Firmware cho Phần cứng

1. Clone repository: `git clone https://github.com/Toan92004/AI-IoT-with-LoRa-communication-integrated-with-GIS.git`
2. Mở các file `.ino` trong thư mục `/firmware` bằng Arduino IDE.
3. Thay đổi thông tin mạng Wi-Fi và MQTT Credentials trong file `esp32.ino`.
4. Nạp code cho Arduino Uno (Trạm 1, Trạm 2, Trạm 3) và ESP32 Gateway.

### Bước 2: Khởi động Backend Node.js

1. Di chuyển vào thư mục backend: `cd backend`
2. Cài đặt các gói thư viện: `npm install`
3. Cấu hình các biến môi trường trong file `.env` (MongoDB URI, Email App Password, HiveMQ Credentials).
4. Khởi chạy máy chủ và Worker: `npm start`

### Bước 3: Triển khai AI Service (Python)

1. Di chuyển vào thư mục AI: `cd ai_service`
2. Cài đặt thư viện: `pip install -r requirements.txt`
3. Chạy máy chủ suy luận: `uvicorn main:app --host 0.0.0.0 --port 8000`

---

## 📊 Luồng xử lý Cảnh báo Thông minh

Hệ thống sử dụng cơ chế bảo vệ kép:

1. **Dựa trên ngưỡng tĩnh (Threshold-based):** Báo động ngay lập tức nếu dữ liệu thực tế vượt ngưỡng cấu hình (VD: T > 35°C).
2. **Dựa trên AI (Predictive):** AI phân tích gia tốc biến thiên của dữ liệu lịch sử và tự động gán nhãn rủi ro. Nếu `Risk Score >= 70%`, hệ thống kích hoạt cảnh báo đỏ trên WebGIS và điều phối Email khẩn cấp đến kỹ thuật viên phụ trách phân khu trước khi sự cố thực sự xảy ra.

---

## 📜 Giấy phép & Trích dẫn

Dự án được phát triển nhằm mục đích phục vụ nghiên cứu và bảo vệ đồ án tốt nghiệp Trường Đại học Hàng hải Việt Nam (2026). Vui lòng trích dẫn nguồn nếu sử dụng lại các module AI hoặc sơ đồ mạch điện từ repository này.
