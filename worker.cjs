const dns = require("dns");
const mqtt = require("mqtt");
const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");
const axios = require("axios");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// --- CẤU HÌNH TRÌNH ĐIỀU KHIỂN GỬI THƯ TỰ ĐỘNG GMAIL ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "dodanhtoanhpkt@gmail.com",
    pass: "gvpuvhbwhzcmnvnb", // Mật khẩu ứng dụng bảo mật nâng cao
  },
});

// --- CẤU HÌNH KẾT NỐI MONGODB ATLAS ---
const dbUser = "esp32_admin";
const dbPass = encodeURIComponent("12345678aA");
const mongoUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.jzljua6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const dbName = "IoT_Project";
const topicStatus = "esp8266/status";

// --- BỘ NHỚ LƯU TRỮ TRẠNG THÁI KHÔNG GIAN ĐỘNG ---
let lastNodeStates = {}; // Kiểm tra chống trùng lặp dữ liệu tĩnh
let alertStates = {}; // Quản lý độc lập chu kỳ gửi thư thông minh cho từng trạm

async function startWorker() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const sensorCollection = db.collection("SensorData");
    const alertsCollection = db.collection("Alerts");
    const usersCollection = db.collection("Users");
    const stationConfigs = db.collection("StationConfig");

    console.log("-> [WORKER] Tiến trình nền dọn dữ liệu & bắn Email đã chạy!");

    // Kết nối mạng Broker HiveMQ Cloud
    const mqttServer =
      "mqtts://6ec51b2e9c764674a51fd112c6ca60ed.s1.eu.hivemq.cloud:8883";
    const mqttOptions = {
      username: "dodanhtoan",
      password: "Toan1234",
      clientId:
        "NodeJS_BackendWorker_" + Math.random().toString(16).substring(2, 10),
    };
    const mqttClient = mqtt.connect(mqttServer, mqttOptions);

    mqttClient.on("connect", () => {
      mqttClient.subscribe(topicStatus);
      console.log(
        `-> [WORKER] Lắng nghe thành công sóng vô tuyến tại topic: [${topicStatus}]`,
      );
    });

    mqttClient.on("message", async (topic, message) => {
      const rawData = message.toString();
      let data;

      try {
        data = JSON.parse(rawData);
      } catch (err) {
        console.log(
          `⚠️ [WORKER] Gói tin không chuẩn định dạng JSON, đã chặn: ${rawData}`,
        );
        return;
      }

      try {
        const nodeId = data.id || "Unknown";
        if (nodeId === "Unknown") return;

        // ================= KHỐI KIỂM TRA ĐỒNG BỘ AI THỜI GIAN THỰC =================
        let aiRiskScore = 0;
        let isAiCritical = false;

        try {
          // Wrap dữ liệu đơn lẻ thành cấu trúc dict để ép AI Python phân tích
          const aiPayload = {
            [nodeId]: {
              t: parseFloat(data.t),
              h: parseFloat(data.h),
              p2: parseFloat(data.p2),
              p10: data.p10 ? parseFloat(data.p10) : parseFloat(data.p2) * 1.3,
              b_uno: data.b_uno ? parseFloat(data.b_uno) : 3.3,
            },
          };

          const aiRes = await axios.post(
            "https://ai-service-m2b5.onrender.com/api/predict",
            aiPayload,
          );
          if (aiRes.data?.node_results?.[nodeId]) {
            aiRiskScore = aiRes.data.node_results[nodeId].risk;
            isAiCritical = aiRiskScore >= 70.0; // AI dự báo nguy hiểm hỏa hoạn tương lai
          }
        } catch (e) {
          // Fallback phòng khi tắt server Python AI
          console.log(
            `[WORKER AI] Trạm AI Service đang offline. Hệ thống tự động chuyển sang chế độ bảo vệ tĩnh.`,
          );
        }

        // --- LOGIC ĐÁNH GIÁ CẢNH BÁO KẾT HỢP ---
        const isDanger = data.t > 35 || data.p2 > 100 || isAiCritical;

        // BIÊN ĐỘ PHỤC HỒI (Hysteresis)
        const isCompletelySafe = data.t < 33 && data.p2 < 80 && !isAiCritical;

        if (isDanger) {
          let alertMessage = "";
          let alertType = "temperature";

          if (isAiCritical) {
            alertMessage = `[AI FORECAST] Cảnh báo sớm hỏa hoạn! Nguy cơ đạt đỉnh ${aiRiskScore}% trong thời gian tới.`;
            alertType = "ai_prediction";
          } else if (data.t > 35) {
            alertMessage = `Nhiệt độ thực tế vượt ngưỡng an toàn: ${data.t}°C`;
            alertType = "temperature";
          } else {
            alertMessage = `Nồng độ bụi mịn công nghiệp nguy hiểm: ${data.p2} µg/m³`;
            alertType = "pm25";
          }

          // Lưu vĩnh viễn nhật ký sự cố vào DB Alerts
          await alertsCollection.insertOne({
            node_id: nodeId,
            type: alertType,
            message: alertMessage,
            severity:
              data.t > 45 || data.p2 > 200 || isAiCritical
                ? "critical"
                : "high",
            timestamp: new Date(),
            status: "active",
          });

          // Tạo/Khởi tạo bộ quản lý chu trình Email độc lập cho trạm này
          if (!alertStates[nodeId] || !alertStates[nodeId].isAlerting) {
            alertStates[nodeId] = {
              isAlerting: true,
              emailCount: 0,
              lastEmailTime: 0,
            };
            console.log(
              `🚨 [SỰ CỐ KHẨN CẤP] Phát hiện sự cố tại trạm: ${nodeId}`,
            );
          }

          const state = alertStates[nodeId];
          const currentTime = Date.now();
          const timeSinceLastEmail = currentTime - state.lastEmailTime;

          // THUẬT TOÁN ĐIỀU PHỐI GỬI THƯ THÔNG MINH (ĐÃ SỬA CHU KỲ)
          let shouldSendEmail = false;

          if (state.emailCount < 3) {
            // Giai đoạn đầu: Gửi 3 email, cách nhau 1 phút (60000ms)
            if (timeSinceLastEmail >= 60000) {
              shouldSendEmail = true;
            } else {
              console.log(
                `[MAIL COOLDOWN] Chờ ${Math.ceil((60000 - timeSinceLastEmail) / 1000)}s để gửi thư khẩn cấp lần ${state.emailCount + 1}.`,
              );
            }
          } else {
            // Giai đoạn sau: Chuyển sang nhắc nhở dãn cách 5 phút (300000ms) 1 lần
            if (timeSinceLastEmail >= 300000) {
              shouldSendEmail = true;
              console.log(
                `[MAIL REMINDER] Gửi nhắc nhở sự cố kéo dài tại trạm ${nodeId}.`,
              );
            }
          }

          if (shouldSendEmail) {
            state.lastEmailTime = currentTime;
            state.emailCount++;

            // Truy vết không gian: Tìm xem trạm thuộc khu vực nào
            const station = await stationConfigs.findOne({ id: nodeId });
            const zone = station ? station.zone : "Phân Khu Chung";

            // Truy tìm danh sách tài khoản thuộc vùng quản lý này
            const usersInZone = await usersCollection
              .find({
                $or: [
                  { zone: zone },
                  { managed_zones: zone },
                  { address: zone },
                ],
              })
              .toArray();

            const emailList = usersInZone.map((u) => u.email).filter((e) => e);

            if (emailList.length > 0) {
              const mailOptions = {
                from: '"Hệ thống An ninh Môi trường WebGIS" <dodanhtoanhpkt@gmail.com>',
                to: emailList.join(","),
                subject: `[LẦN ${state.emailCount}] ⚠️ KHẨN CẤP: PHÁT HIỆN SỰ CỐ TẠI KHU VỰC ${zone.toUpperCase()}`,
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #ff3333; border-radius: 12px; max-width: 600px;">
                    <h2 style="color: #ff3333; border-bottom: 1px solid #ff3333; padding-bottom: 10px;">THÔNG BÁO SỰ CỐ KHẨN CẤP</h2>
                    <p>Hệ thống giám sát thông minh WebGIS IoT vừa ghi nhận tín hiệu bất thường nguy hiểm vượt ngưỡng từ hạ tầng thiết bị:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                      <tr style="background-color: #f8f8f8;"><td style="padding: 8px; font-weight: bold;">Mã số trạm:</td><td style="padding: 8px; color: #ff3333; font-weight: bold;">${nodeId}</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold;">Khu vực quản lý:</td><td style="padding: 8px;">${zone}</td></tr>
                      <tr style="background-color: #f8f8f8;"><td style="padding: 8px; font-weight: bold;">Nội dung cảnh báo:</td><td style="padding: 8px; font-weight: bold; color: #d9534f;">${alertMessage}</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold;">Nhiệt độ hiện thời:</td><td style="padding: 8px;">${data.t}°C</td></tr>
                      <tr style="background-color: #f8f8f8;"><td style="padding: 8px; font-weight: bold;">Nồng độ bụi PM2.5:</td><td style="padding: 8px;">${data.p2} µg/m³</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold;">Thời gian ghi nhận:</td><td style="padding: 8px;">${new Date().toLocaleString("vi-VN")}</td></tr>
                    </table>
                    <p style="font-weight: bold; color: #ff3333;">Yêu cầu Đội trực ban an ninh phân khu lập tức tới hiện trường ứng phó!</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 11px; color: #888; font-style: italic;">* Email này được gửi tự động (Lần ${state.emailCount}). Nếu sự cố kéo dài, hệ thống sẽ tiếp tục nhắc nhở 5 phút/lần.</p>
                  </div>
                `,
              };

              transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.log("❌ [MAIL ERROR]", error);
                else
                  console.log(
                    `✅ [MAIL SENT] Đã phát thư cảnh báo lần ${state.emailCount} cho trạm ${nodeId}.`,
                  );
              });
            }
          }
        } else if (isCompletelySafe) {
          // --- KHI KHU VỰC ĐÃ THỰC SỰ KHÔI PHỤC VỀ TRẠNG THÁI AN TOÀN SÂU ---
          if (alertStates[nodeId] && alertStates[nodeId].isAlerting) {
            alertStates[nodeId].isAlerting = false;
            alertStates[nodeId].emailCount = 0;
            console.log(
              `✅ [PHỤC HỒI] Trạm ${nodeId} đã thực sự an toàn (Nhiệt độ < 33°C, Bụi < 80). Đã Reset bộ đếm thư.`,
            );
          }
        }

        // --- 2. LOGIC LƯU DỮ LIỆU CẢM BIẾN (CHỐNG TRÙNG LẶP DỮ LIỆU TĨNH) ---
        let isChanged = true;
        if (lastNodeStates[nodeId]) {
          const prev = lastNodeStates[nodeId];
          // Nếu các chỉ số giống hệt nhau (không sai lệch quá 0.1), ta không ghi vào DB để tiết kiệm dung lượng
          if (
            data.t === prev.t &&
            Math.abs(data.h - prev.h) < 0.1 &&
            data.p2 === prev.p2
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
            pm10:
              data.p10 !== undefined
                ? parseFloat(data.p10)
                : parseFloat(data.p2) * 1.3,
            b_uno: data.b_uno !== undefined ? parseFloat(data.b_uno) : null,
            timestamp: new Date(),
          };
          await sensorCollection.insertOne(insertDoc);
          lastNodeStates[nodeId] = data;
        }
      } catch (err) {
        console.error("❌ Lỗi xử lý chu trình dữ liệu Worker:", err);
      }
    });
  } catch (err) {
    console.error("❌ Lỗi khởi động dịch vụ nền Worker:", err);
  }
}

startWorker();
