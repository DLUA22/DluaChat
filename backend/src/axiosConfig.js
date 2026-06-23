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
            if (status === 401 || status === 403) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
            } 
            else if (status === 502 || status === 503) {
                toast.error("Máy chủ đang khởi động, vui lòng chờ...");
            }
        } 
        else if (error.message === 'Network Error') {
            if (error.config.url.includes('/messages')) {
                console.warn("Phát hiện Token hết hạn ẩn, tự động làm sạch...");
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
            } else {
                toast.error("Đang kết nối lại với máy chủ...");
            }
        }
        return Promise.reject(error);
    }
);

export default instance;