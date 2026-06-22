import axios from 'axios';

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
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            localStorage.clear();
            sessionStorage.clear();
            window.dispatchEvent(new Event('auth_expired'));
        }
        return Promise.reject(error);
    }
);

export default instance;