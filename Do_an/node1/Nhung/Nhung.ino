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

// Khởi tạo cảm biến Pin INA219
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
unsigned long sendInterval = 300000;

void setup() {
  Serial.begin(9600);
  pmsSerial.begin(9600);
  Wire.begin();

  if (!ina219_uno.begin()) Serial.println("Loi INA219 Uno");
  if (!ina219_sen.begin()) Serial.println("Loi INA219 Sensor");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);
  
  Serial.println("=== KHOI DONG TRAM QUAN TRAC (END-NODE) ===");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(433E6)) {
    Serial.println("LOI: Khong the khoi tao LoRa!");
    while (1);
  }
  Serial.println("Khoi tao LoRa THANH CONG.");
}

void loop() {
  handleButton();
  readPMSData();

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
  // Đọc điện áp thực tế bằng Volt
  float v_uno = ina219_uno.getBusVoltage_V();
  float v_sen = ina219_sen.getBusVoltage_V();

  String payload = "{";
  payload += "\"id\":\"Node1\","; 
  payload += "\"t\":" + String(currentTemp, 1) + ",";
  payload += "\"h\":" + String(currentHum, 1) + ",";
  payload += "\"p2\":" + String(currentPM25, 1) + ",";
  payload += "\"p10\":" + String(currentPM10, 1) + ",";
  payload += "\"b_uno\":" + String(v_uno, 2) + ",";
  payload += "\"b_sen\":" + String(v_sen, 2);
  payload += "}";

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();

  Serial.print("[LoRa TX] Da gui: ");
  Serial.println(payload);
}