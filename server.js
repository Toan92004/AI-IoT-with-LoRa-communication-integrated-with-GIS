import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import mqtt from "mqtt";
import dns from "dns";
import axios from "axios"; // Thư viện mới thêm vào để gọi API Python

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Change DNS
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// --- CẤU HÌNH MONGODB ---
const dbUser = "esp32_admin";
const dbPass = encodeURIComponent("12345678aA");
const mongoUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.jzljua6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const dbName = "IoT_Project";

let db;
let sensorCollection;
let usersCollection;
let stationConfigCollection;
let alertsCollection; // Biến lưu collection Alerts

// --- CẤU HÌNH HIVEMQ ĐỂ GỬI LỆNH XUỐNG ESP32 ---
const mqttServer =
  "mqtts://6ec51b2e9c764674a51fd112c6ca60ed.s1.eu.hivemq.cloud:8883";
const mqttOptions = {
  username: "dodanhtoan",
  password: "Toan1234",
  clientId: "NodeJS_API_Server_" + Math.random().toString(16).substring(2, 10),
};
const mqttClient = mqtt.connect(mqttServer, mqttOptions);

mqttClient.on("connect", () => {
  console.log("-> API Server đã kết nối HiveMQ để sẵn sàng gửi lệnh!");
});

// Kết nối Database
async function connectDB() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(dbName);
    sensorCollection = db.collection("SensorData");
    usersCollection = db.collection("Users");
    stationConfigCollection = db.collection("StationConfig");
    alertsCollection = db.collection("Alerts");
    console.log("-> API đã kết nối tới MongoDB Atlas thành công!");
  } catch (err) {
    console.error("Lỗi kết nối DB:", err);
  }
}

// ================= API MỚI: KẾT NỐI VỚI AI SERVICE (PYTHON) =================
app.get("/api/ai-analytics", async (req, res) => {
  try {
    // 1. Lấy dữ liệu mới nhất của 3 trạm (Node1, Node2, Node3)
    const n1 =
      (await sensorCollection.findOne(
        { node_id: "Node1" },
        { sort: { timestamp: -1 } },
      )) || {};
    const n2 =
      (await sensorCollection.findOne(
        { node_id: "Node2" },
        { sort: { timestamp: -1 } },
      )) || {};
    const n3 =
      (await sensorCollection.findOne(
        { node_id: "Node3" },
        { sort: { timestamp: -1 } },
      )) || {};

    const parseNode = (n) => ({
      t: n.temperature || 25.0,
      h: n.humidity || 60.0,
      p2: n.pm2_5 || 15.0,
      p10: n.pm10 || 15.0,
      b_uno: n.b_uno || 100.0,
      b_sen: n.b_sen || 100.0,
    });

    const aiPayload = {
      Node1: parseNode(n1),
      Node2: parseNode(n2),
      Node3: parseNode(n3),
    };

    // 2. Gửi dữ liệu sang AI Service (Python) ở cổng 8000
    const pythonResponse = await axios.post(
      "http://localhost:8000/api/predict",
      aiPayload,
    );
    const aiResult = pythonResponse.data;

    // 3. Lấy 10 bản ghi quá khứ của trạm Node1 để vẽ biểu đồ
    const recent = await sensorCollection
      .find({ node_id: "Node1" }) // Sửa lại thành Node1 ở đây
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    recent.reverse();

    const chartData = recent.map((d) => {
      const timeStr = new Date(d.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        time: timeStr !== "Invalid Date" ? timeStr : "N/A",
        actualTemp: d.temperature,
        actualPM25: d.pm2_5,
        predictedTemp: d.temperature, // Để nối tiếp đường đứt đoạn
        predictedPM25: d.pm2_5,
      };
    });

    // 4. Thêm kết quả dự báo tương lai (30 phút tới) vào cuối biểu đồ
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 30);
    chartData.push({
      time: futureTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      actualTemp: null,
      actualPM25: null,
      predictedTemp: aiResult.forecast.predictedTemp,
      predictedPM25: aiResult.forecast.predictedPM25,
    });

    res.json({
      success: true,
      chartData: chartData,
      aiResult: aiResult,
    });
  } catch (error) {
    console.error("Lỗi AI Analytics:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Lỗi kết nối tới AI Service" });
  }
});

// ================= CÁC API GỐC CỦA HỆ THỐNG =================

// 1. API GET: Lấy dữ liệu cảm biến (Gộp telemetry mới nhất)
app.get("/api/stations", async (req, res) => {
  try {
    const stations = await sensorCollection
      .aggregate([
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: "$node_id",
            temperature: { $first: "$temperature" },
            humidity: { $first: "$humidity" },
            pm2_5: { $first: "$pm2_5" },
            pm10: { $first: "$pm10" },
            timestamp: { $first: "$timestamp" },
          },
        },
      ])
      .toArray();

    const formattedData = stations.map((s) => ({
      id: s._id,
      name: s._id === "Node3" ? "Trạm Trung Tâm (GĐ 3)" : s._id,
      temperature: s.temperature,
      humidity: s.humidity,
      pm25: s.pm2_5,
      timestamp: s.timestamp,
    }));
    res.json(formattedData);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn dữ liệu" });
  }
});

// ================= QUẢN LÝ NHÂN SỰ =================
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
    res.status(500).json({ error: "Lỗi server" });
  }
});

// 3. API GET: Lấy danh sách nhân sự
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
    res.status(500).json({ error: "Lỗi truy vấn nhân sự" });
  }
});

// 4. API POST: Thêm nhân sự trực tiếp từ Admin Dashboard
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, phone, role, zone } = req.body;
    const existingUser = await usersCollection.findOne({ email: email });
    if (existingUser)
      return res
        .status(400)
        .json({ error: "Email này đã tồn tại trong hệ thống!" });

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
    res.status(500).json({ error: "Lỗi thêm nhân sự" });
  }
});

// 5. API PUT: Cập nhật thông tin nhân sự
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, zone } = req.body;

    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, phone, role, zone } },
    );
    res.json({ message: "Cập nhật thành công!" });
  } catch (err) {
    console.error("Lỗi cập nhật:", err);
    res.status(500).json({ error: "Lỗi cập nhật nhân sự" });
  }
});

// 6. API DELETE: Xóa nhân sự
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await usersCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Xóa thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa nhân sự" });
  }
});

// ================= QUẢN LÝ TRẠM =================
app.post("/api/stations/config", async (req, res) => {
  try {
    await stationConfigCollection.insertOne(req.body);
    res.status(201).json({ message: "Đã lưu trạm" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lưu trạm" });
  }
});

app.put("/api/stations/config/:id", async (req, res) => {
  try {
    // Dùng id string (VD: NODE-ESP32-001) thay vì ObjectId
    await stationConfigCollection.updateOne(
      { id: req.params.id },
      { $set: req.body },
    );
    res.status(200).json({ message: "Cập nhật thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật trạm" });
  }
});

app.delete("/api/stations/config/:id", async (req, res) => {
  try {
    await stationConfigCollection.deleteOne({ id: req.params.id });
    res.status(200).json({ message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa trạm" });
  }
});

app.post("/api/settings/thresholds", async (req, res) => {
  try {
    const { temp, humidity, pm25 } = req.body;

    // Đóng gói dữ liệu thành chuỗi JSON
    const payload = JSON.stringify({
      cmd: "set_threshold",
      t: parseFloat(temp),
      h: parseFloat(humidity),
      p2: parseFloat(pm25),
    });

    // Bắn qua MQTT tới topic mà ESP32 đang lắng nghe (subscribe)
    if (mqttClient.connected) {
      mqttClient.publish("esp8266/client", payload);
      console.log("-> Đã đồng bộ ngưỡng mới xuống các trạm:", payload);
      res.status(200).json({ message: "Đã cập nhật và gửi xuống các trạm!" });
    } else {
      res.status(503).json({ error: "Mất kết nối đến MQTT Broker!" });
    }
  } catch (error) {
    console.error("Lỗi cập nhật ngưỡng:", error);
    res.status(500).json({ error: "Lỗi server cục bộ" });
  }
});

// --- API POST: Đăng nhập (Login) ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user trong Database khớp email và password
    const user = await usersCollection.findOne({
      email: email,
      password: password,
    });

    if (user) {
      // Nếu đúng, trả về thông tin user (không trả về password để bảo mật)
      res.json({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "user",
        zone: user.zone || "KV1",
      });
      console.log(`-> [LOGIN] Tài khoản đã đăng nhập: ${email}`);
    } else {
      // Nếu sai email hoặc mật khẩu
      res.status(401).json({ error: "Email hoặc mật khẩu không chính xác!" });
    }
  } catch (err) {
    console.error("Lỗi API Đăng nhập:", err);
    res.status(500).json({ error: "Lỗi server cục bộ" });
  }
});

// --- API GET: Lấy toàn bộ lịch sử cảnh báo ---
app.get("/api/alerts", async (req, res) => {
  try {
    // Sắp xếp theo thời gian mới nhất lên đầu
    const alerts = await alertsCollection
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy dữ liệu cảnh báo từ database" });
  }
});

app.listen(port, () => {
  console.log(`API Server đang chạy tại: http://127.0.0.1:${port}`);
  connectDB();
});
