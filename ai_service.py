from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import tensorflow as tf
from collections import deque
import os
import uvicorn

app = FastAPI(title="AI Prediction Service")

# --- THÊM CẤU HÌNH CORS ĐỂ KHÔNG BỊ LỖI KHI KẾT NỐI VỚI NODE.JS / REACT ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. CẤU HÌNH ĐƯỜNG DẪN VÀ TẢI MÔ HÌNH H5 ---
MODEL_PATH = "forecast_model.h5"
model = None

if os.path.exists(MODEL_PATH):
    try:
        # Tải bộ não AI đã huấn luyện
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        print(f"-> [AI ENGINE] Đã tải thành công bộ não thực tế từ file: {MODEL_PATH}")
    except Exception as e:
        print(f"-> [AI ERROR] Lỗi khi tải file .h5: {str(e)}")
else:
    print(f"-> [AI WARNING] Không tìm thấy file {MODEL_PATH}. Hệ thống tạm thời chạy bằng thuật toán dự phòng.")

# --- 2. ĐỊNH NGHĨA BỘ THAM SỐ CHUẨN HÓA (MIN-MAX SCALER) ---
# Thứ tự đặc trưng: [t, h, p2, b_uno, b_sen]
MIN_VALUES = np.array([-20.0, 0.0, 0.0, 0.0, 0.0])
MAX_VALUES = np.array([50.0, 100.0, 1000.0, 100.0, 100.0])

# --- 3. BỘ ĐỆM LƯU TRỮ CHUỖI THỜI GIAN (HISTORY BUFFER) ---
TIME_STEPS = 12
history_buffer = deque(maxlen=TIME_STEPS)

class NodeData(BaseModel):
    t: float
    h: float
    p2: float
    p10: float
    b_uno: float
    b_sen: float

class SyncPayload(BaseModel):
    Node1: NodeData
    Node2: NodeData
    Node3: NodeData

@app.post("/api/predict")
async def predict_environment_and_health(data: SyncPayload):
    global model, history_buffer

    # --- BƯỚC 1: ĐỒNG NHẤT VÀ TÍNH TRUNG BÌNH TOÀN VÙNG ---
    avg_t = (data.Node1.t + data.Node2.t + data.Node3.t) / 3.0
    avg_h = (data.Node1.h + data.Node2.h + data.Node3.h) / 3.0
    avg_p2 = (data.Node1.p2 + data.Node2.p2 + data.Node3.p2) / 3.0
    avg_b_uno = (data.Node1.b_uno + data.Node2.b_uno + data.Node3.b_uno) / 3.0
    avg_b_sen = (data.Node1.b_sen + data.Node2.b_sen + data.Node3.b_sen) / 3.0

    current_state = np.array([avg_t, avg_h, avg_p2, avg_b_uno, avg_b_sen])

    # --- BƯỚC 2: QUẢN LÝ BỘ ĐỆM CHUỖI THỜI GIAN ---
    if len(history_buffer) == 0:
        for _ in range(TIME_STEPS):
            history_buffer.append(current_state)
    else:
        history_buffer.append(current_state)

    # --- BƯỚC 3: KIỂM TRA MÔ HÌNH VÀ THỰC THI DỰ BÁO ---
    if model is not None:
        try:
            input_matrix = np.array(history_buffer)
            scaled_input = (input_matrix - MIN_VALUES) / (MAX_VALUES - MIN_VALUES)
            scaled_input = np.expand_dims(scaled_input, axis=0)

            scaled_prediction = model.predict(scaled_input, verbose=0)[0] 
            
            # Giải chuẩn hóa
            pred_t = float(scaled_prediction[0] * (MAX_VALUES[0] - MIN_VALUES[0]) + MIN_VALUES[0])
            pred_h = float(scaled_prediction[1] * (MAX_VALUES[1] - MIN_VALUES[1]) + MIN_VALUES[1])
            pred_p2 = float(scaled_prediction[2] * (MAX_VALUES[2] - MIN_VALUES[2]) + MIN_VALUES[2])

        except Exception as e:
            print(f"-> [AI ERROR] Lỗi biên dịch mạng LSTM: {str(e)}. Chuyển sang thuật toán dự phòng.")
            pred_t = avg_t + 1.2
            pred_h = avg_h - 1.5
            pred_p2 = avg_p2 + 4.0
    else:
        pred_t = avg_t + 0.8
        pred_h = avg_h - 1.0
        pred_p2 = avg_p2 + 3.5

    # --- BƯỚC 4: TÍNH TOÁN RISK SCORE (Cho Frontend React) ---
    # Tính rủi ro theo % dựa trên dự báo tương lai.
    # Nhiệt độ: 25°C -> 0%, 45°C -> 100% rủi ro
    # Bụi mịn PM2.5: 50µg -> 0%, 200µg -> 100% rủi ro
    risk_temp = max(0.0, min((pred_t - 25.0) / (45.0 - 25.0), 1.0)) * 100
    risk_pm25 = max(0.0, min((pred_p2 - 50.0) / (200.0 - 50.0), 1.0)) * 100
    
    # Lấy rủi ro cao nhất làm rủi ro chung của hệ thống
    risk_score = round(max(risk_temp, risk_pm25), 1)

    # --- BƯỚC 5: ĐÁNH GIÁ MỨC ĐỘ VÀ RA THÔNG BÁO ---
    risk_level = "safe"
    message = "Hệ thống AI đánh giá: Các chỉ số môi trường (T, H, PM2.5) ổn định."

    if risk_score >= 70.0:
        risk_level = "critical"
        message = f"🚨 [AI CẢNH BÁO TỔNG HỢP] Dự báo nguy cơ ô nhiễm hoặc cháy nổ cao ({risk_score}%)! Nhiệt độ sắp tới: {round(pred_t,1)}°C - Bụi mịn: {round(pred_p2,1)}µg/m³."
    elif risk_score >= 40.0:
        risk_level = "warning"
        message = f"⚠️ [AI THỜI TIẾT] Hệ thống phát hiện rủi ro đang tăng dần ({risk_score}%). Cần chú ý theo dõi."
    elif pred_h > 85.0:
        risk_level = "warning"
        message = f"⚠️ Độ ẩm dự báo tăng cao ({round(pred_h,1)}%), nguy cơ chập mạch linh kiện."
    elif data.Node1.b_uno < 25.0 or data.Node1.b_sen < 25.0:
        risk_level = "warning"
        message = "⚠️ Phát hiện năng lượng sụt giảm nghiêm trọng tại Node 1. Khuyến nghị thay pin bảo trì."

    # Định dạng trả về được chuẩn hóa để Node.js/React dễ dàng đọc được
    return {
        "status": "success",
        "forecast": {
            "predictedTemp": round(pred_t, 1),
            "predictedHumidity": round(pred_h, 1),
            "predictedPM25": round(pred_p2, 1)
        },
        "risk_assessment": {
            "score": risk_score,
            "level": risk_level,
            "message": message
        }
    }

if __name__ == "__main__":
    # Tự động chạy server tại cổng 8000 khi thực thi file này
    uvicorn.run("ai_service:app", host="0.0.0.0", port=8000, reload=True)