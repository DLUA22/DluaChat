import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function SplashScreen({ onFinish }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onFinish();
        }, 2500);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)" }} // Hiệu ứng mờ dần khi tắt
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a192f] overflow-hidden"
        >
            {/* 1. HIỆU ỨNG ÁNH SÁNG NỀN (GLOWING ÁNH SÁNG) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-500/20 rounded-full blur-[80px] animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 bg-emerald-500/20 rounded-full blur-[60px] translate-x-10 -translate-y-10"></div>

            {/* 2. LOGO VÀ CHỮ CHUYỂN ĐỘNG */}
            <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
                className="relative z-10 flex flex-col items-center"
            >
                {/* Khối Logo lơ lửng (Floating) */}
                <motion.div 
                    animate={{ y: [0, -12, 0] }} 
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="relative"
                >
                    {/* BẠN NHỚ SỬA TÊN FILE ẢNH Ở ĐÂY NẾU CẦN NHÉ */}
                    <img 
                        src="/logo.png" 
                        alt="DluaChat Logo" 
                        className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]" 
                    />
                </motion.div>

                {/* Chữ DluaChat rớt xuống mượt mà */}
                <motion.h1 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="mt-6 text-4xl md:text-5xl font-black text-white tracking-tight"
                >
                    Dlua<span className="text-blue-500 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Chat</span>
                </motion.h1>

                {/* Slogan hiện lên từ từ */}
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="mt-3 text-slate-400 text-[11px] md:text-xs font-bold tracking-[0.3em] uppercase"
                >
                    Kết nối riêng tư
                </motion.p>
            </motion.div>

            {/* 3. VÒNG QUAY LOADING PHÍA DƯỚI */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="absolute bottom-12 flex flex-col items-center gap-2"
            >
                <div className="w-7 h-7 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
            </motion.div>
        </motion.div>
    );
}