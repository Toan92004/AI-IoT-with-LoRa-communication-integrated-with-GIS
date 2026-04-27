import { X, AlertTriangle } from 'lucide-react';
import { StationGauge } from './StationGauge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';

interface StationInfoCardProps {
  station: {
    id: string;
    name: string;
    zone: string;
    temperature: number;
    humidity: number;
    light: number;
    pm25: number;
    pirMotion: boolean;
    history: Array<{ time: string; temp: number; humidity: number; pm25: number }>;
  };
  onClose: () => void;
}

export function StationInfoCard({ station, onClose }: StationInfoCardProps) {
  const isDanger = station.temperature > 35 || station.pm25 > 100 || station.pirMotion;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute top-20 right-4 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className={`p-4 ${isDanger ? 'bg-red-900/50' : 'bg-gray-800'} border-b border-gray-700 flex justify-between items-start`}>
        <div>
          <h3 className="text-white font-semibold">{station.name}</h3>
          <p className="text-sm text-gray-400">{station.zone}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Danger Alert */}
      {isDanger && (
        <motion.div
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="p-3 bg-red-500/20 border-b border-red-500/30 flex items-center gap-2"
        >
          <AlertTriangle className="text-red-500" size={20} />
          <span className="text-red-400 text-sm">
            {station.temperature > 35 && 'NGUY CƠ CHÁY - Nhiệt độ cao! '}
            {station.pm25 > 100 && 'Ô NHIỄM NẶNG - PM2.5 cao! '}
            {station.pirMotion && 'Phát hiện xâm nhập!'}
          </span>
        </motion.div>
      )}

      {/* Gauges */}
      <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-700">
        <StationGauge
          label="Nhiệt độ"
          value={station.temperature}
          unit="°C"
          max={60}
          color={station.temperature > 35 ? "#ef4444" : "#06b6d4"}
          isDanger={station.temperature > 35}
        />
        <StationGauge
          label="Độ ẩm"
          value={station.humidity}
          unit="%"
          max={100}
          color="#06b6d4"
        />
        <StationGauge
          label="Ánh sáng"
          value={station.light}
          unit="lx"
          max={1000}
          color="#06b6d4"
        />
        <StationGauge
          label="PM2.5"
          value={station.pm25}
          unit="µg/m³"
          max={300}
          color={station.pm25 > 100 ? "#ef4444" : station.pm25 > 50 ? "#eab308" : "#22c55e"}
          isDanger={station.pm25 > 100}
        />
      </div>

      {/* PIR Status */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Cảm biến PIR</span>
          <motion.span
            animate={station.pirMotion ? { opacity: [1, 0.5, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            className={`px-3 py-1 rounded text-xs ${
              station.pirMotion
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}
          >
            {station.pirMotion ? 'CÓ CHUYỂN ĐỘNG' : 'Bình thường'}
          </motion.span>
        </div>
      </div>

      {/* 24h Chart */}
      <div className="p-4">
        <h4 className="text-sm text-gray-400 mb-3">Biểu đồ 24 giờ</h4>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={station.history}>
            <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#374151" />
            <XAxis key="xaxis" dataKey="time" stroke="#9ca3af" style={{ fontSize: 10 }} />
            <YAxis key="yaxis" stroke="#9ca3af" style={{ fontSize: 10 }} />
            <Tooltip
              key="tooltip"
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#fff',
              }}
            />
            <Line
              key="line-temp"
              type="monotone"
              dataKey="temp"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="Nhiệt độ (°C)"
            />
            <Line
              key="line-humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              name="Độ ẩm (%)"
            />
            <Line
              key="line-pm25"
              type="monotone"
              dataKey="pm25"
              stroke="#eab308"
              strokeWidth={2}
              dot={false}
              name="PM2.5 (µg/m³)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
