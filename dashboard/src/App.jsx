import React from 'react';
import Dashboard from './components/Dashboard';
import { motion } from 'framer-motion';

function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white selection:bg-blue-500 selection:text-white">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-600/20 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-600/20 rounded-full blur-[100px]"
        />
      </div>

      <div className="relative z-10">
        <Dashboard />
      </div>
    </div>
  );
}

export default App;
