import { useEffect, useState } from "react";
import { WebGISMap } from "../components/WebGISMap";
import { StationInfoCard } from "../components/StationInfoCard";
import { StationManagement } from "../components/StationManagement";
import { AlertsManagement } from "../components/AlertsManagement";
import { PersonnelManagement } from "../components/PersonnelManagement";
import { AIAnalytics } from "../components/AIAnalytics";
import { Settings as SettingsComponent } from "../components/Settings";
import {
  Users,
  AlertTriangle,
  BarChart3,
  Radio,
  Settings,
  Server,
  LogOut,
  LogIn,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";

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

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles: string[];
}

// BẢN VÁ LỖI 1: Xóa trắng mảng khởi tạo để không còn bóng ma "NODE ESP32-001"
const initialStations: Station[] = [];

export function AdminDashboard() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved
      ? JSON.parse(saved)
      : { name: "Khách", role: "guest", email: "" };
  });

  const [stations, setStations] = useState<Station[]>(initialStations);
  const [currentView, setCurrentView] = useState("map");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );

  const [mapSettings, setMapSettings] = useState({
    darkMode: true,
    heatmapEnabled: true,
    showConnections: true,
    mapOpacity: 100,
  });

  const [sysSettings, setSysSettings] = useState({
    autoDispatch: true,
    soundAlerts: true,
    emailNotifications: true,
  });

  const navItems: NavItem[] = [
    {
      id: "map",
      label: "Bản đồ WebGIS",
      icon: <Radio size={20} />,
      allowedRoles: ["guest", "user", "admin", "technician", "analyst"],
    },
    {
      id: "alerts",
      label: "Cảnh báo & Sự cố",
      icon: <AlertTriangle size={20} />,
      allowedRoles: ["admin", "user", "technician", "analyst"],
    },
    {
      id: "analytics",
      label: "AI Analytics",
      icon: <BarChart3 size={20} />,
      allowedRoles: ["admin", "user", "analyst"],
    },
    {
      id: "stations",
      label: "Quản lý Trạm",
      icon: <Server size={20} />,
      allowedRoles: ["admin", "technician"],
    },
    {
      id: "personnel",
      label: "Nhân sự",
      icon: <Users size={20} />,
      allowedRoles: ["admin"],
    },
    {
      id: "settings",
      label: "Cài đặt",
      icon: <Settings size={20} />,
      allowedRoles: ["admin"],
    },
  ];

  const currentRole = currentUser?.role || "guest";
  const visibleNavItems = navItems.filter((item) =>
    item.allowedRoles.includes(currentRole),
  );
  const currentSelectedStation = stations.find(
    (s) => s.id === selectedStationId,
  );

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch("/api/stations");
        if (res.ok) {
          const data = await res.json();
          // BẢN VÁ LỖI 2: Ánh xạ 100% tọa độ và khu vực gốc từ MongoDB
          const mapped = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            zone: item.zone || "Hải Phòng",
            position: item.position || [20.733, 106.642], // LẤY TỌA ĐỘ THẬT
            type: item.type || "node",
            temperature: item.temperature,
            humidity: item.humidity,
            light: 500,
            pirMotion: false,
            pm25: item.pm25,
            history: [],
          }));
          setStations(mapped);
        }
      } catch (err) {
        console.error("Lỗi cập nhật trạm:", err);
      }
    };
    fetchStations();
    const interval = setInterval(fetchStations, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleViewStationOnMap = (station: Station) => {
    setSelectedStationId(station.id);
    setCurrentView("map");
  };

  const handleAddStation = (s: Station) => setStations([...stations, s]);
  const handleUpdateStation = (s: Station) =>
    setStations(stations.map((item) => (item.id === s.id ? s : item)));
  const handleDeleteStation = (id: string) =>
    setStations(stations.filter((item) => item.id !== id));

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* SIDEBAR BẢO VỆ PHÂN QUYỀN ĐỘNG */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="text-cyan-500" />
            AIoT WebGIS
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {visibleNavItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentView === item.id
                      ? "bg-cyan-600/10 text-cyan-400 border border-cyan-500/20"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          {currentRole !== "guest" ? (
            <div className="space-y-3">
              <div className="px-2 text-sm text-gray-400 truncate">
                Xin chào,{" "}
                <span className="text-cyan-400 font-medium">
                  {currentUser.name}
                </span>
                <span className="block text-[11px] text-gray-500 capitalize">
                  Quyền: {currentRole}
                </span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("currentUser");
                  setCurrentUser({ name: "Khách", role: "guest", email: "" });
                  setCurrentView("map");
                }}
                className="flex items-center gap-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 w-full px-4 py-2.5 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                Đăng xuất
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white w-full px-4 py-2.5 rounded-lg transition-colors font-medium shadow-lg"
            >
              <LogIn size={18} />
              Đăng nhập quản trị
            </button>
          )}
        </div>
      </div>

      {/* KHU VỰC HIỂN THỊ NỘI DUNG */}
      <div className="flex-1 relative bg-gray-950">
        {currentView === "map" && (
          <>
            <WebGISMap
              stations={stations}
              onStationClick={(station) => setSelectedStationId(station.id)}
              selectedStation={currentSelectedStation || null}
              mapSettings={mapSettings}
            />
            <AnimatePresence>
              {currentSelectedStation && (
                <StationInfoCard
                  station={currentSelectedStation}
                  onClose={() => setSelectedStationId(null)}
                />
              )}
            </AnimatePresence>
          </>
        )}

        {currentView === "stations" &&
          ["admin", "technician"].includes(currentRole) && (
            <StationManagement
              stations={stations}
              onViewOnMap={handleViewStationOnMap}
              onAddStation={handleAddStation}
              onUpdateStation={handleUpdateStation}
              onDeleteStation={handleDeleteStation}
            />
          )}

        {currentView === "alerts" && currentRole !== "guest" && (
          <AlertsManagement onViewStation={handleViewStationOnMap} />
        )}

        {currentView === "personnel" && currentRole === "admin" && (
          <PersonnelManagement currentUserEmail={currentUser.email} />
        )}

        {currentView === "analytics" &&
          ["admin", "user", "analyst"].includes(currentRole) && <AIAnalytics />}

        {currentView === "settings" && currentRole === "admin" && (
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
  );
}
