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
  // NHẬN PROP TỪ SETTINGS
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

  // Lưu trữ lớp TileLayer để thay đổi Dark/Light mode động
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [heatmapZones] = useState([
    {
      position: [10.776, 106.701] as LatLngExpression,
      radius: 150,
      intensity: 0.85,
    },
    {
      position: [10.773, 106.705] as LatLngExpression,
      radius: 120,
      intensity: 0.65,
    },
    {
      position: [10.771, 106.698] as LatLngExpression,
      radius: 100,
      intensity: 0.75,
    },
  ]);

  const center: LatLngExpression = [10.775, 106.7];

  // KHỞI TẠO BẢN ĐỒ (Chỉ chạy 1 lần)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
    });

    // Lưu tileLayer vào Ref
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

  // CẬP NHẬT CÁC LỚP HIỂN THỊ (Chạy khi có thay đổi từ Settings hoặc Stations)
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

    // 2. Vẽ đường nối nếu được bật trong Settings
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

    // 3. Vẽ AI Heatmap nếu được bật
    if (mapSettings.heatmapEnabled) {
      heatmapZones.forEach((zone) => {
        L.circleMarker(zone.position, {
          radius: zone.radius,
          fillColor: zone.intensity > 0.7 ? "#ef4444" : "#f97316",
          fillOpacity: zone.intensity * 0.4,
          color: zone.intensity > 0.7 ? "#ef4444" : "#f97316",
          weight: 1,
        }).addTo(layerGroup);
      });
    }

    // 4. Vẽ Marker và vòng tròn nhấp nháy cho Trạm
    stations.forEach((station) => {
      const isDanger =
        station.temperature > 35 || station.pm25 > 100 || station.pirMotion;
      L.circleMarker(station.position, {
        radius: 15,
        fillColor: isDanger ? "#ef4444" : "#06b6d4",
        fillOpacity: 0.6,
        color: isDanger ? "#ef4444" : "#06b6d4",
        weight: 2,
      }).addTo(layerGroup);

      const marker = L.marker(station.position).addTo(layerGroup);
      const popupContent = document.createElement("div");
      popupContent.className = "text-sm";
      popupContent.innerHTML = `
        <div class="font-semibold text-gray-900">${station.name}</div>
        <div class="text-gray-600">${station.zone}</div>
        <div class="mt-2 text-xs">
          <div>Nhiệt độ: ${station.temperature}°C</div>
          <div>Độ ẩm: ${station.humidity}%</div>
          <div>PM2.5: ${station.pm25} µg/m³</div>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.on("click", () => onStationClick(station));
    });
  }, [stations, heatmapZones, onStationClick, mapSettings]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Legend */}
      <div
        className={`absolute bottom-4 left-4 ${mapSettings.darkMode ? "bg-gray-900/90 text-white" : "bg-white/90 text-gray-900"} border border-gray-700 rounded-lg p-3 text-sm z-[1000] shadow-xl`}
      >
        <div className="font-semibold mb-2">Chú giải Bản đồ GIS</div>
        <div className="space-y-1">
          {mapSettings.heatmapEnabled && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span>Nguy cơ cao ({`>`} 70%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span>Nguy cơ trung bình</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-cyan-500"></div>
            <span>Trạm LoRa</span>
          </div>
          {mapSettings.showConnections && (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-0.5 bg-cyan-500"
                style={{ borderTop: "2px dashed" }}
              ></div>
              <span>Kết nối LoRa Topology</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
