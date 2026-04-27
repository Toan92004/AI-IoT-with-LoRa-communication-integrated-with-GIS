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
#define SDA_PIN 21
#define SCL_PIN 22

WiFiClientSecure espClient;
PubSubClient client(espClient);

// --- BIẾN TOÀN CỤC CHO I2C ---
char i2cBuffer[256];
int bufferIndex = 0;
bool packetReady = false;

// ---------------------------------------------------------
// HÀM KẾT NỐI LẠI MQTT (NẾU RỚT MẠNG)
// ---------------------------------------------------------
void reconnect() {
  while (!client.connected()) {
    Serial.print("\nDang ket noi lai MQTT HiveMQ...");
    String clientId = "ESP32_GW_" + String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) { 
      Serial.println(" THANH CONG!");
      // Báo cáo Gateway đã online
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

// ---------------------------------------------------------
// HÀM NGẮT: XỬ LÝ DỮ LIỆU I2C TỪ TRẠM 3 (UNO R3)
// ---------------------------------------------------------
void receiveEvent(int howMany) {
  while (Wire.available()) {
    char c = Wire.read();
    
    // Ký tự '\n' là cờ báo hiệu đã ráp xong các mảnh vỡ của gói tin
    if (c == '\n') {
      i2cBuffer[bufferIndex] = '\0'; // Chốt chuỗi
      packetReady = true;
      bufferIndex = 0; // Reset để đón gói tin tiếp theo
    } 
    else {
      // Đổ ký tự vào mảng nếu chưa đầy
      if (bufferIndex < 255) {
        i2cBuffer[bufferIndex++] = c;
      }
    }
  }
}

// Hàm kiểm tra tính toàn vẹn gói tin JSON
bool checkPacketIntegrity(String packet) {
  if (packet.length() < 10) return false;
  if (packet.startsWith("{") && packet.endsWith("}")) return true; 
  return false; 
}

// ---------------------------------------------------------
// SETUP VÀ LOOP CHÍNH
// ---------------------------------------------------------
void setup() {
  Serial.begin(115200);
  
  // Khởi tạo I2C với vai trò Slave
  Wire.begin(I2C_ADDR, SDA_PIN, SCL_PIN, 100000);
  Wire.onReceive(receiveEvent);
  
  Serial.println("\n=== KHOI DONG ESP32 GATEWAY ===");
  Serial.print("Dang ket noi WiFi: ");
  Serial.println(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi ket noi THANH CONG!");
  
  // Bỏ qua kiểm tra chứng chỉ SSL/TLS để dùng port 8883 nhẹ nhàng nhất
  espClient.setInsecure(); 
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  // Giữ vững kết nối với Server
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // NẾU NHẬN ĐƯỢC GÓI TIN TỪ TRẠM 3 (UNO R3)
  if (packetReady) {
    String finalPacket = String(i2cBuffer);
    
    // Kiểm tra lớp bảo vệ thứ 2
    if (checkPacketIntegrity(finalPacket)) {
      Serial.println("\n[GATEWAY OK] Du lieu hoan hao! Dang day len HiveMQ...");
      Serial.print("[JSON DATA] ");
      Serial.println(finalPacket);
      
      // THỰC THI BẮN DỮ LIỆU LÊN SERVER
      // Dùng .c_str() để chuyển từ String sang mảng char (yêu cầu bắt buộc của thư viện PubSubClient)
      client.publish(mqtt_topic_pub, finalPacket.c_str());
      
      Serial.println(">> DAY LEN SERVER THANH CONG!");
      Serial.println("-----------------------------------------");
    } else {
      Serial.println("\n[GATEWAY ERROR] Du lieu I2C bi vo/nhieu! Da loai bo.");
      Serial.println(finalPacket);
    }
    
    // Hạ cờ, chuẩn bị đón gói tin mới
    packetReady = false;
  }
}