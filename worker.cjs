const dns = require("dns");
const mqtt = require("mqtt");
const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer"); // Thêm thư viện gửi mail

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// --- CẤU HÌNH GMAIL (Sử dụng Mật khẩu ứng dụng - App Password) ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "dodanhtoanhpkt@gmail.com", // Email của hệ thống
    pass: "gvpuvhbwhzcmnvnb", // Mật khẩu ứng dụng Gmail
  },
});

// --- CẤU HÌNH MONGODB ATLAS ---
const dbUser = "esp32_admin";
const dbPass = encodeURIComponent("12345678aA");
const mongoUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.jzljua6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const dbName = "IoT_Project";
const sensorCollectionName = "SensorData";
const alertsCollectionName = "Alerts"; // Khai báo collection cảnh báo

// --- CẤU HÌNH HIVEMQ ---
const mqttServer =
  "mqtts://6ec51b2e9c764674a51fd112c6ca60ed.s1.eu.hivemq.cloud:8883";
const mqttOptions = {
  username: "dodanhtoan",
  password: "Toan1234",
  clientId:
    "NodeJS_BackendWorker_" + Math.random().toString(16).substring(2, 10),
};
const topicStatus = "esp8266/status";

let lastNodeStates = {};

async function startWorker() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const sensorCollection = db.collection(sensorCollectionName);
    const alertsCollection = db.collection(alertsCollectionName); // Khởi tạo collection
    const usersCollection = db.collection("Users"); // Truy cập bảng người dùng
    const stationConfigs = db.collection("StationConfigs"); // Để tra cứu Zone của Node

    console.log("-> [WORKER] Da ket noi MongoDB va san sang ghi du lieu.");

    const mqttClient = mqtt.connect(mqttServer, mqttOptions);

    mqttClient.on("connect", () => {
      mqttClient.subscribe(topicStatus);
      console.log(
        "-> [WORKER] Da ket noi HiveMQ va lang nghe topic:",
        topicStatus,
      );
    });

    mqttClient.on("message", async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const nodeId = data.id || "Unknown";

        // 1. Kiểm tra ngưỡng nguy hiểm
        if (data.t > 35 || data.p2 > 100) {
          const alertMessage =
            data.t > 35
              ? `Nhiet do vuot nguong: ${data.t}°C`
              : `Nong do bui PM2.5 cao: ${data.p2} µg/m³`;

          // Lưu cảnh báo vào DB
          await alertsCollection.insertOne({
            node_id: nodeId,
            type: data.t > 35 ? "temperature" : "pm25", // Bổ sung type
            message: alertMessage,
            severity: data.t > 40 || data.p2 > 150 ? "critical" : "high", // Bổ sung mức độ
            timestamp: new Date(),
            status: "active",
          });

          // 2. TIM KHU VUC CUA TRAM BI SU CO [cite: 387]
          const station = await stationConfigs.findOne({ id: nodeId });
          const zone = station ? station.zone : "KV1"; // Mac dinh KV1 neu khong tim thay

          // 3. GUI EMAIL CHO NGUOI DUNG TRONG KHU VUC [cite: 412]
          const usersInZone = await usersCollection
            .find({
              $or: [{ zone: zone }, { managed_zones: zone }],
            })
            .toArray();

          const emailList = usersInZone.map((u) => u.email).filter((e) => e);

          if (emailList.length > 0) {
            const mailOptions = {
              from: '"He thong WebGIS Canh bao" <your-email@gmail.com>',
              to: emailList.join(","), // Gui cho tat ca nguoi dung trong zone
              subject: `⚠️ CANH BAO KHAN CAP - KHU VUC ${zone}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ff4444; border-radius: 10px;">
                  <h2 style="color: #ff4444;">Phát hiện sự cố môi trường!</h2>
                  <p>Hệ thống WebGIS vừa ghi nhận bất thường tại <b>Trạm: ${nodeId}</b> thuộc <b>Khu vực: ${zone}</b>.</p>
                  <p style="font-size: 16px;"><b>Nội dung:</b> ${alertMessage}</p>
                  <p>Thời gian: ${new Date().toLocaleString("vi-VN")}</p>
                  <hr>
                  <p style="font-size: 12px; color: #666;">Vui lòng truy cập Dashboard để điều phối nhân sự xử lý ngay lập tức.</p>
                </div>
              `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) console.log("-> [MAIL ERROR]", error);
              else
                console.log(
                  "-> [MAIL SENT] Da gui canh bao toi:",
                  emailList.length,
                  "nguoi dung.",
                );
            });
          }
        }

        // 2. Lưu dữ liệu cảm biến (giữ nguyên logic băm nhỏ dữ liệu cũ)
        let isChanged = true;
        if (lastNodeStates[nodeId]) {
          const prev = lastNodeStates[nodeId];
          if (data.t === prev.t && data.h === prev.h && data.p2 === prev.p2) {
            isChanged = false;
          }
        }

        if (isChanged) {
          const insertDoc = {
            node_id: nodeId,
            temperature: data.t !== undefined ? parseFloat(data.t) : null,
            humidity: data.h !== undefined ? parseFloat(data.h) : null,
            pm2_5: data.p2 !== undefined ? parseFloat(data.p2) : null,
            pm10: data.p10 !== undefined ? parseFloat(data.p10) : null,
            timestamp: new Date(),
          };
          await sensorCollection.insertOne(insertDoc);
          lastNodeStates[nodeId] = data;
        }
      } catch (err) {
        console.error("Lỗi xử lý MQTT message:", err);
      }
    });
  } catch (err) {
    console.error("Lỗi khởi động worker:", err);
  }
}

startWorker();
