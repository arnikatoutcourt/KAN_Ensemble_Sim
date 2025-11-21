import React, { useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { motion } from 'framer-motion';
import { Eye, BarChart2 } from 'lucide-react';

const StockCard = ({ ticker, data, status, logs }) => {
  const [view, setView] = useState('prediction'); // 'prediction' or 'weights'
  const latest = data[data.length - 1] || {};
  const error = latest.actual && latest.adaptive ? latest.adaptive - latest.actual : 0;
  const errorPct = latest.actual ? (error / latest.actual) * 100 : 0;

  // Prepare weights data for Stacked Area Chart
  const weightsData = data.map(d => {
    const w = {};
    if (d.weights) {
      d.weights.forEach((val, idx) => {
        w[`model_${idx}`] = val;
      });
    }
    return { ...d, ...w };
  });

  const numModels = latest.weights ? latest.weights.length : 0;
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 flex flex-col h-[450px] shadow-2xl relative overflow-hidden group"
    >
      {/* Gradient Glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />

      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="text-3xl font-black text-white tracking-tight">{ticker}</h3>
          <p className="text-slate-400 text-xs font-mono uppercase tracking-wider mt-1">{status || 'Idle'}</p>
        </div>
        {latest.actual && (
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-white">${latest.actual.toFixed(2)}</div>
            <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block mt-1 ${Math.abs(errorPct) < 1 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {errorPct > 0 ? '+' : ''}{errorPct.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-slate-800/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setView('prediction')}
          className={`p-2 rounded-md transition-all ${view === 'prediction' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          title="Prediction View"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={() => setView('weights')}
          className={`p-2 rounded-md transition-all ${view === 'weights' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          title="Weights View"
        >
          <BarChart2 size={16} />
        </button>
      </div>

      <div className="flex-1 w-full min-h-0 z-10">
        <ResponsiveContainer width="100%" height="100%">
          {view === 'prediction' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorAdaptive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Area
                type="monotone"
                dataKey="adaptive"
                stroke="#ef4444"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAdaptive)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#f8fafc"
                strokeWidth={2}
                dot={false}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />
              {/* Current Prediction Dot */}
              {latest.adaptive && (
                <ReferenceDot x={latest.date} y={latest.adaptive} r={6} fill="#ef4444" stroke="white" strokeWidth={2} />
              )}
            </AreaChart>
          ) : (
            <AreaChart data={weightsData} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis stroke="#475569" tick={{ fontSize: 10 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px' }}
              />
              {Array.from({ length: numModels }).map((_, i) => (
                <Area
                  key={i}
                  type="monotone"
                  dataKey={`model_${i}`}
                  stackId="1"
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.6}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Logs / Weights Mini View */}
      <div className="mt-3 h-20 overflow-y-auto text-[10px] font-mono text-slate-500 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
        {logs.slice().reverse().map((log, i) => (
          <div key={i} className="mb-1 border-b border-slate-800/50 pb-1 last:border-0">{log}</div>
        ))}
      </div>
    </motion.div>
  );
};

export default StockCard;
