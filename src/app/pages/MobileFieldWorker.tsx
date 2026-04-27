import { useState, useEffect, useRef } from 'react';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Navigation, Phone, X, ArrowLeft, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default function MobileFieldWorker() {
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(true);
  const [routeStarted, setRouteStarted] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Emergency station location
  const emergencyStation: LatLngExpression = [10.776, 106.701];
  
  // Field worker current location
  const workerLocation: LatLngExpression = [10.772, 106.698];

  // Route path
  const routePath: L.LatLngTuple[] = [
    workerLocation as L.LatLngTuple,
    [10.773, 106.699] as L.LatLngTuple,
    [10.774, 106.700] as L.LatLngTuple,
    [10.775, 106.701] as L.LatLngTuple,
    emergencyStation as L.LatLngTuple,
  ];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [10.774, 106.7],
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!layerGroupRef.current) return;
    
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // Worker Location
    L.circleMarker(workerLocation, {
      radius: 8,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    }).addTo(layerGroup);

    // Emergency Station - Pulsing
    L.circleMarker(emergencyStation, {
      radius: 20,
      fillColor: '#ef4444',
      fillOpacity: 0.6,
      color: '#ef4444',
      weight: 2,
    }).addTo(layerGroup);
    
    L.marker(emergencyStation).addTo(layerGroup);

    // Route Path
    if (routeStarted) {
      L.polyline(routePath, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
      }).addTo(layerGroup);
    }
  }, [routeStarted]);

  return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="absolute top-4 left-4 flex gap-4 z-50">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Quay lại Dashboard</span>
        </Link>
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
        >
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
      </div>

      <div className="text-center mb-8 absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <h1 className="text-white text-2xl font-semibold mb-2">Ứng dụng Nhân viên Hiện trường</h1>
        <p className="text-gray-400">Mô phỏng điện thoại di động</p>
      </div>

      {/* Mobile Phone Mockup */}
      <div className="relative">
        {/* Phone Frame */}
        <div className="w-[380px] h-[760px] bg-gray-900 rounded-[50px] shadow-2xl border-8 border-gray-800 relative overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-950 rounded-b-3xl z-20"></div>

          {/* Screen */}
          <div className="w-full h-full bg-white rounded-[42px] overflow-hidden relative">
            {/* Status Bar */}
            <div className="h-12 bg-gray-900 flex items-center justify-between px-8 pt-2">
              <div className="text-white text-sm">9:41</div>
              <div className="flex items-center gap-2 text-white text-sm">
                <div className="w-4 h-4">📶</div>
                <div className="w-4 h-4">📡</div>
                <div className="w-4 h-4">🔋</div>
              </div>
            </div>

            {/* App Header */}
            <div className="h-14 bg-cyan-600 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Navigation className="text-white" size={20} />
                <span className="text-white font-semibold">LoRa Monitor</span>
              </div>
              <Phone className="text-white" size={20} />
            </div>

            {/* Emergency Notification */}
            <AnimatePresence>
              {showNotification && (
                <motion.div
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -100, opacity: 0 }}
                  className="absolute top-28 left-4 right-4 z-30"
                >
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(239, 68, 68, 0.7)', '0 0 0 10px rgba(239, 68, 68, 0)'] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="bg-red-500 rounded-lg p-4 shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 10, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                        >
                          <AlertTriangle className="text-white" size={24} />
                        </motion.div>
                        <span className="text-white font-bold">KHẨN CẤP</span>
                      </div>
                      <button
                        onClick={() => setShowNotification(false)}
                        className="text-white/80 hover:text-white"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="text-white text-sm space-y-1">
                      <div className="font-semibold">Khu vực 1 - Trạm 001</div>
                      <div>Nguy cơ: <span className="font-bold">CHÁY</span></div>
                      <div className="text-xs opacity-90 mt-2">
                        Nhiệt độ: 40.5°C | Phát hiện xâm nhập
                      </div>
                      <div className="text-xs opacity-90">
                        Di chuyển đến: 10.776°N, 106.701°E
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowNotification(false);
                        setRouteStarted(true);
                      }}
                      className="w-full mt-3 bg-white text-red-600 font-semibold py-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      XEM CHỈ DẪN
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Map */}
            <div className="h-[calc(100%-112px)] relative">
              <div ref={mapContainerRef} className="w-full h-full relative z-[10]"></div>

              {/* Map Controls */}
              <div className="absolute bottom-4 left-4 right-4 z-[1000]">
                {!routeStarted ? (
                  <motion.button
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    onClick={() => setRouteStarted(true)}
                    className="w-full bg-red-500 text-white font-semibold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <AlertTriangle size={20} />
                    <span>KHỞI ĐỘNG CHỈ DẪN</span>
                  </motion.button>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-white rounded-lg p-4 shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600">Khoảng cách</div>
                        <div className="text-lg font-bold text-gray-900">~550m</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">Thời gian dự kiến</div>
                        <div className="text-lg font-bold text-gray-900">~7 phút</div>
                      </div>
                    </div>
                    <button className="w-full bg-blue-500 text-white font-semibold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer">
                      <Navigation size={20} />
                      <span>BẮT ĐẦU DI CHUYỂN</span>
                    </button>
                    <button
                      onClick={() => setRouteStarted(false)}
                      className="w-full bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors"
                    >
                      HỦY
                    </button>
                  </div>
                )}
              </div>

              {/* Emergency Banner */}
              {routeStarted && (
                <motion.div
                  animate={{ opacity: [1, 0.8, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm font-semibold z-[1000]"
                >
                  ⚠️ CẢNH BÁO KHẨN CẤP - TRẠM 001
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Phone Button */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full"></div>
      </div>
    </div>
  );
}
