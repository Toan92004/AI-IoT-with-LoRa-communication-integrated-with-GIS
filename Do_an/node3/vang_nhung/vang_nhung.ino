#include <SoftwareSerial.h>
#include <SPI.h>
#include <LoRa.h>
#include <Wire.h> 
#include <Adafruit_INA219.h>

#define PMS_RX 4  
#define PMS_TX 5  
#define BUTTON_PIN 7 
#define BUZZER_PIN 8 
#define BUZZER_OFF LOW
#define BUZZER_ON HIGH

#define LORA_SS 10
#define LORA_RST 9
#define LORA_DIO0 2
#define ESP32_I2C_ADDR 8 

SoftwareSerial pmsSerial(PMS_RX, PMS_TX);
Adafruit_INA219 ina219_uno(0x40);

bool buzzerState = false; 
int buttonState = HIGH;
int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0; 
unsigned long debounceDelay = 50;

unsigned char pmsData[32];
float currentPM25 = 0.0, currentPM10 = 0.0, currentTemp = 0.0, currentHum = 0.0;
bool hasData = false;

// Cờ dung lỗi INA219
bool inaReady = false; 

unsigned long lastSendTime = 0;
unsigned long sendInterval = 293000; 
unsigned long lastLoRaCheck = 0;

// Các biến lưu trữ ngưỡng an toàn hệ thống (Cập nhật động)
float maxTemp = 35.0;
float maxHum = 80.0;
float maxPM25 = 100.0;

unsigned long lastPollTime = 0;
unsigned long pollInterval = 3000; // Định kỳ 3s hỏi ESP32 một lần

void parseAndSetThresholds(String json) {
  int tIdx = json.indexOf("\"t_max\":");
  int hIdx = json.indexOf("\"h_max\":");
  int pIdx = json.indexOf("\"p_max\":");
  
  if (tIdx != -1) maxTemp = json.substring(tIdx + 8, json.indexOf(",", tIdx)).toFloat();
  if (hIdx != -1) maxHum = json.substring(hIdx + 8, json.indexOf(",", hIdx)).toFloat();
  if (pIdx != -1) maxPM25 = json.substring(pIdx + 8, json.indexOf("}", pIdx)).toFloat();

  Serial.println("\n[SYSTEM] DA CAP NHAT NGUONG MOI:");
  Serial.print("-> Temp Max: "); Serial.println(maxTemp);
  Serial.print("-> Hum Max: "); Serial.println(maxHum);
  Serial.print("-> PM2.5 Max: "); Serial.println(maxPM25);
}

void checkDownlinkConfig() {
  Wire.requestFrom(ESP32_I2C_ADDR, 96);
  String incoming = "";
  while (Wire.available()) {
    char c = Wire.read();
    if (c == '\0' || c == '\n') break;
    incoming += c;
  }
  
  if (incoming.length() > 10 && incoming.indexOf("\"cmd\":\"sync\"") != -1) {
    parseAndSetThresholds(incoming);
    
    // Phát sóng LoRa đồng bộ xuống Trạm 2 và Trạm 1
    delay(200);
    LoRa.beginPacket();
    LoRa.print(incoming);
    LoRa.endPacket();
    Serial.println("[LoRa TX] Da phat lenh dong bo nguong sang toan mang luoi.");
  }
}

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);
  Wire.begin(); 

  if (!ina219_uno.begin()) {
    Serial.println("Loi INA219 Uno - Chuyen sang che do v_uno = 0.0");
    inaReady = false;
  } else {
    Serial.println("INA219 khoi tao thanh cong!");
    inaReady = true; 
  }

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    while (1); 
  }
  LoRa.enableCrc();
  Serial.println("=== TRAM 3 OPERATIONAL ===");
}

void loop() {
  handleButton(); 
  readPMSData();
  
  // Tối ưu hóa giống Trạm 2
  if (millis() - lastLoRaCheck > 100) {
    receiveLoRaData();
    lastLoRaCheck = millis();
  }

  // Kiểm tra Downlink từ ESP32 theo chu kỳ
  if (millis() - lastPollTime > pollInterval) {
    checkDownlinkConfig();
    lastPollTime = millis();
  }

  if (millis() - lastSendTime > sendInterval) {
    if (hasData) {
      float v_uno = 0.0;
      if (inaReady == true) {
        v_uno = ina219_uno.getBusVoltage_V(); 
      } else {
        if (ina219_uno.begin()) {
          Serial.println("\n[SYSTEM] Da tim thay INA219, khoi phuc viec doc du lieu!");
          inaReady = true; 
          v_uno = ina219_uno.getBusVoltage_V(); 
        }
      }

      String payload = "{";
      payload += "\"id\":\"Node3\","; 
      payload += "\"t\":" + String(currentTemp, 1) + ",";
      payload += "\"h\":" + String(currentHum, 1) + ",";
      payload += "\"p2\":" + String(currentPM25, 1) + ",";
      payload += "\"p10\":" + String(currentPM10, 1) + ",";
      payload += "\"b_uno\":" + String(v_uno, 2);
      payload += "}";
      
      Serial.print("[TRAM 3] Du lieu rieng: ");
      Serial.println(payload);
      
      sendToESP32viaI2C(payload);
    } else {
      Serial.println("[LOI] Chua co du lieu tu cam bien bui min. Dang doi...");
    }
    lastSendTime = millis();
  }
}

void receiveLoRaData() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incomingPacket = "";
    while (LoRa.available()) incomingPacket += (char)LoRa.read();
    
    // Kiểm tra xem sóng thuộc về Trạm nào để thông báo
    if (incomingPacket.indexOf("\"id\":\"Node1\"") != -1) {
      Serial.println("\n[LoRa RX] TRAM 3 da bat duoc song LoRa tu TRAM 1!"); 
    } else if (incomingPacket.indexOf("\"id\":\"Node2\"") != -1) {
      Serial.println("\n[LoRa RX] TRAM 3 da bat duoc song LoRa tu TRAM 2!"); 
    }

    if (checkPacketIntegrity(incomingPacket)) {
      if (incomingPacket.indexOf("\"cmd\":\"sync\"") == -1) {
        Serial.print("[I2C TX] Dang day goi tin sang ESP32: ");
        Serial.println(incomingPacket);
        sendToESP32viaI2C(incomingPacket); 
      }
    } else {
      Serial.println("[LOI] Goi tin LoRa bi hong hoac nhieu song.");
    }
  }
}

void sendToESP32viaI2C(String packet) {
  int len = packet.length();
  int pos = 0;
  while (pos < len) {
    Wire.beginTransmission(ESP32_I2C_ADDR);
    int chunk = min(30, len - pos);
    for (int i = 0; i < chunk; i++) Wire.write(packet[pos + i]);
    Wire.endTransmission();
    pos += chunk;
    delay(5); 
  }
  Wire.beginTransmission(ESP32_I2C_ADDR);
  Wire.write('\n');
  Wire.endTransmission();
}

bool checkPacketIntegrity(String packet) {
  if (packet.length() < 10) return false;
  return (packet.startsWith("{") && packet.endsWith("}"));
}

void handleButton() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) lastDebounceTime = millis();
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonState) {
      buttonState = reading;
      if (buttonState == LOW) {
        buzzerState = !buzzerState;
        digitalWrite(BUZZER_PIN, buzzerState ? BUZZER_ON : BUZZER_OFF);
      }
    }
  }
  lastButtonState = reading;
}

void readPMSData() {
  while (pmsSerial.available() >= 32) {
    if (pmsSerial.read() == 0x42) {
      if (pmsSerial.peek() == 0x4D) {
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

        if (currentTemp > maxTemp || currentPM25 > maxPM25) {
          digitalWrite(BUZZER_PIN, BUZZER_ON);
          buzzerState = true;
        }
        return;
      }
    }
  }
}