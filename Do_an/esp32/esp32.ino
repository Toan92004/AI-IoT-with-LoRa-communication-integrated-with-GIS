#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>

const char* ssid = "Galaxy"; 
const char* password = "12345689";

const char* mqtt_server = "6ec51b2e9c764674a51fd112c6ca60ed.s1.eu.hivemq.cloud"; 
const int mqtt_port = 8883;
const char* mqtt_user = "dodanhtoan"; 
const char* mqtt_pass = "Toan1234"; 

const char* mqtt_topic_pub = "esp8266/status";
const char* mqtt_topic_sub = "esp8266/client";

#define I2C_ADDR 8

WiFiClientSecure espClient;
PubSubClient client(espClient);

char i2cBuffer[256];
int bufferIndex = 0;
bool packetReady = false;

// Bộ đệm cho dữ liệu cấu hình từ Server xuống
String downlinkConfig = "";
volatile bool configAvailable = false;

void mqttCallback(char* topic, byte* payload, unsigned long length) {
  String incoming = "";
  for (int i = 0; i < length; i++) {
    incoming += (char)payload[i];
  }
  
  if (incoming.indexOf("\"cmd\":\"sync\"") != -1) {
    downlinkConfig = incoming;
    configAvailable = true;
    Serial.print("\n[MQTT RX] Nhan cau hinh moi tu Web: ");
    Serial.println(downlinkConfig);
  }
}

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
    } else if (bufferIndex < 255) {
      i2cBuffer[bufferIndex++] = c;
    }
  }
}

// Xử lý khi Trạm 3 (Master I2C) gửi lệnh yêu cầu lấy dữ liệu Downlink
void requestEvent() {
  if (configAvailable) {
    // Gửi gói cấu hình kèm ký tự kết thúc luồng \n
    String toSend = downlinkConfig + "\n";
    Wire.write((const uint8_t*)toSend.c_str(), toSend.length());
    configAvailable = false; 
    downlinkConfig = "";
    Serial.println("[I2C TX] Da chuyen giao cau hinh xuong Tram 3 Master.");
  } else {
    Wire.write('\0'); // Trả về rỗng nếu không có cấu hình mới
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n-> WiFi ket noi THANH CONG!");
  
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);

  Wire.begin(I2C_ADDR); 
  Wire.onReceive(receiveEvent);
  Wire.onRequest(requestEvent); // Đăng ký hàm trả dữ liệu Downlink
  Serial.println("-> Giao tiep I2C Slave san sang.");
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  if (packetReady) {
    // Tạm dừng ngắt để copy dữ liệu, tránh bị ghi đè nếu I2C nhận gói mới quá nhanh
    noInterrupts();
    String finalPacket = String(i2cBuffer);
    packetReady = false;
    interrupts(); // Mở ngắt trở lại

    Serial.print("\n[I2C RX] Nhan duoc tu Uno Master: ");
    Serial.println(finalPacket);

    if (checkPacketIntegrity(finalPacket)) {
      client.publish(mqtt_topic_pub, finalPacket.c_str());
      Serial.println("[GATEWAY] Upstream du lieu len Cloud thanh cong.");
    } else {
      Serial.println("[LOI] Du lieu I2C khong nguyen ven, tu choi Upstream!");
    }
  }
}

bool checkPacketIntegrity(String packet) {
  if (packet.length() < 10) return false;
  return (packet.startsWith("{") && packet.endsWith("}"));
}