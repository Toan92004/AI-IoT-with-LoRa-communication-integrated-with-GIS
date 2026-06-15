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
unsigned long sendInterval = 283000; 
unsigned long lastLoRaCheck = 0; // Đếm thời gian cho LoRa RX

// Bộ cấu hình ngưỡng động tại trạm 2
float maxTemp = 35.0;
float maxHum = 80.0;
float maxPM25 = 100.0;

void parseAndSetThresholds(String json) {
  int tIdx = json.indexOf("\"t_max\":");
  int hIdx = json.indexOf("\"h_max\":");
  int pIdx = json.indexOf("\"p_max\":");
  
  if (tIdx != -1) maxTemp = json.substring(tIdx + 8, json.indexOf(",", tIdx)).toFloat();
  if (hIdx != -1) maxHum = json.substring(hIdx + 8, json.indexOf(",", hIdx)).toFloat();
  if (pIdx != -1) maxPM25 = json.substring(pIdx + 8, json.indexOf("}", pIdx)).toFloat();

  Serial.println("\n[TRAM 2] DA DONG BO NGUONG MOI TU SERVER:");
  Serial.print("-> Temp Max: "); Serial.println(maxTemp);
  Serial.print("-> PM2.5 Max: "); Serial.println(maxPM25);
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
  Serial.println("=== TRAM 2 OPERATIONAL ===");
}

void loop() {
  handleButton(); 
  readPMSData();
  
  // Tối ưu hóa: Hỏi LoRa mỗi 100ms để bắt sóng nhạy bén nhưng không làm treo PMS
  if (millis() - lastLoRaCheck > 100) {
    receiveLoRaData();
    lastLoRaCheck = millis();
  }
  
  if (millis() - lastSendTime > sendInterval) {
    if (hasData) {
      sendLoRaData();
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
    
    Serial.print("\n[LoRa RX] TRAM 2 bat duoc song: ");
    Serial.println(incomingPacket);

    if (checkPacketIntegrity(incomingPacket)) {
      if (incomingPacket.indexOf("\"cmd\":\"sync\"") != -1) {
        Serial.println("[LoRa RX] -> Day la lenh Cau hinh tu TRAM 3!");
        parseAndSetThresholds(incomingPacket);
        
        delay(150);
        LoRa.beginPacket();
        LoRa.print(incomingPacket);
        LoRa.endPacket();
        Serial.println("[Relay Downlink] Da chuyen tiep lenh cau hinh xuong TRAM 1.");
      } 
      else if (incomingPacket.indexOf("\"id\":\"Node2\"") == -1) { 
        if (incomingPacket.indexOf("\"id\":\"Node1\"") != -1) {
           Serial.println("[LoRa RX] -> Day la du lieu cua TRAM 1, dang xu ly chuyen tiep..."); 
        }

        delay(250); 
        LoRa.beginPacket();
        LoRa.print(incomingPacket);
        LoRa.endPacket();
        Serial.print("[Relay Upstream] Chuyen tiep thanh cong len TRAM 3: ");
        Serial.println(incomingPacket);
      }
    } else {
      Serial.println("[LOI] Goi tin LoRa bi hong hoac sai dinh dang!");
    }
  }
}

void sendLoRaData() {
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
  payload += "\"id\":\"Node2\",";
  payload += "\"t\":" + String(currentTemp, 1) + ",";
  payload += "\"h\":" + String(currentHum, 1) + ",";
  payload += "\"p2\":" + String(currentPM25, 1) + ",";
  payload += "\"p10\":" + String(currentPM10, 1) + ",";
  payload += "\"b_uno\":" + String(v_uno, 2);
  payload += "}";

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();

  Serial.print("[LoRa TX] Da gui: ");  
  Serial.println(payload);
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