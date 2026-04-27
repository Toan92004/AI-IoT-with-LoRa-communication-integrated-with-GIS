import { useState } from 'react';
import { Brain, TrendingUp, AlertTriangle, Activity, Map as MapIcon, ShieldCheck, Zap } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend
} from 'recharts';
import { motion } from 'motion/react';

// Mock AI Prediction Data
const aiPredictionData = [
  { time: '00:00', riskScore: 12, anomalies: 0 },
  { time: '04:00', riskScore: 15, anomalies: 1 },
  { time: '08:00', riskScore: 25, anomalies: 3 },
  { time: '12:00', riskScore: 45, anomalies: 8 },
  { time: '16:00', riskScore: 78, anomalies: 15 },
  { time: '20:00', riskScore: 60, anomalies: 6 },
  { time: '24:00', riskScore: 30, anomalies: 2 },
];

const maintenanceData = [
  { name: 'Node-001', health: 95 },
  { name: 'Node-002', health: 80 },
  { name: 'Node-003', health: 45 },
  { name: 'Agg-001', health: 90 },
  { name: 'Agg-002', health: 85 },
];

export function AIAnalytics() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  return (
    <div className="h-full w-full bg-gray-950 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
              <Brain className="text-purple-500" />
              AI Analytics & Prediction
            </h1>
            <p className="text-gray-400">
              Phân tích dữ liệu lớn và dự báo rủi ro hệ thống bằng Trí tuệ nhân tạo.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 p-1 rounded-lg">
            {(['24h', '7d', '30d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range 
                    ? 'bg-purple-600/20 text-purple-400 shadow-sm border border-purple-500/30' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {range === '24h' ? '24 Giờ' : range === '7d' ? '7 Ngày' : '30 Ngày'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: 'Chỉ số rủi ro (Risk Score)', value: '78/100', icon: <TrendingUp size={24} className="text-red-500" />, trend: '+15%', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
            { title: 'Độ chính xác dự báo', value: '94.2%', icon: <ShieldCheck size={24} className="text-green-500" />, trend: '+2.1%', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
            { title: 'Sự cố đã ngăn chặn', value: '1,245', icon: <AlertTriangle size={24} className="text-orange-500" />, trend: '+124', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
            { title: 'Hiệu suất năng lượng', value: '88%', icon: <Zap size={24} className="text-cyan-500" />, trend: '-5%', color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/20' },
          ].map((stat, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>{stat.icon}</div>
                <span className={`text-sm font-semibold flex items-center ${stat.color}`}>
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">{stat.title}</h3>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Activity className="text-purple-500" size={20} />
              Dự báo mức độ rủi ro & Bất thường
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aiPredictionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="time" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" name="Mức độ rủi ro (%)" dataKey="riskScore" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisk)" strokeWidth={2} />
                  <Area type="monotone" name="Số lượng bất thường" dataKey="anomalies" stroke="#a855f7" fillOpacity={1} fill="url(#colorAnomalies)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Predictive Maintenance */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Wrench className="text-orange-500" size={20} />
              Bảo trì dự đoán (Sức khỏe thiết bị)
            </h3>
            <div className="space-y-4">
              {maintenanceData.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="text-gray-300 font-medium">{item.name}</span>
                    <span className={`font-bold ${
                      item.health < 50 ? 'text-red-500' : item.health < 85 ? 'text-yellow-500' : 'text-green-500'
                    }`}>{item.health}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.health}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className={`h-full rounded-full ${
                        item.health < 50 ? 'bg-red-500' : item.health < 85 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    ></motion.div>
                  </div>
                  {item.health < 50 && (
                    <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Đề xuất thay thế linh kiện (Pin yếu)
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button className="w-full mt-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors border border-gray-700 flex items-center justify-center gap-2">
              <Brain size={16} />
              Chạy chuẩn đoán toàn diện
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick Wrench icon definition since it wasn't imported initially
const Wrench = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);