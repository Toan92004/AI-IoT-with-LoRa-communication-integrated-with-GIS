#include <SoftwareSerial.h>
#include <SPI.h>
#include <LoRa.h>

// --- ĐỊNH NGHĨA CHÂN KẾT NỐI ---
#define PMS_RX 4  // Nối với TX của PMS5003T
#define PMS_TX 5  // Nối với RX của PMS5003T (bỏ trống)

#define BUTTON_PIN 7 // Nút nhấn
#define BUZZER_PIN 8 // Còi báo

// --- ĐỊNH NGHĨA MỨC LOGIC CHO CÒI (Loại kích mức CAO - Module 3 chân) ---
#define BUZZER_OFF LOW
#define BUZZER_ON HIGH

// Chân giao tiếp LoRa
#define LORA_SS 10
#define LORA_RST 9
#define LORA_DIO0 2

// Khởi tạo cổng Serial ảo cho cảm biến
SoftwareSerial pmsSerial(PMS_RX, PMS_TX);

// --- CÁC BIẾN TRẠNG THÁI NÚT NHẤN/CÒI ---
bool buzzerState = false; // Mặc định trạng thái là TẮT (false)
int buttonState = HIGH;
int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0; 
unsigned long debounceDelay = 50; 

// --- BIẾN LƯU TRỮ DỮ LIỆU CẢM BIẾN ---
unsigned char pmsData[32];
float currentPM25 = 0.0; // Đã chuyển sang kiểu số thực
float currentPM10 = 0.0; // Đã chuyển sang kiểu số thực
float currentTemp = 0.0;
float currentHum = 0.0;
bool hasData = false;

// --- BIẾN HẸN GIỜ GỬI LORA ---
unsigned long lastSendTime = 0;
unsigned int sendInterval = 10000; // Gửi dữ liệu mỗi 10 giây (10000 ms)

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);

  // Cấu hình nút nhấn và còi
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // ÉP BUỘC CÒI TẮT NGAY KHI KHỞI ĐỘNG (Xuất mức LOW)
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.println("=== KHOI DONG TRAM QUAN TRAC (END-NODE) ===");

  // Thiết lập chân và khởi tạo LoRa 433MHz
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LOI: Khong the khoi tao LoRa. Kiem tra lai day SPI!");
    while (1); // Dừng hệ thống nếu lỗi LoRa
  }
  Serial.println("Khoi tao LoRa THANH CONG.");
}

void loop() {
  handleButton(); // 1. Kiểm tra nút nhấn
  readPMSData();  // 2. Cập nhật dữ liệu môi trường

  // 3. Kiểm tra xem đã đến lúc gửi LoRa chưa
  if (millis() - lastSendTime > sendInterval) {
    if (hasData) {
      sendLoRaData(); 
    } else {
      Serial.println("Chua co du lieu cam bien de gui...");
    }
    lastSendTime = millis();
  }
}

// ---------------------------------------------------------
// CÁC HÀM XỬ LÝ PHỤ TRỢ
// ---------------------------------------------------------

void handleButton() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;
      // Khi nút thực sự được nhấn xuống (Mức LOW)
      if (buttonState == LOW) {
        buzzerState = !buzzerState; // Đảo trạng thái còi
        
        // Xuất tín hiệu ra chân còi dựa theo trạng thái đã được cập nhật logic
        digitalWrite(BUZZER_PIN, buzzerState ? BUZZER_ON : BUZZER_OFF);
        Serial.println(buzzerState ? ">> NGUOI DUNG BAT COI" : ">> NGUOI DUNG TAT COI");
      }
    }
  }
  lastButtonState = reading;
}

void readPMSData() {
  if (pmsSerial.available() >= 32) {
    if (pmsSerial.read() == 0x42 && pmsSerial.peek() == 0x4D) {
      pmsData[0] = 0x42;
      pmsData[1] = pmsSerial.read(); 
      for (int i = 2; i < 32; i++) {
        pmsData[i] = pmsSerial.read();
      }

      // Lưu vào các biến toàn cục và ép sang số thực
      currentPM25 = (float)((pmsData[12] << 8) | pmsData[13]);
      currentPM10 = (float)((pmsData[14] << 8) | pmsData[15]);
      currentTemp = ((pmsData[24] << 8) | pmsData[25]) / 10.0;
      currentHum  = ((pmsData[26] << 8) | pmsData[27]) / 10.0;
      
      hasData = true;
    }
  }
}

void sendLoRaData() {
  // Đóng gói chuỗi JSON đồng nhất 1 chữ số thập phân
  String payload = "{";
  payload += "\"id\":\"Node1\","; 
  payload += "\"t\":" + String(currentTemp, 1) + ",";
  payload += "\"h\":" + String(currentHum, 1) + ",";
  payload += "\"p2\":" + String(currentPM25, 1) + ",";
  payload += "\"p10\":" + String(currentPM10, 1);
  payload += "}";

  // Phát qua sóng LoRa
  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();

  // In ra màn hình để theo dõi
  Serial.print("[LoRa TX] Da gui: ");
  Serial.println(payload);
}