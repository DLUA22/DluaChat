import axios from 'axios';
import toast from 'react-hot-toast';

const instance = axios.create({
    baseURL: 'https://dlua-chat-api.onrender.com'
});

instance.interceptors.request.use(
    (config) => {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            // Ưu tiên lấy token
            const token = user.token || user.accessToken; 
            if (token) config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

instance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            const status = error.response.status;
            // 1. TOKEN HẾT HẠN (Do bạn setup chỉ sống 15 phút) -> ĐÁ VĂNG LUÔN, KHÔNG THA
            if (status === 401 || status === 403) {
                console.error("Token đã hết hạn 15 phút. Đang xử lý đăng xuất an toàn!");
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('/login'); // Dùng replace thay vì href để tránh lỗi 404
                return new Promise(() => {}); // Chặn không cho React render tiếp
            } 
            // 2. RENDER ĐANG NGỦ ĐÔNG / RESTART
            else if (status === 502 || status === 503) {
                toast.error("Máy chủ đang khởi động, vui lòng chờ khoảng 1 phút...");
            }
        } 
        // 3. XỬ LÝ LỖI MẠNG / CORS ẨN DANH
        else if (error.message === 'Network Error') {
            // Nếu chết ngay lúc gọi tin nhắn (99% là do Token chết mà bị CORS che)
            if (error.config?.url?.includes('/messages')) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('/login');
                return new Promise(() => {});
            } else {
                toast.error("Máy chủ chưa sẵn sàng, đang thử lại...");
            }
        }
        return Promise.reject(error);
    }
);

export default instance;