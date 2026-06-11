import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.optimizers import Adam
from google.colab import drive

print("=== BƯỚC 0: KẾT NỐI GOOGLE DRIVE ===")
drive.mount('/content/drive')

print("\n=== GIAI ĐOẠN 1: NẠP DỮ LIỆU SẠCH VÀ CHUẨN BỊ MA TRẬN ===")
# Trỏ trực tiếp vào file dữ liệu ĐÃ ĐƯỢC LÀM SẠCH (4 thông số)
path_clean_data = '/content/drive/MyDrive/IoT_Dataset/clean_dhaka_4_vars.csv'

print("Đang đọc dữ liệu sạch từ Google Drive...")
df_dhaka = pd.read_csv(path_clean_data)

# 1. Thiết lập trục thời gian chuẩn
df_dhaka['datetime'] = pd.to_datetime(df_dhaka['datetime'])
df_dhaka = df_dhaka.set_index('datetime')

# 2. Lọc lấy dữ liệu từ 2020 trở đi để bám sát xu hướng khí hậu hiện tại
df_recent = df_dhaka[df_dhaka.index.year >= 2020].copy()
print(f"-> Số bản ghi từ năm 2020 đến nay: {len(df_recent)} dòng.")

# 3. Ép xung Delta T = 15 phút (Nội suy tuyến tính dựa trên thời gian thực)
print("-> Đang đồng bộ hóa trục thời gian Delta T = 15 phút...")
df_15m = df_recent.resample('15min').interpolate(method='linear')

# 4. Phân chia tập Huấn luyện (80%) và tập Kiểm thử (20%)
train_size = int(len(df_15m) * 0.8)
df_train = df_15m.iloc[:train_size].copy()
df_test = df_15m.iloc[train_size:].copy()

cols = ['t', 'h', 'p2', 'p10']

# 5. THIẾT LẬP MỐC BIÊN VẬT LÝ MỚI (Nhiệt độ 0 - 70 độ C)
anchor_min = pd.DataFrame([[0.0, 0.0, 0.0, 0.0]], columns=cols)
anchor_max = pd.DataFrame([[70.0, 100.0, 1000.0, 1000.0]], columns=cols)
df_train = pd.concat([df_train, anchor_min, anchor_max], ignore_index=True)

df_train = df_train[cols]
df_test = df_test[cols]

# 6. Chuẩn hóa Min-Max [0, 1]
scaler = MinMaxScaler(feature_range=(0, 1))
scaled_train = scaler.fit_transform(df_train)
scaled_test = scaler.transform(df_test)

# 7. Thuật toán Cửa sổ trượt (Sliding Window: 12 mốc = 3 tiếng)
def create_sequences(data, time_steps=12):
    X, Y = [], []
    for i in range(len(data) - time_steps):
        X.append(data[i:(i + time_steps), :])
        Y.append([data[i + time_steps, 0], data[i + time_steps, 1], data[i + time_steps, 2], data[i + time_steps, 3]])
    return np.array(X), np.array(Y)

time_steps = 12 
X_train, y_train = create_sequences(scaled_train, time_steps)
X_test, y_test = create_sequences(scaled_test, time_steps)

print(f"-> Ma trận Học (Train X): {X_train.shape}")
print(f"-> Ma trận Thi (Test X): {X_test.shape}")


print("\n=== GIAI ĐOẠN 2: HUẤN LUYỆN MẠNG LSTM (CHỐNG OVERFITTING & OVERSHOOT) ===")
# Kiến trúc não bộ: Tinh gọn, tốc độ cao, nhắm mắt 30% để không học vẹt
model = Sequential([
    LSTM(32, return_sequences=True, input_shape=(X_train.shape[1], X_train.shape[2])),
    Dropout(0.3), 
    LSTM(16, return_sequences=False),
    Dropout(0.3),
    Dense(8, activation='relu'),
    Dense(4) # Đầu ra 4 thông số: Nhiệt, Ẩm, PM2.5, PM10
])

# Bóp nhỏ tốc độ học (Learning Rate = 0.0003) để AI đi chậm lại, không bị vọt hố
custom_optimizer = Adam(learning_rate=0.0003)
model.compile(optimizer=custom_optimizer, loss='mse', metrics=['mae'])

# Kích hoạt giám sát: Tăng kiên nhẫn lên 15 vòng vì AI đang đi những bước nhỏ
early_stopping = EarlyStopping(
    monitor='val_loss', 
    patience=15,             
    restore_best_weights=True,
    verbose=1
)

print("-> Bắt đầu nạp dữ liệu vào não bộ AI...")
history = model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=100,
    batch_size=128,
    callbacks=[early_stopping], 
    verbose=1
)

path_to_save_model = '/content/drive/MyDrive/IoT_Dataset/forecast_model.h5'
model.save(path_to_save_model)
print(f"\n✅ Đã lưu bộ não AI (Nhiệt độ 0-70) tại: {path_to_save_model}")


print("\n=== GIAI ĐOẠN 3: XUẤT BIỂU ĐỒ BÁO CÁO ĐỒ ÁN ===")
actual_epochs = len(history.history['loss'])
epochs_range = range(1, actual_epochs + 1)

# 1. BIỂU ĐỒ ĐỘ MẤT MÁT (MSE)
plt.figure(figsize=(10, 6))
plt.plot(epochs_range, history.history['loss'], label='Train Loss (Sai số tập Học)', color='blue', linewidth=2)
plt.plot(epochs_range, history.history['val_loss'], label='Validation Loss (Sai số tập Kiểm thử)', color='red', linewidth=2)
plt.title(f'BIỂU ĐỒ ĐỘ MẤT MÁT (MSE) TRONG {actual_epochs} EPOCHS', fontsize=14, fontweight='bold')
plt.xlabel('Chu kỳ (Epochs)', fontsize=12)
plt.ylabel('Mức độ mất mát (MSE)', fontsize=12)
plt.xlim(1, actual_epochs)
plt.legend(fontsize=12)
plt.grid(True, linestyle='--', alpha=0.7)
path_loss_img = '/content/drive/MyDrive/IoT_Dataset/Loss_Chart_Final.png'
plt.savefig(path_loss_img, dpi=300, bbox_inches='tight')
plt.show()

# 2. BIỂU ĐỒ SAI LỆCH TUYỆT ĐỐI (MAE)
plt.figure(figsize=(10, 6))
plt.plot(epochs_range, history.history['mae'], label='Train MAE (Độ chệch tập Học)', color='green', linewidth=2)
plt.plot(epochs_range, history.history['val_mae'], label='Validation MAE (Độ chệch tập Kiểm thử)', color='orange', linewidth=2)
plt.title(f'BIỂU ĐỒ SAI LỆCH TUYỆT ĐỐI (MAE) TRONG {actual_epochs} EPOCHS', fontsize=14, fontweight='bold')
plt.xlabel('Chu kỳ (Epochs)', fontsize=12)
plt.ylabel('Sai số đơn vị thực tế (MAE)', fontsize=12)
plt.xlim(1, actual_epochs)
plt.legend(fontsize=12)
plt.grid(True, linestyle='--', alpha=0.7)
path_mae_img = '/content/drive/MyDrive/IoT_Dataset/MAE_Chart_Final.png'
plt.savefig(path_mae_img, dpi=300, bbox_inches='tight')
plt.show()