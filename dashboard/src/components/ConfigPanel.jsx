import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, Play, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ConfigPanel = ({ onRun, onReset }) => {
    const [config, setConfig] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await axios.get('http://localhost:8000/config');
            setConfig(res.data);
        } catch (err) {
            console.error("Failed to fetch config", err);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/config', {
                domain: config.data.domain,
                count: parseInt(config.data.count),
                lookback: parseInt(config.data.lookback),
                start_date: config.data.start_date,
                end_date: config.data.end_date,
                epochs: parseInt(config.training.epochs),
                learning_rate: parseFloat(config.training.learning_rate),
                sleep: parseFloat(config.training.sleep || 0.1),
                volatility_threshold: parseFloat(config.volatility.threshold)
            });
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to save config", err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (section, key, value) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    if (!config) return null;

    return (
        <>
            <div className="fixed top-6 right-6 z-50 flex gap-3">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onRun}
                    className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full shadow-lg shadow-green-500/20 transition-all"
                    title="Run Simulation"
                >
                    <Play size={20} fill="currentColor" />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onReset}
                    className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg shadow-red-500/20 transition-all"
                    title="Reset"
                >
                    <RotateCcw size={20} />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full shadow-lg border border-slate-600 transition-all"
                >
                    <Settings size={20} />
                </motion.button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-6 overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold text-white">Configuration</h2>
                                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-8">
                                {/* Data Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-blue-400 border-b border-slate-800 pb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Data Settings</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-slate-400 text-sm mb-1">Domain</label>
                                            <input
                                                type="text"
                                                value={config.data.domain}
                                                onChange={(e) => handleChange('data', 'domain', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-slate-400 text-sm mb-1">Count</label>
                                                <input
                                                    type="number"
                                                    value={config.data.count}
                                                    onChange={(e) => handleChange('data', 'count', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-slate-400 text-sm mb-1">Lookback</label>
                                                <input
                                                    type="number"
                                                    value={config.data.lookback}
                                                    onChange={(e) => handleChange('data', 'lookback', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Training Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-purple-400 border-b border-slate-800 pb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Model Training</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-slate-400 text-sm mb-1">Epochs</label>
                                            <input
                                                type="number"
                                                value={config.training.epochs}
                                                onChange={(e) => handleChange('training', 'epochs', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-sm mb-1">Sleep (s)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={config.training.sleep || 0.1}
                                                onChange={(e) => handleChange('training', 'sleep', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Volatility Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-pink-400 border-b border-slate-800 pb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Volatility Control</span>
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-sm mb-1">Threshold</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="range"
                                                min="0" max="1" step="0.05"
                                                value={config.volatility.threshold}
                                                onChange={(e) => handleChange('volatility', 'threshold', e.target.value)}
                                                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                            />
                                            <span className="text-white font-mono w-12 text-right">{(config.volatility.threshold * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-slate-800">
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    {loading ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default ConfigPanel;
