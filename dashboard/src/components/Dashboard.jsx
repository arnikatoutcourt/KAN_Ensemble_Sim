import React, { useState, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import ConfigPanel from './ConfigPanel';
import StockCard from './StockCard';

const Dashboard = () => {
    const [tickers, setTickers] = useState([]);
    const [stockData, setStockData] = useState({}); // { ticker: [data points] }
    const [stockStatus, setStockStatus] = useState({}); // { ticker: "status message" }
    const [stockLogs, setStockLogs] = useState({}); // { ticker: ["log1", "log2"] }

    const { sendMessage, lastMessage, readyState } = useWebSocket('ws://localhost:8000/ws/simulate', {
        shouldReconnect: (closeEvent) => true,
    });

    useEffect(() => {
        if (lastMessage !== null) {
            const msg = JSON.parse(lastMessage.data);
            handleMessage(msg);
        }
    }, [lastMessage]);

    const handleMessage = (msg) => {
        const { type, ticker } = msg;

        if (type === 'status') {
            setStockStatus(prev => ({ ...prev, [ticker]: msg.message }));
        } else if (type === 'log') {
            setStockLogs(prev => ({
                ...prev,
                [ticker]: [...(prev[ticker] || []), msg.message]
            }));
        } else if (type === 'error') {
            setStockStatus(prev => ({ ...prev, [ticker]: `Error: ${msg.message}` }));
        } else if (type === 'data') {
            setStockData(prev => {
                const current = prev[ticker] || [];
                // Keep only last 50 points for performance if needed, or all
                return { ...prev, [ticker]: [...current, msg] };
            });

            // Add to tickers list if not present (dynamic discovery)
            if (!tickers.includes(ticker)) {
                setTickers(prev => [...prev, ticker]);
            }
        }
    };

    const handleRun = () => {
        // Reset data
        setStockData({});
        setStockStatus({});
        setStockLogs({});
        setTickers([]); // Will be repopulated

        sendMessage(JSON.stringify({ action: 'start' }));
    };

    const handleReset = () => {
        setStockData({});
        setStockStatus({});
        setStockLogs({});
        setTickers([]);
    };

    // Calculate Global Stats
    const activeTickers = tickers.length;
    const totalPoints = Object.values(stockData).reduce((acc, curr) => acc + curr.length, 0);
    const avgError = Object.values(stockData).reduce((acc, curr) => {
        if (curr.length === 0) return acc;
        const last = curr[curr.length - 1];
        if (!last.actual) return acc;
        const err = Math.abs((last.adaptive - last.actual) / last.actual) * 100;
        return acc + err;
    }, 0) / (activeTickers || 1);

    return (
        <div className="min-h-screen p-6">
            <ConfigPanel onRun={handleRun} onReset={handleReset} />

            <header className="mb-8 flex flex-col md:flex-row justify-between items-end">
                <div>
                    <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-lg">
                        KAN Ensemble
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg font-light tracking-wide">Real-time Adaptive Prediction System</p>
                </div>

                {/* Global Stats Bar */}
                <div className="flex gap-6 mt-4 md:mt-0">
                    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-3 px-6 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Activity size={20} /></div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold">Active</div>
                            <div className="text-xl font-mono font-bold">{activeTickers}</div>
                        </div>
                    </div>
                    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-3 px-6 flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Zap size={20} /></div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold">Points</div>
                            <div className="text-xl font-mono font-bold">{totalPoints}</div>
                        </div>
                    </div>
                    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-3 px-6 flex items-center gap-3">
                        <div className="p-2 bg-pink-500/20 rounded-lg text-pink-400"><TrendingUp size={20} /></div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold">Avg MAPE</div>
                            <div className="text-xl font-mono font-bold">{avgError.toFixed(2)}%</div>
                        </div>
                    </div>
                </div>
            </header>

            <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                <AnimatePresence>
                    {tickers.map(ticker => (
                        <StockCard
                            key={ticker}
                            ticker={ticker}
                            data={stockData[ticker] || []}
                            status={stockStatus[ticker]}
                            logs={stockLogs[ticker] || []}
                        />
                    ))}
                </AnimatePresence>

                {tickers.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 bg-slate-900/20 backdrop-blur-sm"
                    >
                        <Zap size={48} className="mb-4 opacity-50" />
                        <p className="text-xl font-light">System Idle</p>
                        <p className="text-sm mt-2">Configure and run a simulation to begin</p>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default Dashboard;
