import { useState } from "react";
import {
  Settings as SettingsIcon,
  Bell,
  Map,
  Shield,
  Server,
  User,
  Moon,
  Sun,
  Send,
  Layers,
  Eye,
  Volume2,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SettingsProps {
  mapSettings: {
    darkMode: boolean;
    heatmapEnabled: boolean;
    showConnections: boolean;
    mapOpacity: number;
  };
  setMapSettings: (settings: any) => void;
  sysSettings: {
    autoDispatch: boolean;
    soundAlerts: boolean;
    emailNotifications: boolean;
  };
  setSysSettings: (settings: any) => void;
  // THÊM INTERFACE CHO CURRENT USER
  currentUser: { name: string; email: string; role: string };
}

export function Settings({
  mapSettings,
  setMapSettings,
  sysSettings,
  setSysSettings,
  currentUser,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<
    "system" | "map" | "notifications" | "account"
  >("account"); // Mở sẵn tab Account để bạn test

  const [thresholdTemp, setThresholdTemp] = useState("35");
  const [thresholdHumidity, setThresholdHumidity] = useState("80");
  const [thresholdPm25, setThresholdPm25] = useState("100");
  const [isSyncing, setIsSyncing] = useState(false);

  const tabs = [
    { id: "system", label: "Hệ thống", icon: <Server size={18} /> },
    { id: "map", label: "Bản đồ WebGIS", icon: <Map size={18} /> },
    { id: "notifications", label: "Thông báo", icon: <Bell size={18} /> },
    { id: "account", label: "Tài khoản", icon: <User size={18} /> },
  ] as const;

  const Toggle = ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (val: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-cyan-500" : "bg-gray-700"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );

  const handleSaveThresholds = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(
        "https://do-an-r2gd.onrender.com/api/settings/thresholds",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temp: thresholdTemp,
            humidity: thresholdHumidity,
            pm25: thresholdPm25,
          }),
        },
      );
      if (response.ok)
        alert(
          "Đã lưu và đồng bộ ngưỡng cảnh báo mới xuống các trạm thành công!",
        );
    } catch (error) {
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCache = () => {
    if (
      window.confirm(
        "Bạn có chắc muốn xóa toàn bộ dữ liệu bộ nhớ tạm và tải lại trang?",
      )
    ) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  // Hàm chuyển đổi chức danh sang Tiếng Việt
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Quản trị viên (Admin)";
      case "technician":
        return "Kỹ thuật viên";
      case "analyst":
        return "Chuyên gia phân tích AI";
      default:
        return "Người dùng (Chờ phân quyền)";
    }
  };

  return (
    <div className="h-full w-full bg-gray-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="text-gray-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Cài đặt hệ thống
            </h1>
            <p className="text-gray-400 text-sm">
              Cấu hình WebGIS, ngưỡng cảnh báo và điều phối nhân sự.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 flex flex-col gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-cyan-600/10 text-cyan-400 border border-cyan-500/20" : "text-gray-400 hover:text-white hover:bg-gray-900"}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-6 lg:p-8 shadow-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* --- TAB HỆ THỐNG --- */}
                {activeTab === "system" && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Shield className="text-cyan-500" size={20} />
                        Ngưỡng cảnh báo cảm biến
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-400">
                            Nhiệt độ (°C)
                          </label>
                          <input
                            type="number"
                            value={thresholdTemp}
                            onChange={(e) => setThresholdTemp(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-400">
                            Độ ẩm (%)
                          </label>
                          <input
                            type="number"
                            value={thresholdHumidity}
                            onChange={(e) =>
                              setThresholdHumidity(e.target.value)
                            }
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-400">
                            PM2.5 (µg/m³)
                          </label>
                          <input
                            type="number"
                            value={thresholdPm25}
                            onChange={(e) => setThresholdPm25(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={handleSaveThresholds}
                          disabled={isSyncing}
                          className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-all shadow-lg"
                        >
                          <Send size={18} />
                          {isSyncing ? "Đang gửi..." : "Đồng bộ xuống Trạm"}
                        </button>
                      </div>
                    </div>
                    <hr className="border-gray-800" />
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Tự động hóa & AI
                      </h3>
                      <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800">
                        <div>
                          <div className="font-medium text-white">
                            Tự động điều phối hiện trường
                          </div>
                          <div className="text-xs text-gray-400">
                            AI tự động gửi thông báo điều động kỹ thuật viên gần
                            nhất.
                          </div>
                        </div>
                        <Toggle
                          enabled={sysSettings.autoDispatch}
                          onChange={(v) =>
                            setSysSettings({ ...sysSettings, autoDispatch: v })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB BẢN ĐỒ WEBGIS --- */}
                {activeTab === "map" && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Layers className="text-cyan-500" size={20} />
                        Cấu hình hiển thị bản đồ
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2 rounded-lg ${mapSettings.darkMode ? "bg-cyan-500/10 text-cyan-400" : "bg-orange-500/10 text-orange-400"}`}
                            >
                              {mapSettings.darkMode ? (
                                <Moon size={20} />
                              ) : (
                                <Sun size={20} />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white">
                                Chế độ nền tối (Dark Mode)
                              </div>
                              <div className="text-xs text-gray-400">
                                Thay đổi nền của bản đồ GIS.
                              </div>
                            </div>
                          </div>
                          <Toggle
                            enabled={mapSettings.darkMode}
                            onChange={(v) =>
                              setMapSettings({ ...mapSettings, darkMode: v })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                              <Eye size={20} />
                            </div>
                            <div>
                              <div className="font-medium text-white">
                                Hiển thị AI Heatmap
                              </div>
                              <div className="text-xs text-gray-400">
                                Lớp phủ vùng rủi ro lên bản đồ.
                              </div>
                            </div>
                          </div>
                          <Toggle
                            enabled={mapSettings.heatmapEnabled}
                            onChange={(v) =>
                              setMapSettings({
                                ...mapSettings,
                                heatmapEnabled: v,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-green-500/10 text-green-400 rounded-lg">
                              <Radio size={20} />
                            </div>
                            <div>
                              <div className="font-medium text-white">
                                Đường nối LoRa Topology
                              </div>
                              <div className="text-xs text-gray-400">
                                Vẽ đường nối logic giữa Node và Aggregator.
                              </div>
                            </div>
                          </div>
                          <Toggle
                            enabled={mapSettings.showConnections}
                            onChange={(v) =>
                              setMapSettings({
                                ...mapSettings,
                                showConnections: v,
                              })
                            }
                          />
                        </div>
                        <div className="p-4 bg-gray-950/50 rounded-lg border border-gray-800">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-white">
                              Độ trong suốt bản đồ (Opacity)
                            </span>
                            <span className="text-xs text-cyan-400">
                              {mapSettings.mapOpacity}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="100"
                            value={mapSettings.mapOpacity}
                            onChange={(e) =>
                              setMapSettings({
                                ...mapSettings,
                                mapOpacity: parseInt(e.target.value),
                              })
                            }
                            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB THÔNG BÁO --- */}
                {activeTab === "notifications" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <Bell className="text-cyan-500" size={20} />
                      Tùy chọn thông báo
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800">
                        <div className="flex items-center gap-3">
                          <Volume2 size={20} className="text-gray-400" />
                          <div className="font-medium text-white">
                            Âm thanh cảnh báo (Beep)
                          </div>
                        </div>
                        <Toggle
                          enabled={sysSettings.soundAlerts}
                          onChange={(v) =>
                            setSysSettings({ ...sysSettings, soundAlerts: v })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-lg border border-gray-800">
                        <div className="flex items-center gap-3">
                          <Bell size={20} className="text-gray-400" />
                          <div className="font-medium text-white">
                            Thông báo qua Email
                          </div>
                        </div>
                        <Toggle
                          enabled={sysSettings.emailNotifications}
                          onChange={(v) =>
                            setSysSettings({
                              ...sysSettings,
                              emailNotifications: v,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB TÀI KHOẢN (CẬP NHẬT DỮ LIỆU ĐỘNG) --- */}
                {activeTab === "account" && (
                  <div className="space-y-6 text-center py-4">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 bg-cyan-600 rounded-full flex items-center justify-center text-4xl font-bold text-white border-4 border-gray-800 shadow-2xl mx-auto uppercase">
                        {currentUser.name.charAt(0)}
                      </div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-gray-900 rounded-full"></div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {currentUser.name}
                      </h2>
                      <p className="text-cyan-400 text-sm mb-1">
                        {currentUser.email}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Quyền hạn:{" "}
                        <span className="text-white font-medium">
                          {getRoleDisplayName(currentUser.role)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                      <button className="py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors border border-gray-700">
                        Đổi mật khẩu
                      </button>
                      <button
                        onClick={handleClearCache}
                        className="py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors border border-red-500/20"
                      >
                        Xóa dữ liệu bộ nhớ tạm
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
