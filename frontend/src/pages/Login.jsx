import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function Login() {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('https://dlua-chat-api.onrender.com/api/auth/login', formData);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            // Đã thêm { replace: true } để chặn lùi trang (Back)
            navigate('/', { replace: true }); 
        } catch (err) {
            setError(err.response?.data?.message || 'Thông tin không chính xác!');
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[#eaf4f4] w-full flex items-center justify-center font-['Be_Vietnam_Pro'] p-4">
            
            {/* HÌNH ẢNH NỀN: Được ẩn đằng sau toàn bộ giao diện */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <img 
                    src="/image.png" 
                    alt="Nature Background" 
                    className="w-full h-full object-cover object-center"
                />
            </div>

            {/* PHẦN FORM: Xếp chồng lên trên hình ảnh nền, được định tâm */}
            <div className="w-full max-w-[400px] bg-white/70 p-10 rounded-3xl backdrop-blur-sm shadow-xl z-10 relative">
                <h1 className="text-[40px] md:text-[44px] font-bold text-[#142d2d] mb-10 text-center tracking-tight">
                    Đăng nhập
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-500 text-sm italic font-medium text-center">{error}</p>}
                    
                    <div className="space-y-1">
                        <input 
                            type="text" 
                            name="username"
                            placeholder="Tên đăng nhập" 
                            required 
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] outline-none focus:border-[#4b8282] focus:ring-2 focus:ring-[#4b8282]/20 transition-all text-slate-700 shadow-sm"
                        />
                    </div>
                    
                    <div className="space-y-1 relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            name="password"
                            placeholder="Mật khẩu" 
                            required 
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-5 py-3.5 pr-12 text-[15px] outline-none focus:border-[#4b8282] focus:ring-2 focus:ring-[#4b8282]/20 transition-all text-slate-700 shadow-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4b8282] transition-colors text-xl flex items-center justify-center focus:outline-none"
                        >
                            <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                        </button>
                    </div>

                    <div className="text-right mt-2">
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-[#142d2d] hover:bg-[#1f4242] active:scale-[0.98] text-white font-bold text-[15px] py-3.5 rounded-xl transition-all shadow-lg mt-8"
                    >
                        Đăng nhập ngay
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[14px] text-slate-500">
                        Chưa có tài khoản? <Link to="/register" className="text-[#5c9898] hover:text-[#386262] font-semibold transition-all">Đăng ký</Link>
                    </p>
                </div>
            </div>
        </motion.div>
    );
}