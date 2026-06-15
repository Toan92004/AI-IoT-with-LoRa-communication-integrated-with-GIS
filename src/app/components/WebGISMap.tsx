import { useEffect, useRef, useState } from "react";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// KHỞI TẠO ICON TỪ MÁY CHỦ CDN (Tránh lỗi tàng hình do bundler của React)
const customMarkerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Station {
  id: string;
  name: string;
  zone: string;
  position: LatLngExpression;
  type: "node" | "aggregator";
  temperature: number;
  humidity: number;
  light: number;
  pm25: number;
  pirMotion: boolean;
}

interface WebGISMapProps {
  stations: Station[];
  onStationClick: (station: Station) => void;
  selectedStation: Station | null;
  mapSettings: {
    darkMode: boolean;
    heatmapEnabled: boolean;
    showConnections: boolean;
    mapOpacity: number;
  };
}

// HÀM BẢO VỆ CHỐNG CRASH: Tách ra ngoài component tránh tạo lại mỗi render
const HP_CENTER: LatLngExpression = [20.733, 106.642];

const getSafePosition = (pos: any): LatLngExpression => {
  if (Array.isArray(pos) && pos.length === 2) {
    const lat = parseFloat(pos[0]);
    const lng = parseFloat(pos[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng] as LatLngExpression;
    }
  }
  return HP_CENTER;
};

export function WebGISMap({
  stations,
  onStationClick,
  selectedStation,
  mapSettings,
}: WebGISMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  // ← FIX RACE CONDITION: Dùng state để trigger re-render sau khi map khởi tạo xong
  const [mapReady, setMapReady] = useState(false);

  const center: LatLngExpression = HP_CENTER;

  // Khởi tạo khung bản đồ gốc (Chỉ chạy 1 lần)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 16,
      zoomControl: false,
    });

    tileLayerRef.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap & CARTO" },
    ).addTo(map);

    mapInstanceRef.current = map;
    // ← FIX: Báo hiệu map đã sẵn sàng để useEffect vẽ markers có thể chạy
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Động cơ vẽ lại Trạm mỗi khi MongoDB có biến động
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // XÓA LỚP LAYER CŨ BẰNG CÁCH TẠO MỚI (Chống lỗi chớp nháy của React)
    if (layerGroupRef.current) {
      mapInstanceRef.current.removeLayer(layerGroupRef.current);
    }
    const newLayerGroup = L.layerGroup().addTo(mapInstanceRef.current);
    layerGroupRef.current = newLayerGroup;

    if (tileLayerRef.current) {
      const mapUrl = mapSettings.darkMode
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      tileLayerRef.current.setUrl(mapUrl);
      tileLayerRef.current.setOpacity(mapSettings.mapOpacity / 100);
    }

    // Lọc bỏ trạm rác, chỉ giữ lại trạm hợp lệ từ Database
    const validStations = stations.filter(
      (s) => s.id && s.id.toLowerCase() !== "unknown",
    );

    // 1. VẼ ĐƯỜNG NỐI MẠNG (TOPOLOGY)
    if (mapSettings.showConnections) {
      const aggregators = validStations.filter((s) => s.type === "aggregator");
      const nodes = validStations.filter((s) => s.type === "node");
      nodes.forEach((node) => {
        const aggregator = aggregators.find((a) => a.zone === node.zone);
        if (aggregator) {
          const nodePos = getSafePosition(node.position);
          const aggPos = getSafePosition(aggregator.position);
          L.polyline([nodePos, aggPos], {
            color: mapSettings.darkMode ? "#06b6d4" : "#0369a1",
            weight: 2,
            opacity: 0.6,
            dashArray: "5, 10",
          }).addTo(newLayerGroup);
        }
      });
    }

    // 2. TỰ ĐỘNG VẼ HEATMAP (Trực tiếp từ danh sách Trạm trong MongoDB)
    if (mapSettings.heatmapEnabled) {
      validStations.forEach((station) => {
        const raw = station as any;
        const currentTemp = parseFloat(raw.temperature ?? raw.t) || 0;

        let zoneColor = "#10b981";
        let zoneOpacity = 0.15;

        if (currentTemp > 35.0) {
          zoneColor = "#ef4444";
          zoneOpacity = 0.35;
        } else if (currentTemp > 30.0) {
          zoneColor = "#f97316";
          zoneOpacity = 0.25;
        }

        const exactPosition = getSafePosition(station.position);

        L.circle(exactPosition, {
          radius: 300,
          fillColor: zoneColor,
          fillOpacity: zoneOpacity,
          color: zoneColor,
          weight: 1.5,
        }).addTo(newLayerGroup);
      });
    }

    // 3. VẼ GHIM TRẠM & POPUP THÔNG SỐ (Sử dụng Icon từ CDN)
    validStations.forEach((station) => {
      const raw = station as any;
      const tempVal = raw.temperature ?? raw.t ?? "--";
      const humVal = raw.humidity ?? raw.h ?? "--";
      const pm25Val = raw.pm25 ?? raw.p2 ?? raw.pm2_5 ?? "--";

      const numTemp = parseFloat(tempVal) || 0;
      const numPm25 = parseFloat(pm25Val) || 0;

      const isDanger = numTemp > 35 || numPm25 > 100 || station.pirMotion;
      const exactPosition = getSafePosition(station.position);

      L.circle(exactPosition, {
        radius: isDanger ? 80 : 40,
        fillColor: isDanger ? "#ef4444" : "#06b6d4",
        fillOpacity: 0.25,
        color: isDanger ? "#ef4444" : "#06b6d4",
        weight: 1,
      }).addTo(newLayerGroup);

      // Thêm customMarkerIcon vào đây để hiển thị ghim xanh chuẩn xác
      const marker = L.marker(exactPosition, { icon: customMarkerIcon }).addTo(
        newLayerGroup,
      );
      const popupContent = document.createElement("div");
      popupContent.className = "text-sm p-1";

      const stId = raw.id ? raw.id : "Trạm Mới";
      const stName = raw.name ? raw.name : stId;

      popupContent.innerHTML = `
        <div class="font-semibold text-gray-900 border-b border-gray-200 pb-1 mb-1">${stName}</div>
        <div class="text-xs text-gray-500 mb-2">Khu vực: <span class="font-medium text-gray-700">${station.zone || "Chưa phân vùng"}</span></div>
        <div class="space-y-1 text-xs text-gray-700">
          <div class="flex justify-between gap-4"><span>Nhiệt độ:</span> <span class="font-semibold">${tempVal}°C</span></div>
          <div class="flex justify-between gap-4"><span>Độ ẩm:</span> <span class="font-semibold">${humVal}%</span></div>
          <div class="flex justify-between gap-4"><span>PM2.5:</span> <span class="font-semibold ${numPm25 > 100 ? "text-red-500 font-bold" : ""}">${pm25Val} µg/m³</span></div>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.on("click", () =>
        onStationClick({ ...station, position: exactPosition }),
      );
    });
  }, [stations, onStationClick, mapSettings, mapReady]);

  // Hiệu ứng bay tới trạm khi click
  useEffect(() => {
    if (selectedStation && mapInstanceRef.current && selectedStation.position) {
      const safePos = getSafePosition(selectedStation.position);
      mapInstanceRef.current.flyTo(safePos, 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [selectedStation]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div
        className={`absolute bottom-4 left-4 ${
          mapSettings.darkMode
            ? "bg-gray-900/95 text-white"
            : "bg-white/95 text-gray-900"
        } border ${mapSettings.darkMode ? "border-gray-700" : "border-gray-200"} rounded-lg p-3 text-sm z-[1000] shadow-2xl backdrop-blur-sm`}
      >
        <div className="font-semibold mb-2 flex items-center gap-1.5 border-b pb-1 border-gray-700/50">
          <span>Chú giải Bản đồ GIS</span>
        </div>
        <div className="space-y-2">
          {mapSettings.heatmapEnabled && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500/50 border border-red-500"></div>
                <span>Nóng nguy hiểm ({`>`}35°C)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500/50 border border-orange-500"></div>
                <span>Cảnh báo mức vừa ({`>`}30°C)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/50 border border-emerald-500"></div>
                <span>Nhiệt độ ổn định (≤30°C)</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-cyan-500/50 border border-cyan-500"></div>
            <span>Phạm vi giám sát cận trạm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
