import { useState, useEffect } from "react"; // Sử dụng useEffect để fetch dữ liệu
import {
  AlertTriangle,
  Clock,
  MapPin,
  Search,
  Filter,
  ShieldAlert,
} from "lucide-react";
import { motion } from "motion/react";

interface Alert {
  _id: string; // Sử dụng _id của MongoDB
  node_id: string;
  type: "temperature" | "pm25";
  severity: "critical" | "high" | "medium";
  message: string;
  timestamp: string;
  status: string;
}

interface AlertsManagementProps {
  onViewStation: (station: any) => void;
}

export function AlertsManagement({ onViewStation }: AlertsManagementProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Gọi API lấy dữ liệu thực tế khi load trang
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(
          "https://do-an-r2gd.onrender.com/api/alerts",
        );
        const data = await response.json();
        setAlerts(data);
      } catch (error) {
        console.error("Lỗi fetch alerts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
    // Tự động làm mới mỗi 10 giây
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredAlerts = alerts.filter(
    (a) =>
      a.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.node_id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return <div className="p-8 text-white">Đang tải dữ liệu cảnh báo...</div>;

  return (
    <div className="h-full w-full bg-gray-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="text-red-500" />
              Trung tâm cảnh báo
            </h1>
            <p className="text-gray-400 text-sm">
              Hệ thống AI đang giám sát mạng LoRa 24/7. Hiện có {alerts.length}{" "}
              sự cố được ghi nhận.
            </p>
          </div>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm kiếm trạm, ID hoặc nội dung cảnh báo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Danh sách cảnh báo thực tế từ Database */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-500">
                Hệ thống đang hoạt động ổn định. Không có cảnh báo nào.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <motion.div
                key={alert._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-gray-900 border ${alert.severity === "critical" ? "border-red-500/50" : "border-orange-500/50"} rounded-xl p-5`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${alert.severity === "critical" ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"}`}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">
                        {alert.message}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={15} className="text-cyan-500" />
                          <span>ID Trạm: {alert.node_id}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={15} />
                          <span>
                            {new Date(alert.timestamp).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onViewStation(alert.node_id)}
                    className="px-4 py-2 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 rounded-lg text-sm font-medium transition-colors border border-cyan-500/20"
                  >
                    Định vị trạm
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
