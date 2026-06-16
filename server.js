import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import mqtt from "mqtt";
import dns from "dns";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Điều hướng DNS chống lỗi kết nối cụm Cloud Atlas
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// --- CẤU HÌNH MONGODB ATLAS ---
const dbUser = "esp32_admin";
const dbPass = encodeURIComponent("12345678aA");
const mongoUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.jzljua6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const dbName = "IoT_Project";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;
let sensorCollection;
let usersCollection;
let stationConfigCollection;
let alertsCollection;

// --- CẤU HÌNH HIVEMQ ĐỂ ĐỒNG BỘ NGƯỠNG XUỐNG PHẦN CỨNG ---
const mqttServer =
  "mqtts://6ec51b2e9c764674a51fd112c6ca60ed.s1.eu.hivemq.cloud:8883";
const mqttOptions = {
  username: "dodanhtoan",
  password: "Toan1234",
  clientId: "NodeJS_API_Server_" + Math.random().toString(16).substring(2, 10),
};
const mqttClient = mqtt.connect(mqttServer, mqttOptions);

mqttClient.on("connect", () => {
  console.log("-> [SERVER] API Server đã kết nối HiveMQ thành công!");
});

async function connectDB() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(dbName);
    sensorCollection = db.collection("SensorData");
    usersCollection = db.collection("Users");
    stationConfigCollection = db.collection("StationConfig");
    alertsCollection = db.collection("Alerts");
    console.log("-> [SERVER] Đã liên kết cơ sở dữ liệu MongoDB Atlas!");
  } catch (err) {
    console.error("❌ Lỗi kết nối Database:", err);
  }
}

// ================= API TỰ ĐỘNG HÓA AI ANALYTICS (N-TRẠM ĐỘNG) =================
app.get("/api/ai-analytics", async (req, res) => {
  try {
    // 1. Kéo danh sách trạm GỐC từ StationConfig
    const registeredStations = await stationConfigCollection.find({}).toArray();
    const activeNodes = registeredStations.map((s) => s.id);

    const aiPayload = {};
    const chartData = {};

    for (let nodeId of activeNodes) {
      const latest = await sensorCollection.findOne(
        { node_id: nodeId },
        { sort: { timestamp: -1 } },
      );

      if (latest) {
        aiPayload[nodeId] = {
          t: latest.temperature ?? latest.t ?? 25.0,
          h: latest.humidity ?? latest.h ?? 60.0,
          p2: latest.pm2_5 ?? latest.p2 ?? 15.0,
          p10:
            latest.pm10 ??
            latest.p10 ??
            (latest.pm2_5 ?? latest.p2 ?? 15.0) * 1.3,
          b_uno: latest.b_uno ?? 3.3,
        };

        const recent = await sensorCollection
          .find({ node_id: nodeId })
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();

        chartData[nodeId] = recent.reverse().map((d) => {
          const timeStr = new Date(d.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return {
            time: timeStr !== "Invalid Date" ? timeStr : "N/A",
            actualTemp: d.temperature,
            actualPM25: d.pm2_5,
            predictedTemp: d.temperature,
            predictedPM25: d.pm2_5,
          };
        });
      }
    }

    let aiResult = { status: "empty", node_results: {} };
    if (Object.keys(aiPayload).length > 0) {
      const pythonResponse = await axios.post(
        "https://ai-service-m2b5.onrender.com/api/predict",
        aiPayload,
      );
      aiResult = pythonResponse.data;
    }

    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 30);
    const futureTimeStr = futureTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    for (let nodeId of activeNodes) {
      if (chartData[nodeId] && aiResult?.node_results?.[nodeId]) {
        const nodeForecast = aiResult.node_results[nodeId].forecast;
        chartData[nodeId].push({
          time: futureTimeStr,
          actualTemp: null,
          actualPM25: null,
          predictedTemp: nodeForecast.temp,
          predictedPM25: nodeForecast.pm25,
        });
      }
    }

    res.json({
      success: true,
      totalActiveNodes: activeNodes.length,
      chartData: chartData,
      aiResult: aiResult,
    });
  } catch (error) {
    console.error(
      "❌ Lỗi xử lý AI Analytics:",
      error?.response?.data || error.message,
    );
    res
      .status(500)
      .json({ success: false, error: "Mất kết nối tới AI Service" });
  }
});

// ================= CÁC API HỆ THỐNG GỐC =================

// 1. API GET: Lấy trạng thái tổng hợp vi mô của toàn bộ các trạm
app.get("/api/stations", async (req, res) => {
  try {
    const registeredStations = await stationConfigCollection.find({}).toArray();

    if (registeredStations.length === 0) {
      return res.json([]);
    }

    const sensorData = await sensorCollection
      .aggregate([
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: "$node_id",
            temperature: { $first: { $ifNull: ["$temperature", "$t"] } },
            humidity: { $first: { $ifNull: ["$humidity", "$h"] } },
            pm2_5: { $first: { $ifNull: ["$pm2_5", "$p2"] } },
            pm10: { $first: { $ifNull: ["$pm10", "$p10"] } },
            b_uno: { $first: "$b_uno" },
            timestamp: { $first: "$timestamp" },
          },
        },
      ])
      .toArray();

    const formattedData = registeredStations.map((station) => {
      const sData = sensorData.find((s) => s._id === station.id);

      // BẢN VÁ LỖI TỌA ĐỘ TỐI THƯỢNG: Xử lý an toàn cả Số và Chuỗi
      let finalLat = 20.733; // Tâm Hải Phòng
      let finalLng = 106.642;

      if (station.lat !== undefined && station.lat !== null) {
        // Nếu là chữ thì ép sang số, nếu là số thì lấy luôn
        finalLat =
          typeof station.lat === "string"
            ? parseFloat(station.lat)
            : Number(station.lat);
      }

      if (station.lng !== undefined && station.lng !== null) {
        finalLng =
          typeof station.lng === "string"
            ? parseFloat(station.lng)
            : Number(station.lng);
      }

      // Đề phòng trường hợp ép kiểu bị lỗi ra NaN
      if (isNaN(finalLat)) finalLat = 20.733;
      if (isNaN(finalLng)) finalLng = 106.642;

      return {
        id: station.id,
        name: station.name,
        zone: station.zone || "Hải Phòng",
        type: station.type || "node",
        position: [finalLat, finalLng], // Tọa độ chuẩn 100%
        temperature: sData ? sData.temperature : 0,
        humidity: sData ? sData.humidity : 0,
        pm25: sData ? sData.pm2_5 : 0,
        b_uno: sData ? sData.b_uno : 0,
        timestamp: sData ? sData.timestamp : null,
      };
    });

    res.json(formattedData);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn dữ liệu trạm" });
  }
});

// 2. API POST: Đăng ký tài khoản người dùng ngoài ngoại biên
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, phone, address, password } = req.body;
    const existingUser = await usersCollection.findOne({ email: email });
    if (existingUser)
      return res.status(400).json({ error: "Email này đã được sử dụng!" });

    const newUser = {
      name,
      email,
      phone,
      address,
      password,
      role: "user",
      status: "offline",
      createdAt: new Date(),
    };
    await usersCollection.insertOne(newUser);
    res.status(201).json({ message: "Đăng ký thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng ký hệ thống" });
  }
});

// 3. API GET: Xem danh sách toàn bộ cán bộ điều hành nhân sự
app.get("/api/users", async (req, res) => {
  try {
    const users = await usersCollection.find({}).toArray();
    const formattedUsers = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role || "user",
      zone: u.zone || u.address || "Chưa phân công",
      status: u.status || "offline",
    }));
    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn danh sách nhân sự" });
  }
});

// 4. API POST: Thêm mới nhân sự trực tiếp từ Dashboard quản trị
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, phone, role, zone } = req.body;
    const existingUser = await usersCollection.findOne({ email: email });
    if (existingUser)
      return res.status(400).json({ error: "Email này đã tồn tại!" });

    const newUser = {
      name,
      email,
      phone,
      role,
      zone,
      password: "123",
      status: "online",
      createdAt: new Date(),
    };
    const result = await usersCollection.insertOne(newUser);
    res
      .status(201)
      .json({ message: "Thêm nhân sự thành công!", id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lưu trữ nhân sự" });
  }
});

// 5. API PUT: Hiệu chỉnh hồ sơ quyền hạn nhân sự theo ID
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, zone } = req.body;
    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, phone, role, zone } },
    );
    res.json({ message: "Cập nhật hồ sơ thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật nhân sự" });
  }
});

// 6. API DELETE: Trục xuất nhân sự khỏi hệ thống quản lý
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await usersCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Xóa nhân sự thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa nhân sự" });
  }
});

// ================= QUẢN LÝ THÊM/SỬA/XÓA TRẠM ĐỘNG =================
app.post("/api/stations/config", async (req, res) => {
  try {
    await stationConfigCollection.insertOne(req.body);
    res.status(201).json({ message: "Đã thêm cấu hình trạm mới thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cấu hình trạm" });
  }
});

app.put("/api/stations/config/:id", async (req, res) => {
  try {
    await stationConfigCollection.updateOne(
      { id: req.params.id },
      { $set: req.body },
    );
    res.status(200).json({ message: "Cập nhật cấu hình trạm thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi sửa cấu hình" });
  }
});

app.delete("/api/stations/config/:id", async (req, res) => {
  try {
    await stationConfigCollection.deleteOne({ id: req.params.id });
    res.status(200).json({ message: "Đã gỡ cấu hình trạm khỏi bản đồ mạng!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa trạm" });
  }
});

// 7. API POST: Cập nhật ngưỡng báo động phần cứng trực tiếp xuống ESP32 qua MQTT
app.post("/api/settings/thresholds", async (req, res) => {
  try {
    const { temp, humidity, pm25 } = req.body;

    // Đã sửa lại các key (cmd, t_max, h_max, p_max) để khớp hoàn toàn với code C++ trên mạch Uno/ESP
    const payload = JSON.stringify({
      cmd: "sync",
      t_max: parseFloat(temp),
      h_max: parseFloat(humidity),
      p_max: parseFloat(pm25),
    });

    if (mqttClient.connected) {
      mqttClient.publish("esp8266/client", payload);
      res.status(200).json({
        message:
          "Đã cập nhật dữ liệu và gửi lệnh đồng bộ xuống mạng phần cứng!",
      });
    } else {
      res.status(503).json({ error: "Mất kết nối tới trung tâm MQTT Broker!" });
    }
  } catch (error) {
    res.status(500).json({ error: "Lỗi đồng bộ hạ tầng mạng" });
  }
});

// 8. API POST: Đăng nhập quản trị điều hành
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({
      email: email,
      password: password,
    });

    if (user) {
      res.json({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "user",
        zone: user.zone || "KV1",
      });
    } else {
      res
        .status(401)
        .json({ error: "Tài khoản hoặc mật khẩu không chính xác!" });
    }
  } catch (err) {
    res.status(500).json({ error: "Lỗi xác thực hệ thống" });
  }
});

// 9. API GET: Đọc toàn bộ nhật ký sự cố môi trường lịch sử
app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await alertsCollection
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Lỗi đọc cơ sở dữ liệu sự cố" });
  }
});

// BÁO CHO EXPRESS BIẾT NƠI CHỨA GIAO DIỆN REACT (Thư mục 'dist')
app.use(express.static(path.join(__dirname, "dist")));

// 2. BẢN VÁ LỖI PATH-TO-REGEXP: Hứng mọi đường dẫn để trả về giao diện React
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// KHỞI ĐỘNG HỆ THỐNG GIAO TIẾP
app.listen(port, () => {
  console.log(
    `[OK] API Server đang vận hành mượt mà tại: http://127.0.0.1:${port}`,
  );
  connectDB();
});
