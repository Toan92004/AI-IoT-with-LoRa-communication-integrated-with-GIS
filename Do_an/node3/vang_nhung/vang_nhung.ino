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
Adafruit_INA219 ina219_sen(0x41);

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
unsigned long sendInterval = 200000;

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);
  Wire.begin(); 

  if (!ina219_uno.begin()) Serial.println("Loi INA219 Uno");
  if (!ina219_sen.begin()) Serial.println("Loi INA219 Sensor");

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
  handleButton(); 
  readPMSData();
  receiveLoRaData();

  if (millis() - lastSendTime > sendInterval) {
    if (hasData) {
      float v_uno = ina219_uno.getBusVoltage_V();
      float v_sen = ina219_sen.getBusVoltage_V();

      String payload = "{";
      payload += "\"id\":\"Node3\","; 
      payload += "\"t\":" + String(currentTemp, 1) + ",";
      payload += "\"h\":" + String(currentHum, 1) + ",";
      payload += "\"p2\":" + String(currentPM25, 1) + ",";
      payload += "\"p10\":" + String(currentPM10, 1) + ",";
      payload += "\"b_uno\":" + String(v_uno, 2) + ",";
      payload += "\"b_sen\":" + String(v_sen, 2);
      payload += "}";
      
      Serial.print("[TRAM 3] Du lieu rieng: ");
      Serial.println(payload);
      sendToESP32viaI2C(payload);
    }
    lastSendTime = millis();
  }
}

void receiveLoRaData() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incomingPacket = "";
    while (LoRa.available()) incomingPacket += (char)LoRa.read();
    
    if (checkPacketIntegrity(incomingPacket)) {
      Serial.print("[LORA RX] Nhan duoc goi tin hop le: ");
      Serial.println(incomingPacket);
      sendToESP32viaI2C(incomingPacket);
    } else {
      Serial.println("[LORA RX] Goi tin loi, huy bo!");
    }
  }
}

void sendToESP32viaI2C(String packet) {
  int len = packet.length();
  int pos = 0;
  
  while (pos < len) {
    Wire.beginTransmission(ESP32_I2C_ADDR);
    int chunk = min(30, len - pos);
    for (int i = 0; i < chunk; i++) {
      Wire.write(packet[pos + i]);
    }
    Wire.endTransmission();
    pos += chunk;
    delay(5); 
  }
  
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

void handleButton() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) lastDebounceTime = millis();

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
      for (int i = 2; i < 32; i++) pmsData[i] = pmsSerial.read();

      currentPM25 = (float)((pmsData[12] << 8) | pmsData[13]);
      currentPM10 = (float)((pmsData[14] << 8) | pmsData[15]);
      currentTemp = ((pmsData[24] << 8) | pmsData[25]) / 10.0;
      currentHum  = ((pmsData[26] << 8) | pmsData[27]) / 10.0;
      hasData = true;
    }
  }
}