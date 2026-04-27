#include <SoftwareSerial.h>
#include <SPI.h>
#include <LoRa.h>
#include <Wire.h> // Thư viện giao tiếp I2C

// --- ĐỊNH NGHĨA CHÂN KẾT NỐI ---
#define PMS_RX 4  
#define PMS_TX 5  
#define BUTTON_PIN 7 
#define BUZZER_PIN 8 

// --- MỨC LOGIC CÒI (Kích mức CAO) ---
#define BUZZER_OFF LOW
#define BUZZER_ON HIGH

// --- CHÂN GIAO TIẾP LORA ---
#define LORA_SS 10
#define LORA_RST 9
#define LORA_DIO0 2

// ESP32 I2C Address
#define ESP32_I2C_ADDR 8 

SoftwareSerial pmsSerial(PMS_RX, PMS_TX);

// --- BIẾN TRẠNG THÁI NÚT NHẤN/CÒI ---
bool buzzerState = false; 
int buttonState = HIGH;
int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0; 
unsigned long debounceDelay = 50; 

// --- BIẾN LƯU TRỮ DỮ LIỆU CẢM BIẾN ---
unsigned char pmsData[32];
float currentPM25 = 0.0; 
float currentPM10 = 0.0; 
float currentTemp = 0.0;
float currentHum = 0.0;
bool hasData = false;

// --- BIẾN HẸN GIỜ GỬI DỮ LIỆU TRẠM 3 ---
unsigned long lastSendTime = 0;
unsigned int sendInterval = 10000; 

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);
  
  // Khởi tạo I2C với vai trò Master
  Wire.begin(); 

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.println("=== KHOI DONG TRAM 3 (MASTER I2C & LORA GATEWAY) ===");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LOI: Khong the khoi tao LoRa!");
    while (1); 
  }
  LoRa.enableCrc(); 
  Serial.println("Khoi tao LoRa & I2C THANH CONG.");
}

void loop() {
  handleButton(); // Quét nút nhấn bật/tắt còi
  readPMSData();  // Đọc dữ liệu môi trường tại Trạm 3
  
  receiveLoRaData(); // Lắng nghe sóng từ Trạm 1 và Trạm 2

  // Tự động thu thập dữ liệu Trạm 3 và đẩy sang ESP32
  if (millis() - lastSendTime > sendInterval) {
    if (hasData) {
      String payload = "{";
      payload += "\"id\":\"Node3\","; 
      payload += "\"t\":" + String(currentTemp, 1) + ",";
      payload += "\"h\":" + String(currentHum, 1) + ",";
      payload += "\"p2\":" + String(currentPM25, 1) + ",";
      payload += "\"p10\":" + String(currentPM10, 1);
      payload += "}";

      Serial.print("[TRAM 3] Du lieu rieng: ");
      Serial.println(payload);
      
      // Gửi sang ESP32
      sendToESP32viaI2C(payload);
    }
    lastSendTime = millis();
  }
}

// ---------------------------------------------------------
// HÀM XỬ LÝ LORA VÀ I2C
// ---------------------------------------------------------

// Hàm nhận và kiểm tra dữ liệu từ Node 1, Node 2
void receiveLoRaData() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incomingPacket = "";
    while (LoRa.available()) {
      incomingPacket += (char)LoRa.read();
    }
    
    // KIỂM TRA TOÀN VẸN Ở TRẠM 3
    if (checkPacketIntegrity(incomingPacket)) {
      Serial.print("[LORA RX] Nhan duoc goi tin hop le: ");
      Serial.println(incomingPacket);
      
      // Bắn thẳng sang ESP32 qua I2C
      sendToESP32viaI2C(incomingPacket);
    } else {
      Serial.println("[LORA RX] Goi tin loi, huy bo!");
    }
  }
}

// Thuật toán băm nhỏ chuỗi để lách luật 32-byte của I2C
void sendToESP32viaI2C(String packet) {
  int len = packet.length();
  int pos = 0;
  
  while (pos < len) {
    Wire.beginTransmission(ESP32_I2C_ADDR);
    int chunk = min(30, len - pos); // Gửi tối đa 30 ký tự mỗi lần
    for (int i = 0; i < chunk; i++) {
      Wire.write(packet[pos + i]);
    }
    Wire.endTransmission();
    pos += chunk;
    delay(5); // Nghỉ 5ms để ESP32 kịp nhận
  }
  
  // Gửi ký tự '\n' (Xuống dòng) để báo cho ESP32 biết đã kết thúc gói tin
  Wire.beginTransmission(ESP32_I2C_ADDR);
  Wire.write('\n');
  Wire.endTransmission();
  
  Serial.println("[I2C TX] Da day sang ESP32 thanh cong!");
}

bool checkPacketIntegrity(String packet) {
  if (packet.length() < 10) return false;
  if (packet.startsWith("{") && packet.endsWith("}")) return true; 
  return false; 
}

// ---------------------------------------------------------
// HÀM XỬ LÝ NÚT NHẤN VÀ CẢM BIẾN (TỪ TRẠM 1/2)
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
    // Tìm Header 0x42 và 0x4D của bản tin PMS5003T
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
      
      hasData = true; // Đánh dấu là đã lấy được dữ liệu hợp lệ
    }
  }
}