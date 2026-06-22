import axios from 'axios';
import toast from 'react-hot-toast'; // Phải import cái này để hiện thông báo

const instance = axios.create({
    baseURL: 'https://dlua-chat-api.onrender.com'
});

instance.interceptors.request.use(
    (config) => {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const token = user.token || user.accessToken; 
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

instance.interceptors.response.use(
    (response) => response,
    (error) => {
        // 1. LỖI MẠNG HOẶC SERVER ĐANG NGỦ / ĐANG BUILD (RENDER)
        if (!error.response) {
            toast.error("Đang kết nối lại Server. Vui lòng đợi chút nhé...", { id: 'network_err', duration: 4000 });
        } 
        // 2. LỖI SERVER ĐANG BẢO TRÌ (502, 503...)
        else if (error.response.status >= 500) {
            toast.error("Hệ thống đang cập nhật. Vui lòng thử lại sau 1-2 phút!", { id: 'server_err', duration: 4000 });
        }
        // 3. LỖI TOKEN HẾT HẠN (401, 403) -> ĐÁ VỀ ĐĂNG NHẬP
        else if (error.response.status === 401 || error.response.status === 403) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/login';
        }
        
        return Promise.reject(error);
    }
);

export default instance;