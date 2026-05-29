#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>

// --- CẤU HÌNH WIFI ---
const char* ssid = "Galaxy"; 
const char* password = "12345689";

// --- CẤU HÌNH HIVEMQ CLOUD ---
const char* mqtt_server = "6ec51b2e9c764674a51fd112c6ca60ed.s1.eu.hivemq.cloud"; 
const int mqtt_port = 8883;
const char* mqtt_user = "dodanhtoan"; 
const char* mqtt_pass = "Toan1234"; 

// --- TOPIC MQTT ---
const char* mqtt_topic_pub = "esp8266/status";
const char* mqtt_topic_sub = "esp8266/client";

// --- CẤU HÌNH I2C SLAVE ---
#define I2C_ADDR 8
// Không cần define SDA, SCL vì ESP32 tự nhận GPIO 21, 22

WiFiClientSecure espClient;
PubSubClient client(espClient);

// --- BIẾN TOÀN CỤC CHO I2C ---
char i2cBuffer[256];
int bufferIndex = 0;
bool packetReady = false;

void reconnect() {
  while (!client.connected()) {
    Serial.print("\nDang ket noi lai MQTT HiveMQ...");
    String clientId = "ESP32_GW_" + String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) { 
      Serial.println(" THANH CONG!");
      client.publish(mqtt_topic_pub, "{\"status\":\"Gateway_Online\"}");
      client.subscribe(mqtt_topic_sub);
    } else {
      Serial.print(" LOI, ma loi=");
      Serial.print(client.state());
      Serial.println(" -> Thu lai sau 5 giay");
      delay(5000);
    }
  }
}

void receiveEvent(int howMany) {
  while (Wire.available()) {
    char c = Wire.read();
    if (c == '\n') {
      i2cBuffer[bufferIndex] = '\0';
      packetReady = true;
      bufferIndex = 0;
    } 
    else {
      if (bufferIndex < 255) {
        i2cBuffer[bufferIndex++] = c;
      }
    }
  }
}

bool checkPacketIntegrity(String packet) {
  if (packet.length() < 10) return false;
  if (packet.startsWith("{") && packet.endsWith("}")) return true; 
  return false; 
}

void setup() {
  Serial.begin(115200);
  delay(1000); // Ổn định nguồn
  
  Serial.println("\n=== KHOI DONG ESP32 GATEWAY ===");
  Serial.print("1. Dang ket noi WiFi: ");
  Serial.println(ssid);
  
  // KÍCH HOẠT WIFI TRƯỚC
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n-> WiFi ket noi THANH CONG!");
  
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);

  // KÍCH HOẠT I2C SAU CÙNG
  Serial.println("2. Dang khoi tao giao tiep I2C...");
  Wire.begin(I2C_ADDR); // Ép chạy chế độ Slave
  Wire.onReceive(receiveEvent);
  Serial.println("-> I2C SAN SANG!");
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  if (packetReady) {
    String finalPacket = String(i2cBuffer);
    if (checkPacketIntegrity(finalPacket)) {
      Serial.println("\n[GATEWAY OK] Du lieu hoan hao! Dang day len HiveMQ...");
      Serial.print("[JSON DATA] ");
      Serial.println(finalPacket);
      
      client.publish(mqtt_topic_pub, finalPacket.c_str());
      Serial.println(">> DAY LEN SERVER THANH CONG!");
      Serial.println("-----------------------------------------");
    } else {
      Serial.println("\n[GATEWAY ERROR] Du lieu I2C bi vo/nhieu! Da loai bo.");
    }
    packetReady = false;
  }
}