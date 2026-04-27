import { motion } from 'motion/react';

interface StationGaugeProps {
  label: string;
  value: number;
  unit: string;
  max: number;
  color: string;
  isDanger?: boolean;
}

export function StationGauge({ label, value, unit, max, color, isDanger }: StationGaugeProps) {
  const percentage = (value / max) * 100;
  const rotation = (percentage / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-12">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 45 A 40 40 0 0 1 90 45"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <motion.path
            d="M 10 45 A 40 40 0 0 1 90 45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="126"
            strokeDashoffset={126 - (126 * percentage) / 100}
            initial={{ strokeDashoffset: 126 }}
            animate={{ strokeDashoffset: 126 - (126 * percentage) / 100 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          {/* Needle */}
          <motion.line
            x1="50"
            y1="45"
            x2="50"
            y2="15"
            stroke={isDanger ? "#ef4444" : "#fff"}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ rotate: -90 }}
            animate={{ rotate: rotation }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ transformOrigin: "50px 45px" }}
          />
          {/* Center dot */}
          <circle cx="50" cy="45" r="3" fill={isDanger ? "#ef4444" : "#fff"} />
        </svg>
      </div>
      <div className="text-center">
        <motion.div 
          className={`text-lg ${isDanger ? 'text-red-500' : 'text-white'}`}
          animate={isDanger ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {value}{unit}
        </motion.div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  );
}
