import { useEffect, useState, useRef } from "react";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "motion/react";
import { Radio, AlertTriangle } from "lucide-react";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
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

  // Giữ nguyên dữ liệu AI Heatmap tọa độ khu vực TP.HCM ban đầu của bạn
  const [heatmapZones] = useState([
    {
      position: [10.776, 106.701] as LatLngExpression,
      radius: 350, // Đổi sang đơn vị MÉT (Phù hợp với tầm phủ từ 100m - 500m)
      intensity: 0.85,
    },
    {
      position: [10.773, 106.705] as LatLngExpression,
      radius: 300,
      intensity: 0.65,
    },
    {
      position: [10.771, 106.698] as LatLngExpression,
      radius: 250,
      intensity: 0.75,
    },
  ]);

  const center: LatLngExpression = [10.775, 106.7];

  // KHỞI TẠO BẢN ĐỒ (Chỉ chạy 1 lần)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 14, // Tăng nhẹ zoom ban đầu để nhìn rõ các trạm ở TP.HCM hơn
      zoomControl: false,
    });

    tileLayerRef.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap & CARTO",
      },
    ).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // CẬP NHẬT CÁC LỚP HIỂN THỊ CHI TIẾT
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1. Áp dụng Cài đặt Dark/Light Mode và Độ mờ
    if (tileLayerRef.current) {
      const mapUrl = mapSettings.darkMode
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      tileLayerRef.current.setUrl(mapUrl);
      tileLayerRef.current.setOpacity(mapSettings.mapOpacity / 100);
    }

    // 2. Vẽ đường nối giữa các Node và Aggregator trong cùng Zone
    if (mapSettings.showConnections) {
      const aggregators = stations.filter((s) => s.type === "aggregator");
      const nodes = stations.filter((s) => s.type === "node");
      nodes.forEach((node) => {
        const aggregator = aggregators.find((a) => a.zone === node.zone);
        if (aggregator) {
          L.polyline(
            [
              node.position as L.LatLngTuple,
              aggregator.position as L.LatLngTuple,
            ],
            {
              color: mapSettings.darkMode ? "#06b6d4" : "#0369a1",
              weight: 2,
              opacity: 0.6,
              dashArray: "5, 10",
            },
          ).addTo(layerGroup);
        }
      });
    }

    // 3. TỐI ƯU: Vẽ AI Heatmap sử dụng L.circle (Tính theo Mét địa lý)
    if (mapSettings.heatmapEnabled) {
      heatmapZones.forEach((zone) => {
        L.circle(zone.position, {
          radius: zone.radius, // Bán kính tính bằng Mét, sẽ tự co giãn khi zoom bản đồ
          fillColor: zone.intensity > 0.7 ? "#ef4444" : "#f97316",
          fillOpacity: zone.intensity * 0.35,
          color: zone.intensity > 0.7 ? "#ef4444" : "#f97316",
          weight: 1.5,
        }).addTo(layerGroup);
      });
    }

    // 4. Vẽ Trạm & Tối ưu hóa vòng cảnh báo xung quanh Trạm
    stations.forEach((station) => {
      const isDanger =
        station.temperature > 35 || station.pm25 > 100 || station.pirMotion;

      // Vòng tròn cảnh báo quanh trạm (được đổi sang L.circle để cố định theo phạm vi mét thực tế)
      L.circle(station.position, {
        radius: isDanger ? 80 : 40, // 80 mét nếu nguy hiểm, 40 mét nếu an toàn
        fillColor: isDanger ? "#ef4444" : "#06b6d4",
        fillOpacity: 0.25,
        color: isDanger ? "#ef4444" : "#06b6d4",
        weight: 1,
      }).addTo(layerGroup);

      // Marker ghim vị trí chính xác của Trạm
      const marker = L.marker(station.position).addTo(layerGroup);
      const popupContent = document.createElement("div");
      popupContent.className = "text-sm p-1";
      popupContent.innerHTML = `
        <div class="font-semibold text-gray-900 border-b border-gray-200 pb-1 mb-1">${station.name}</div>
        <div class="text-xs text-gray-500 mb-2">Khu vực: <span class="font-medium text-gray-700">${station.zone}</span></div>
        <div class="space-y-1 text-xs text-gray-700">
          <div class="flex justify-between gap-4"><span>Nhiệt độ:</span> <span class="font-semibold">${station.temperature}°C</span></div>
          <div class="flex justify-between gap-4"><span>Độ ẩm:</span> <span class="font-semibold">${station.humidity}%</span></div>
          <div class="flex justify-between gap-4"><span>PM2.5:</span> <span class="font-semibold ${station.pm25 > 100 ? "text-red-500 font-bold" : ""}">${station.pm25} µg/m³</span></div>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.on("click", () => onStationClick(station));
    });
  }, [stations, heatmapZones, onStationClick, mapSettings]);

  // TỰ ĐỘNG FLY TO (PAN) ĐẾN TRẠM ĐƯỢC CHỌN TỪ SIDEBAR HOẶC MANAGEMENT
  useEffect(() => {
    if (selectedStation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(selectedStation.position, 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [selectedStation]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Chú giải (Legend) */}
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
                <span>Khu vực nguy cơ cao ({`>`}70%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500/50 border border-orange-500"></div>
                <span>Khu vực nguy cơ trung bình</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-cyan-500/50 border border-cyan-500"></div>
            <span>Phạm vi phủ sóng LoRa Node</span>
          </div>
          {mapSettings.showConnections && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-t-2 border-dashed border-cyan-500"></div>
              <span>Kết nối LoRa Topology</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
