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

unsigned long lastSendTime = 0;
unsigned long sendInterval = 300000;

// Hệ thống ngưỡng cấu hình cục bộ của Node 1
float maxTemp = 35.0;
float maxHum = 80.0;
float maxPM25 = 100.0;

void receiveDownlinkConfig() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) incoming += (char)LoRa.read();
    
    // Kiểm tra tính toàn vẹn và khớp lệnh cấu hình
    if (incoming.length() > 10 && incoming.startsWith("{") && incoming.endsWith("}")) {
      if (incoming.indexOf("\"cmd\":\"sync\"") != -1) {
        int tIdx = incoming.indexOf("\"t_max\":");
        int hIdx = incoming.indexOf("\"h_max\":");
        int pIdx = incoming.indexOf("\"p_max\":");
        
        if (tIdx != -1) maxTemp = incoming.substring(tIdx + 8, incoming.indexOf(",", tIdx)).toFloat();
        if (hIdx != -1) maxHum = incoming.substring(hIdx + 8, incoming.indexOf(",", hIdx)).toFloat();
        if (pIdx != -1) maxPM25 = incoming.substring(pIdx + 8, incoming.indexOf("}", pIdx)).toFloat();

        Serial.println("\n[NODE 1] CAP NHAT NGUONG THANH CONG.");
      }
    }
  }
}

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);
  Wire.begin();

  if (!ina219_uno.begin()) Serial.println("Loi INA219 Uno");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    while (1);
  }
  LoRa.enableCrc();
  Serial.println("=== TRAM 1 OPERATIONAL ===");
}

void loop() {
  handleButton();
  readPMSData();
  receiveDownlinkConfig(); // Liên tục kiểm tra lệnh đồng bộ từ mạng LoRa

  if (millis() - lastSendTime > sendInterval) {
    if (hasData) sendLoRaData();
    lastSendTime = millis();
  }
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
  if (pmsSerial.available() >= 32) {
    if (pmsSerial.read() == 0x42 && pmsSerial.peek() == 0x4D) {
      pmsData[0] = 0x42; pmsData[1] = pmsSerial.read(); 
      for (int i = 2; i < 32; i++) pmsData[i] = pmsSerial.read();
      currentPM25 = (float)((pmsData[12] << 8) | pmsData[13]);
      currentPM10 = (float)((pmsData[14] << 8) | pmsData[15]);
      currentTemp = ((pmsData[24] << 8) | pmsData[25]) / 10.0;
      currentHum  = ((pmsData[26] << 8) | pmsData[27]) / 10.0;
      hasData = true;

      if (currentTemp > maxTemp || currentPM25 > maxPM25) {
        digitalWrite(BUZZER_PIN, BUZZER_ON);
        buzzerState = true;
      }
    }
  }
}

void sendLoRaData() {
  float v_uno = ina219_uno.getBusVoltage_V();
  String payload = "{";
  payload += "\"id\":\"Node1\","; 
  payload += "\"t\":" + String(currentTemp, 1) + ",";
  payload += "\"h\":" + String(currentHum, 1) + ",";
  payload += "\"p2\":" + String(currentPM25, 1) + ",";
  payload += "\"p10\":" + String(currentPM10, 1) + ",";
  payload += "\"b_uno\":" + String(v_uno, 2);
  payload += "}";

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();
}