const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const webpush = require('web-push');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');

const app = express();

// 1. KẾT NỐI DATABASE VÀ MIDDLEWARE CƠ BẢN
connectDB();
app.use(express.json());
app.use(morgan('dev'));
// Cấu hình Helmet nhưng cho phép tải tài liệu tĩnh từ uploads
app.use(helmet({ crossOriginResourcePolicy: false }));

// 2. CẤU HÌNH CORS (Cho phép cả link chính và các link nháp của Vercel)
const allowedOrigins = [
    "http://localhost:5173", 
    "https://dlua-chat.vercel.app",
    /^https:\/\/dlua-chat.*\.vercel\.app$/ // Regex chấp nhận mọi sub-domain của vercel
];

const corsOptions = {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
};

app.use(cors(corsOptions));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 3. CẤU HÌNH WEB PUSH (THÔNG BÁO NỔI)
webpush.setVapidDetails(
    'mailto:test@dluachat.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

let userSubscriptions = {}; // Lưu trữ subscription của người dùng theo ID

// 4. KHAI BÁO CÁC ROUTES API
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// API lưu địa chỉ nhận thông báo từ Frontend
app.post('/api/notifications/subscribe', (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
        return res.status(400).json({ error: "Thiếu dữ liệu đăng ký" });
    }
    userSubscriptions[userId] = subscription;
    console.log(`✅ Đã lưu quyền nhận Push cho User: ${userId}`);
    res.status(201).json({ message: "Đã đăng ký thành công" });
});

// 5. KHỞI TẠO HTTP SERVER VÀ SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// Biến lưu trữ trạng thái cuộc gọi và socket
let activeCalls = {};
let userSockets = {};

io.on('connection', (socket) => {
    console.log('⚡ Một người dùng đã kết nối:', socket.id);

    // --- A. QUẢN LÝ TRẠNG THÁI ONLINE ---
    socket.on('join_server', async (userId) => {
        try {
            if (!userId) return;
            socket.join(userId);
            socket.userId = userId;
            
            const updatedUser = await User.findByIdAndUpdate(userId, { isOnline: true }, { new: true });          
            socket.broadcast.emit('user_status_changed', { 
                userId: userId, 
                isOnline: true, 
                lastSeen: updatedUser?.lastSeen 
            });

            // Kiểm tra cuộc gọi lỡ/đang chờ khi vừa vào app
            const ongoingCall = Object.values(activeCalls).find(call => call.userToCall === userId);
            if (ongoingCall) {
                socket.emit('call_incoming', ongoingCall);
            }

            // Xử lý đăng nhập nhiều nơi (Force Logout)
            if (userSockets[userId] && userSockets[userId] !== socket.id) {
                io.to(userSockets[userId]).emit('force_logout');
            }
            userSockets[userId] = socket.id;

        } catch (error) {
            console.error("Lỗi join_server:", error.message);
        }
    });

    socket.on('disconnect', async () => {
        try {
            if (socket.userId) {
                const now = new Date();
                await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: now });
                socket.broadcast.emit('user_status_changed', { userId: socket.userId, isOnline: false, lastSeen: now });
                
                // Dọn dẹp cuộc gọi nếu rớt mạng
                if (activeCalls[socket.userId]) {
                    socket.to(activeCalls[socket.userId].userToCall).emit('call_ended');
                    delete activeCalls[socket.userId];
                }
                if (userSockets[socket.userId] === socket.id) {
                    delete userSockets[socket.userId];
                }
            }
        } catch (error) {
            console.error("Lỗi khi disconnect:", error.message);
        }
    });

    // --- B. TIN NHẮN (ĐÃ CẬP NHẬT ẨN NỘI DUNG BẢO MẬT) ---
    socket.on('send_message', (data) => {
        if (data.groupId) {
            socket.to(data.groupId).emit('receive_message', data);
        } else {
            // 1. Gửi tin nhắn qua Socket.io theo thời gian thực (Nếu người nhận đang mở app)
            socket.to(data.receiverId).emit('receive_message', data);

            // 2. Bắn thông báo nổi bảo mật (Nếu người nhận đang tắt app/khóa màn hình)
            const sub = userSubscriptions[data.receiverId];
            if (sub) {
                // Mặc định ẩn nội dung tin nhắn chữ để bảo mật luồng AES
                let messageBody = "Đã gửi cho bạn một tin nhắn";
                
                // Nhận diện linh hoạt theo loại đính kèm để thông báo tường minh hơn
                if (data.imageUrl) {
                    messageBody = "Đã gửi cho bạn một hình ảnh";
                } else if (data.videoUrl) {
                    messageBody = "Đã gửi cho bạn một video";
                } else if (data.fileUrl) {
                    messageBody = "Đã gửi cho bạn một tập tin";
                }

                const payload = JSON.stringify({
                    title: data.senderName || 'Tin nhắn mới',
                    body: messageBody,
                    url: '/' // Khi nhấn vào thông báo sẽ đánh thức app nhảy vào trang chủ
                });

                webpush.sendNotification(sub, payload)
                    .catch(err => console.error("Lỗi gửi Push Tin nhắn Bảo mật:", err));
            }
        }
    });

    socket.on('mark_read', (data) => {
        socket.to(data.senderId).emit('messages_read', { receiverId: data.receiverId, readAt: data.readAt });
    });

    socket.on('typing', (data) => socket.to(data.receiverId).emit('display_typing', data.senderId));
    socket.on('stop_typing', (data) => socket.to(data.receiverId).emit('hide_typing', data.senderId));
    socket.on('unsend_message', (data) => socket.to(data.receiverId).emit('message_unsent', data.messageId));
    socket.on('react_message', (data) => socket.to(data.receiverId).emit('message_reacted', data));

    // --- C. NHÓM & BẠN BÈ ---
    socket.on('join_groups', (groupIds) => {
        if (Array.isArray(groupIds)) {
            groupIds.forEach(id => socket.join(id));
        }
    });

    socket.on('new_group_created', (data) => {
        if (data.members) data.members.forEach(memberId => socket.to(memberId).emit('group_added'));
    });

    socket.on('leave_group', (data) => socket.to(data.receiverId).emit('group_updated', data));
    socket.on('send_friend_request', (data) => socket.to(data.receiverId).emit('new_friend_request'));
    socket.on('accept_friend_request', (data) => socket.to(data.receiverId).emit('friend_request_accepted'));

    // --- D. GỌI ĐIỆN & WEB PUSH ---
    socket.on('call_user', (data) => {
        activeCalls[data.from] = data; 
        socket.to(data.userToCall).emit('call_incoming', data);

        // Bắn thông báo nổi nếu người nhận có đăng ký
        const sub = userSubscriptions[data.userToCall];
        if (sub) {
            const payload = JSON.stringify({
                title: 'Cuộc gọi đến',
                body: `${data.name} đang gọi cho bạn...`,
                url: '/' 
            });
            webpush.sendNotification(sub, payload).catch(err => console.error("Push Error:", err));
        }
    });

    socket.on('answer_call', (data) => {
        if(activeCalls[data.to]) delete activeCalls[data.to];
        socket.to(data.to).emit('call_accepted', data.answer);
    });

    socket.on('ice_candidate', (data) => socket.to(data.to).emit('ice_candidate', data.candidate));

    socket.on('end_call', (data) => {
        Object.keys(activeCalls).forEach(callerId => {
            if (callerId === data.to || activeCalls[callerId].userToCall === data.to) {
                delete activeCalls[callerId];
            }
        });
        socket.to(data.to).emit('call_ended');
    });
});

// 6. KHỞI ĐỘNG SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server DluaChat đang chạy tại cổng: ${PORT}`);
});