#include <SoftwareSerial.h>
#include <SPI.h>
#include <LoRa.h>

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

SoftwareSerial pmsSerial(PMS_RX, PMS_TX);

// --- BIẾN TRẠNG THÁI ---
bool buzzerState = false; 
int buttonState = HIGH;
int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0; 
unsigned long debounceDelay = 50; 

unsigned char pmsData[32];
float currentPM25 = 0.0; 
float currentPM10 = 0.0; 
float currentTemp = 0.0;
float currentHum = 0.0;
bool hasData = false;

unsigned long lastSendTime = 0;
unsigned int sendInterval = 13000; 

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.println("=== KHOI DONG TRAM 2 (TRAM CHUYEN TIEP) ===");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LOI: Khong the khoi tao LoRa!");
    while (1); 
  }
  
  // Bật kiểm tra lỗi phần cứng CRC
  LoRa.enableCrc(); 
  Serial.println("Khoi tao LoRa THANH CONG. Da bat bao ve CRC.");
}

void loop() {
  handleButton(); 
  readPMSData();  
  
  // Lắng nghe sóng LoRa từ các trạm khác (như Node 1)
  receiveLoRaData(); 

  // Tự động phát dữ liệu của chính mình (Node 2)
  if (millis() - lastSendTime > sendInterval) {
    if (hasData) {
      sendLoRaData(); 
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
      if (buttonState == LOW) {
        buzzerState = !buzzerState; 
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
      currentPM25 = (float)((pmsData[12] << 8) | pmsData[13]);
      currentPM10 = (float)((pmsData[14] << 8) | pmsData[15]);
      currentTemp = ((pmsData[24] << 8) | pmsData[25]) / 10.0;
      currentHum  = ((pmsData[26] << 8) | pmsData[27]) / 10.0;
      hasData = true;
    }
  }
}

void sendLoRaData() {
  String payload = "{";
  payload += "\"id\":\"Node2\","; // Gắn nhãn là dữ liệu của Trạm 2
  payload += "\"t\":" + String(currentTemp, 1) + ",";
  payload += "\"h\":" + String(currentHum, 1) + ",";
  payload += "\"p2\":" + String(currentPM25, 1) + ",";
  payload += "\"p10\":" + String(currentPM10, 1);
  payload += "}";

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();

  Serial.print("[LoRa TX] Tram 2 tu phat: ");
  Serial.println(payload);
}

// =========================================================
// NHẬN, KIỂM TRA VÀ CHUYỂN TIẾP (MULTI-HOP)
// =========================================================

void receiveLoRaData() {
  int packetSize = LoRa.parsePacket();
  
  if (packetSize) {
    String incomingPacket = "";
    
    // Đọc từng ký tự của gói tin
    while (LoRa.available()) {
      incomingPacket += (char)LoRa.read();
    }
    
    int rssi = LoRa.packetRssi();
    Serial.print("\n[LoRa RX] Phat hien song vao (RSSI: ");
    Serial.print(rssi);
    Serial.println(" dBm)");

    // 1. Kiểm tra tính toàn vẹn 
    if (checkPacketIntegrity(incomingPacket)) {
      
      // 2. CHỐNG LẶP VÔ HẠN (Anti-Echo Logic CHO TRẠM 2)
      // Hàm indexOf tìm xem trong chuỗi có chữ "Node2" không.
      // Trạm 2 sẽ CHUYỂN TIẾP nếu KHÔNG TÌM THẤY chữ "Node2" (Tức là của Trạm 1, Trạm 3...)
      if (incomingPacket.indexOf("\"id\":\"Node2\"") == -1) {
        
        Serial.print("[HOP LE] Chuan bi chuyen tiep du lieu cua tram khac: ");
        Serial.println(incomingPacket);
        
        // Delay 100ms nhường đường sóng
        delay(100);

        // 3. Thực hiện chuyển tiếp gói tin nguyên vẹn
        LoRa.beginPacket();
        LoRa.print(incomingPacket);
        LoRa.endPacket();

        Serial.println("[Relay TX] Da chuyen tiep thanh cong!");
        
      } else {
        // Nếu thấy chữ "Node2", đây là tiếng vọng của chính nó
        Serial.println("[BO QUA] Day la goi tin cua chinh Tram 2 bi doi lai. Khong chuyen tiep.");
      }
      
    } else {
      Serial.print("[BI LOI] Goi tin vo vun/Thieu du lieu: ");
      Serial.println(incomingPacket);
    }
    Serial.println("-----------------------------------");
  }
}

// Hàm kiểm tra tính toàn vẹn
bool checkPacketIntegrity(String packet) {
  if (packet.length() < 10) {
    return false;
  }
  if (packet.startsWith("{") && packet.endsWith("}")) {
    return true; 
  }
  return false; 
}