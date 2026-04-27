import { useEffect, useState, useRef } from "react";
import { WebGISMap } from "../components/WebGISMap";
import { StationInfoCard } from "../components/StationInfoCard";
import { StationManagement } from "../components/StationManagement";
import { AlertsManagement } from "../components/AlertsManagement";
import { PersonnelManagement } from "../components/PersonnelManagement";
import { AIAnalytics } from "../components/AIAnalytics";
import { Settings as SettingsComponent } from "../components/Settings";
import {
  Menu,
  Users,
  AlertTriangle,
  BarChart3,
  Radio,
  Settings,
  Smartphone,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router";

export interface Station {
  id: string;
  name: string;
  zone: string;
  position: [number, number];
  type: "node" | "aggregator";
  temperature: number;
  humidity: number;
  light: number;
  pirMotion: boolean;
  pm25: number;
  history: Array<{
    time: string;
    temp: number;
    humidity: number;
    pm25: number;
  }>;
}

const initialStations: Station[] = [
  {
    id: "NODE-ESP32-001",
    name: "NODE ESP32-001 (Trạm 1)",
    zone: "KV1",
    position: [10.776, 106.701],
    type: "node",
    temperature: 25,
    humidity: 60,
    light: 850,
    pirMotion: false,
    pm25: 15,
    history: [],
  },
  {
    id: "AGG-001",
    name: "Aggregator KV1",
    zone: "KV1",
    position: [10.778, 106.703],
    type: "aggregator",
    temperature: 32,
    humidity: 68,
    light: 750,
    pirMotion: false,
    pm25: 42,
    history: [],
  },
  {
    id: "NODE-ESP32-002",
    name: "NODE ESP32-002 (Trạm 2)",
    zone: "KV2",
    position: [10.773, 106.705],
    type: "node",
    temperature: 28,
    humidity: 72,
    light: 650,
    pirMotion: false,
    pm25: 35,
    history: [],
  },
  {
    id: "NODE-ESP32-003",
    name: "NODE ESP32-003 (Trạm 3 - Gateway)",
    zone: "KV3",
    position: [10.771, 106.698],
    type: "node",
    temperature: 36,
    humidity: 58,
    light: 920,
    pirMotion: false,
    pm25: 85,
    history: [],
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  // --- ĐỌC TÀI KHOẢN TỪ LOCAL STORAGE ---
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [stations, setStations] = useState<Station[]>(initialStations);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<
    "dashboard" | "stations" | "alerts" | "personnel" | "analytics" | "settings"
  >("dashboard");

  const [mapSettings, setMapSettings] = useState({
    darkMode: true,
    heatmapEnabled: true,
    showConnections: true,
    mapOpacity: 100,
  });
  const [sysSettings, setSysSettings] = useState({
    autoDispatch: false,
    soundAlerts: true,
    emailNotifications: true,
  });

  const currentSelectedStation =
    stations.find((s) => s.id === selectedStationId) || null;
  const alertStationsCount = stations.filter(
    (s) => s.temperature > 35 || s.pm25 > 100 || s.pirMotion,
  ).length;
  const prevAlertCountRef = useRef(0);

  // --- KIỂM TRA ĐĂNG NHẬP KHI VỪA MỞ TRANG ---
  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      // Nếu không có dữ liệu -> Chưa đăng nhập -> Đá ra ngoài
      navigate("/login");
    }
  }, [navigate]);

  // Hàm Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("currentUser"); // Xóa dữ liệu phiên
    navigate("/login"); // Trở về trang đăng nhập
  };

  const playBeep = () => {
    /* Code phát âm thanh */
  };

  useEffect(() => {
    if (alertStationsCount > prevAlertCountRef.current) {
      if (sysSettings.soundAlerts) playBeep();
      if (sysSettings.autoDispatch)
        console.log("🤖 [AI Auto Dispatch] Đã điều động.");
    }
    prevAlertCountRef.current = alertStationsCount;
  }, [alertStationsCount, sysSettings]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/api/stations");
        const realData = await response.json();
        const idMapping: Record<string, string> = {
          Node1: "NODE-ESP32-001",
          Node2: "NODE-ESP32-002",
          Node3: "NODE-ESP32-003",
        };
        setStations((prev) =>
          prev.map((station) => {
            const incomingData = realData.find(
              (d: any) => idMapping[d.id] === station.id,
            );
            if (incomingData)
              return {
                ...station,
                temperature: incomingData.temperature ?? station.temperature,
                humidity: incomingData.humidity ?? station.humidity,
                pm25: incomingData.pm25 ?? station.pm25,
              };
            return station;
          }),
        );
      } catch (error) {}
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddStation = async (newStation: Station) => {
    /* Gọi API Post Station */ setStations((prev) => [...prev, newStation]);
  };
  const handleUpdateStation = async (updatedStation: Station) => {
    /* Gọi API Put Station */ setStations((prev) =>
      prev.map((s) => (s.id === updatedStation.id ? updatedStation : s)),
    );
  };
  const handleDeleteStation = async (stationId: string) => {
    /* Gọi API Delete Station */ setStations((prev) =>
      prev.filter((s) => s.id !== stationId),
    );
  };

  const handleViewStationOnMap = (stationOrId: any) => {
    setCurrentView("dashboard");
    setSelectedStationId(
      typeof stationOrId === "string" ? stationOrId : stationOrId.id,
    );
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Quản trị viên";
      case "technician":
        return "Kỹ thuật viên";
      case "analyst":
        return "Chuyên gia AI";
      default:
        return "Người dùng (Chờ duyệt)";
    }
  };

  // NẾU CHƯA LOAD XONG DỮ LIỆU USER THÌ RENDER TRỐNG ĐỂ TRÁNH LỖI
  if (!currentUser)
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center text-white">
        Đang tải dữ liệu...
      </div>
    );

  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Radio className="text-cyan-500" size={24} />
            <h1 className="text-white text-xl font-semibold">
              WebGIS Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <motion.div
            animate={alertStationsCount > 0 ? { opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={`px-4 py-2 rounded-lg font-semibold ${alertStationsCount > 0 ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}
          >
            {alertStationsCount > 0 ? "ALERT" : "SAFE"}
          </motion.div>

          <div className="flex items-center gap-4 text-sm hidden md:flex">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-gray-400">Online:</span>
              <span className="text-white font-semibold">
                {stations.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-gray-400">Avg PM2.5:</span>
              <span className="text-white font-semibold">
                {Math.round(
                  stations.reduce((acc, s) => acc + s.pm25, 0) /
                    (stations.length || 1),
                )}{" "}
                µg/m³
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-gray-400">Alerts:</span>
              <span className="text-white font-semibold">
                {alertStationsCount}
              </span>
            </div>
          </div>

          {/* TÀI KHOẢN ĐANG ĐĂNG NHẬP THỰC TẾ */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
            <div className="text-right">
              <div className="text-white text-sm font-medium">
                {currentUser.name}
              </div>
              <div className="text-gray-400 text-xs">
                {getRoleDisplayName(currentUser.role)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white font-semibold uppercase">
              {currentUser.name.charAt(0)}
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-70 bg-gray-900 border-r border-gray-700 flex flex-col"
            >
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-white font-semibold">Quản lý hệ thống</h2>
              </div>
              <nav className="flex-1 p-2">
                <button
                  onClick={() => setCurrentView("dashboard")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentView === "dashboard" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                >
                  <BarChart3 size={20} />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => setCurrentView("stations")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentView === "stations" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                >
                  <Radio size={20} />
                  <span>Quản lý trạm</span>
                </button>
                <button
                  onClick={() => setCurrentView("alerts")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentView === "alerts" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                >
                  <AlertTriangle size={20} />
                  <span>Cảnh báo</span>
                  {alertStationsCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {alertStationsCount}
                    </span>
                  )}
                </button>

                {/* Chỉ cho Admin xem trang Quản lý nhân sự */}
                {currentUser.role === "admin" && (
                  <button
                    onClick={() => setCurrentView("personnel")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentView === "personnel" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                  >
                    <Users size={20} />
                    <span>Nhân sự</span>
                  </button>
                )}

                <button
                  onClick={() => setCurrentView("analytics")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentView === "analytics" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                >
                  <BarChart3 size={20} />
                  <span>AI Analytics</span>
                </button>
                <button
                  onClick={() => setCurrentView("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${currentView === "settings" ? "text-cyan-400 bg-cyan-500/10" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                >
                  <Settings size={20} />
                  <span>Cài đặt</span>
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative">
          {currentView === "dashboard" && (
            <>
              <WebGISMap
                stations={stations}
                onStationClick={handleViewStationOnMap}
                selectedStation={currentSelectedStation}
                mapSettings={mapSettings}
              />
              <AnimatePresence>
                {currentSelectedStation && (
                  <StationInfoCard
                    key={`station-card-${currentSelectedStation.id}`}
                    station={currentSelectedStation}
                    onClose={() => setSelectedStationId(null)}
                  />
                )}
              </AnimatePresence>
            </>
          )}

          {currentView === "stations" && (
            <StationManagement
              stations={stations}
              onViewOnMap={handleViewStationOnMap}
              onAddStation={handleAddStation}
              onUpdateStation={handleUpdateStation}
              onDeleteStation={handleDeleteStation}
            />
          )}
          {currentView === "alerts" && (
            <AlertsManagement
              stations={stations}
              onViewStation={handleViewStationOnMap}
            />
          )}
          {currentView === "personnel" && (
            <PersonnelManagement currentUserEmail={currentUser.email} />
          )}
          {currentView === "analytics" && <AIAnalytics />}

          {currentView === "settings" && (
            <SettingsComponent
              mapSettings={mapSettings}
              setMapSettings={setMapSettings}
              sysSettings={sysSettings}
              setSysSettings={setSysSettings}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>
    </div>
  );
}
