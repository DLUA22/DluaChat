import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from '../axiosConfig';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function SSOAuth() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const appName = searchParams.get('app_name') || 'Một ứng dụng liên kết';
    const redirectUri = searchParams.get('redirect_uri');

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        if (!loggedInUser) {
            const currentUrl = window.location.pathname + window.location.search;
            toast.error("Vui lòng đăng nhập DluaChat trước!");
            navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`);
        } else {
            setUser(JSON.parse(loggedInUser));
        }

        if (!redirectUri) {
            toast.error("Lỗi: Không tìm thấy đường dẫn trả về (redirect_uri)!");
        }
    }, [navigate, searchParams, redirectUri]);

    const handleAccept = async () => {
        if (!redirectUri) return;
        setIsLoading(true);
        const loadingToast = toast.loading("Đang ủy quyền...");

        try {
            const res = await axios.post('https://dlua-chat-api.onrender.com/api/auth/sso-authorize', {
                userId: user.id,
                appName: appName,
                redirectUri: redirectUri
            });
            
            toast.success("Kết nối thành công! Đang chuyển hướng...", { id: loadingToast });
            
            setTimeout(() => {
                window.location.href = res.data.redirectUrl;
            }, 1000);

        } catch (err) {
            toast.error("Lỗi xác thực. Vui lòng thử lại!", { id: loadingToast });
            setIsLoading(false);
        }
    };

    const handleDeny = () => {
        window.location.href = 'https://dlua-chat.vercel.app'; 
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#f0f4f8] dark:bg-slate-900 flex items-center justify-center p-4 font-['Be_Vietnam_Pro']">
            <Toaster position="top-center" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 max-w-md w-full rounded-[32px] p-8 shadow-2xl border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden">
                
                {/* Hiệu ứng Background đã được kéo dài và làm mờ dần để không bị cắt ngang */}
                <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-blue-500/20 to-transparent z-0 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col items-center mt-4">
                    {/* Tăng khoảng cách mb-8 để tách biệt hẳn với text bên dưới */}
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-500/30">D</div>
                        <i className="ri-arrow-left-right-line text-2xl text-slate-400 animate-pulse"></i>
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-3xl font-black shadow-md"><i className="ri-apps-fill"></i></div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Yêu cầu truy cập</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 px-2">
                        <strong className="text-blue-500">{appName}</strong> đang muốn truy cập vào tài khoản DluaChat của bạn để đăng nhập.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900 w-full p-4 rounded-2xl text-left border border-slate-100 dark:border-slate-700 mb-8">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sẽ chia sẻ thông tin:</p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 overflow-hidden shadow-sm">
                                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.fullName[0]}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight">{user.fullName}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{user.email || user.uniqueName}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col w-full gap-3">
                        <button onClick={handleAccept} disabled={isLoading || !redirectUri} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95">
                            {isLoading ? <i className="ri-loader-4-line animate-spin text-xl"></i> : "Cho phép đăng nhập"}
                        </button>
                        <button onClick={handleDeny} disabled={isLoading} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 py-3.5 rounded-xl font-bold transition-all active:scale-95">
                            Hủy bỏ
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}