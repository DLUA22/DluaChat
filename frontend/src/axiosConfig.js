import axios from '../axiosConfig';

const api = axios.create({
    baseURL: 'https://dlua-chat-api.onrender.com'
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// Bắt lỗi khi API trả về
api.interceptors.response.use(
    (response) => response, 
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; 

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) throw new Error('Không có refresh token');

                const res = await axios.post('https://dlua-chat-api.onrender.com/api/auth/refresh-token', { token: refreshToken });
                
                const newAccessToken = res.data.accessToken;

                if (localStorage.getItem('accessToken')) {
                    localStorage.setItem('accessToken', newAccessToken);
                } else {
                    sessionStorage.setItem('accessToken', newAccessToken);
                }

                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;