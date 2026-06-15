import { useState, useEffect } from "react";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "motion/react";

export function AIAnalytics() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

  // States để lưu dữ liệu API
  const [predictionData, setPredictionData] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [batteryData, setBatteryData] = useState<any[]>([]); // State mới lưu dữ liệu Pin
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // 1. Gọi API lấy dữ liệu AI
        const resAnalytics = await fetch(
          "https://do-an-r2gd.onrender.com/api/ai-analytics",
        );
        if (resAnalytics.ok) {
          const dataAnalytics = await resAnalytics.json();
          if (dataAnalytics.success && dataAnalytics.chartData) {
            const firstNode = Object.keys(dataAnalytics.chartData)[0];
            setPredictionData(dataAnalytics.chartData[firstNode] || []);
            setAiAnalysis(dataAnalytics.global_risk);
          }
        }

        // 2. Gọi API lấy dữ liệu các trạm để vẽ biểu đồ Pin (b_uno)
        const resStations = await fetch(
          "https://do-an-r2gd.onrender.com/api/stations",
        );
        if (resStations.ok) {
          const dataStations = await resStations.json();
          const mappedBattery = dataStations
            .filter((s: any) => s.id && s.id.toLowerCase() !== "unknown") // <-- LỌC BỎ CỘT "Unknown"
            .map((s: any) => ({
              name: s.id,
              voltage: s.b_uno ? parseFloat(s.b_uno.toFixed(2)) : 0, // Fallback là 0 nếu mất kết nối
            }));
          setBatteryData(mappedBattery);
        }
      } catch (error) {
        console.error("Lỗi fetch dữ liệu AI & Pin:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    //Thay đổi thời gian làm mới thành 5 phút (300000 ms)
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full w-full bg-gray-950 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Brain className="text-cyan-500" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                AI Analytics & Dự báo
              </h1>
              <p className="text-gray-400 text-sm">
                Phân tích dữ liệu chuỗi thời gian & Tình trạng năng lượng thiết
                bị
              </p>
            </div>
          </div>
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* THÔNG SỐ TỔNG QUAN AI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <span className="flex items-center gap-1 text-red-400 text-sm font-medium bg-red-400/10 px-2 py-1 rounded-full">
                <TrendingUp size={14} />+ 2.4%
              </span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">
              Chỉ số rủi ro toàn cục (AI Risk Score)
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">
                {isLoading ? "--" : aiAnalysis?.score || 0}%
              </span>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <ShieldCheck className="text-green-500" size={24} />
              </div>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">
              Trạng thái hệ thống
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold text-green-400">
                {isLoading
                  ? "Đang phân tích..."
                  : aiAnalysis?.message || "An toàn"}
              </span>
            </div>
          </div>
        </div>

        {/* KHU VỰC BIỂU ĐỒ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* CỘT TRÁI: Biểu đồ xu hướng AI (Đã thêm Nhiệt độ) */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-cyan-500" />
              Xu hướng PM2.5 & Nhiệt độ (Thực tế vs AI Dự báo)
            </h3>
            {isLoading ? (
              <div className="h-72 flex items-center justify-center text-gray-500">
                Đang tải dữ liệu mô hình...
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={predictionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />

                    {/* Trục Y bên Trái dành cho Bụi mịn PM2.5 */}
                    <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} />

                    {/* Trục Y bên Phải dành cho Nhiệt độ */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#f59e0b"
                      fontSize={12}
                    />

                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        borderColor: "#374151",
                        color: "#fff",
                      }}
                      itemStyle={{ color: "#ffffff" }}
                      labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
                    />
                    <Legend />

                    {/* 2 Đường hiển thị PM2.5 (Nối vào trục Trái) */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="actualPM25"
                      name="PM2.5 Thực tế (µg/m³)"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={{ fill: "#06b6d4", r: 4 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="predictedPM25"
                      name="PM2.5 Dự báo (+30p)"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "#ef4444", r: 4 }}
                    />

                    {/* 2 Đường hiển thị Nhiệt độ (Nối vào trục Phải) */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="actualTemp"
                      name="Nhiệt độ Thực tế (°C)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: "#f59e0b", r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="predictedTemp"
                      name="Nhiệt độ Dự báo (+30p)"
                      stroke="#a855f7" // Màu tím nổi bật
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "#a855f7", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: Biểu đồ Điện áp đầu vào mạch Uno */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Zap size={20} className="text-yellow-400" />
              Điện áp cấp Uno (Battery)
            </h3>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Đang quét phần cứng...
              </div>
            ) : (
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={batteryData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#374151"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickFormatter={(val) => val.replace("NODE-", "")}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={11}
                      domain={[0, 5]}
                      tickCount={6}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        borderColor: "#374151",
                        color: "#fff",
                      }}
                      itemStyle={{ color: "#ffffff" }} // <-- Ép màu chữ trắng cho giá trị
                      labelStyle={{ color: "#ffffff", fontWeight: "bold" }} // <-- Ép màu chữ trắng cho Tiêu đề (VD: Node1)
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      formatter={(value: number) => [`${value} V`, "Điện áp"]}
                    />
                    <Bar dataKey="voltage" radius={[4, 4, 0, 0]}>
                      {batteryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.voltage < 3.3 ? "#ef4444" : "#10b981"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                <span className="text-sm text-gray-400">Ổn định (≥ 3.3V)</span>
              </div>
              <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                <span className="text-sm text-gray-400">
                  Pin yếu (&lt; 3.3V)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
