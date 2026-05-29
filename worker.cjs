const dns = require("dns");
const mqtt = require("mqtt");
const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: "dodanhtoanhpkt@gmail.com", pass: "gvpuvhbwhzcmnvnb" },
});

const dbUser = "esp32_admin";
const dbPass = encodeURIComponent("12345678aA");
const mongoUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.jzljua6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const dbName = "IoT_Project";

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
let alertStates = {};

async function startWorker() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const sensorCollection = db.collection("SensorData");
    const alertsCollection = db.collection("Alerts");
    const usersCollection = db.collection("Users");
    const stationConfigs = db.collection("StationConfig");

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
      const rawData = message.toString();
      let data;

      try {
        data = JSON.parse(rawData);
      } catch (err) {
        console.log(
          `-> [CẢNH BÁO] Bỏ qua gói tin JSON bị lỗi định dạng: ${rawData}`,
        );
        return;
      }

      try {
        const nodeId = data.id || "Unknown";

        // --- 1. LOGIC XỬ LÝ CẢNH BÁO MÔI TRƯỜNG & PIN (VOLT) ---
        // Báo động môi trường hoặc pin sụt dưới 3.3V
        const isDanger =
          data.t > 38 ||
          data.p2 > 100 ||
          (data.b_uno && data.b_uno < 3.3) ||
          (data.b_sen && data.b_sen < 3.3);

        if (isDanger) {
          let alertMessage = "";
          let alertType = "environment";

          if (data.t > 38) {
            alertMessage = `Nhiet do vuot nguong: ${data.t}°C`;
            alertType = "temperature";
          } else if (data.p2 > 100) {
            alertMessage = `Nong do bui PM2.5 cao: ${data.p2} µg/m³`;
            alertType = "pm25";
          } else {
            alertMessage = `Canh bao dien ap pin yeu: ${data.b_uno || data.b_sen}V. Can thay the!`;
            alertType = "battery";
          }

          await alertsCollection.insertOne({
            node_id: nodeId,
            type: alertType,
            message: alertMessage,
            severity: data.t > 45 || data.p2 > 150 ? "critical" : "high",
            timestamp: new Date(),
            status: "active",
          });

          if (!alertStates[nodeId] || !alertStates[nodeId].isAlerting) {
            alertStates[nodeId] = {
              isAlerting: true,
              emailCount: 0,
              lastEmailTime: 0,
            };
            console.log(
              `\n⚠️ [SỰ CỐ MỚI] Bắt đầu chu trình cảnh báo cho trạm ${nodeId}`,
            );
          }

          const state = alertStates[nodeId];
          const currentTime = Date.now();

          if (state.emailCount < 3) {
            if (currentTime - state.lastEmailTime >= 300000) {
              state.lastEmailTime = currentTime;
              state.emailCount++;

              const station = await stationConfigs.findOne({ id: nodeId });
              const zone = station ? station.zone : "KV1";
              const usersInZone = await usersCollection
                .find({
                  $or: [
                    { zone: zone },
                    { managed_zones: zone },
                    { address: zone },
                  ],
                })
                .toArray();
              const emailList = usersInZone
                .map((u) => u.email)
                .filter((e) => e);

              if (emailList.length > 0) {
                const mailOptions = {
                  from: '"He thong WebGIS Canh bao" <dodanhtoanhpkt@gmail.com>',
                  to: emailList.join(","),
                  subject: `[LẦN ${state.emailCount}/3] ⚠️ CANH BAO KHAN CAP - KHU VUC ${zone}`,
                  html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ff4444; border-radius: 10px;">
                      <h2 style="color: #ff4444;">Phát hiện sự cố (Cảnh báo lần ${state.emailCount}/3)</h2>
                      <p>Hệ thống WebGIS vừa ghi nhận bất thường tại <b>Trạm: ${nodeId}</b> thuộc <b>Khu vực: ${zone}</b>.</p>
                      <p style="font-size: 16px;"><b>Nội dung:</b> ${alertMessage}</p>
                      <p>Thời gian: ${new Date().toLocaleString("vi-VN")}</p>
                      <hr>
                      <p style="font-size: 12px; color: #666;">Hệ thống sẽ tự động gửi tối đa 3 lần cảnh báo.</p>
                    </div>
                  `,
                };
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) console.log("-> [MAIL ERROR]", error);
                  else
                    console.log(
                      `-> [MAIL SENT] Lần ${state.emailCount}/3 cho trạm ${nodeId}.`,
                    );
                });
              }
            } else {
              const timeLeft = Math.ceil(
                (300000 - (currentTime - state.lastEmailTime)) / 1000,
              );
              console.log(
                `-> [MAIL COOLDOWN] Chờ ${timeLeft}s nữa mới gửi thư lần tiếp theo cho ${nodeId}.`,
              );
            }
          } else {
            console.log(
              `-> [MAIL LIMIT] Đã gửi đủ 3 lần thư cho sự cố hiện tại của trạm ${nodeId}. Ngừng gửi.`,
            );
          }
        } else {
          if (alertStates[nodeId] && alertStates[nodeId].isAlerting) {
            alertStates[nodeId].isAlerting = false;
            alertStates[nodeId].emailCount = 0;
            console.log(
              `\n✅ [PHỤC HỒI] Trạm ${nodeId} đã trở lại mức an toàn. Reset bộ đếm cảnh báo.`,
            );
          }
        }

        // --- 2. LOGIC LƯU DỮ LIỆU CẢM BIẾN VÀ PIN (VOLT) VÀO MONGODB ---
        let isChanged = true;
        if (lastNodeStates[nodeId]) {
          const prev = lastNodeStates[nodeId];
          if (
            data.t === prev.t &&
            Math.abs(data.h - prev.h) < 0.5 &&
            data.p2 === prev.p2 &&
            data.p10 === prev.p10
          ) {
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
            b_uno: data.b_uno !== undefined ? parseFloat(data.b_uno) : null, // Ghi dữ liệu pin vào DB
            b_sen: data.b_sen !== undefined ? parseFloat(data.b_sen) : null,
            timestamp: new Date(),
          };
          await sensorCollection.insertOne(insertDoc);
          lastNodeStates[nodeId] = data;
        }
      } catch (err) {
        console.error("Lỗi xử lý Database/Gửi mail:", err);
      }
    });
  } catch (err) {
    console.error("Lỗi khởi động worker:", err);
  }
}

startWorker();
