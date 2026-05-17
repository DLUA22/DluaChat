import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../axiosConfig';
import { motion } from 'framer-motion';

export default function Register() {
    const [formData, setFormData] = useState({ fullName: '', username: '', uniqueName: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axios.post('https://dlua-chat-api.onrender.com/api/auth/register', formData);
            setSuccess('Khởi tạo tài khoản thành công! Đang chuyển hướng...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra!');
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[#eaf4f4] w-full flex items-center justify-center font-['Be_Vietnam_Pro'] p-4">
            
            {/* HÌNH ẢNH NỀN: Tràn viền, nằm sau lớp kính */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <img 
                    src="/image.png" 
                    alt="Nature Background" 
                    className="w-full h-full object-cover object-center"
                />
            </div>

            {/* PHẦN FORM: Xếp chồng lên trên, hiệu ứng kính mờ (glassmorphism) */}
            <div className="w-full max-w-[400px] bg-white/70 p-8 sm:p-10 rounded-3xl backdrop-blur-sm shadow-xl z-10 relative">
                <h1 className="text-[32px] sm:text-[36px] font-bold text-[#142d2d] mb-8 text-center tracking-tight text-nowrap">
                    Bắt đầu ngay thôi!
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-500 text-sm italic font-medium text-center">{error}</p>}
                    {success && <p className="text-[#4b8282] text-sm font-bold text-center">{success}</p>}

                    <div className="space-y-1">
                        <input 
                            type="text" 
                            name="fullName" 
                            placeholder="Họ và tên (VD: Nguyễn Văn A)" 
                            required 
                            onChange={handleChange}
                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] outline-none focus:border-[#4b8282] focus:ring-2 focus:ring-[#4b8282]/20 transition-all text-slate-700 shadow-sm" 
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <input 
                            type="text" 
                            name="username" 
                            placeholder="Tên đăng nhập" 
                            required 
                            onChange={handleChange}
                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] outline-none focus:border-[#4b8282] focus:ring-2 focus:ring-[#4b8282]/20 transition-all text-slate-700 shadow-sm" 
                        />
                    </div>

                    <div className="space-y-1">
                        <input 
                            type="text" 
                            name="uniqueName" 
                            placeholder="ID định danh (VD: @dung_2k)" 
                            required 
                            onChange={handleChange}
                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] outline-none focus:border-[#4b8282] focus:ring-2 focus:ring-[#4b8282]/20 transition-all text-slate-700 shadow-sm" 
                        />
                    </div>

                   <div className="space-y-1 relative">
                        <input 
                            // 1. Đổi type ăn theo biến showPassword
                            type={showPassword ? "text" : "password"} 
                            name="password" 
                            placeholder="Mật khẩu (ít nhất 6 ký tự)" 
                            required minLength="6" 
                            onChange={handleChange}
                            // 2. Thêm pr-12 vào class
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

                    <button 
                        type="submit" 
                        className="w-full bg-[#142d2d] hover:bg-[#1f4242] active:scale-[0.98] text-white font-bold text-[15px] py-3.5 rounded-xl transition-all shadow-lg mt-8"
                    >
                        Khởi tạo tài khoản
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[14px] text-slate-500">
                        Đã có tài khoản? <Link to="/login" className="text-[#5c9898] hover:text-[#386262] font-semibold transition-all">Đăng nhập</Link>
                    </p>
                </div>
            </div>
        </motion.div>
    );
}