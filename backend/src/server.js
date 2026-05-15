const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');

const app = express();

// 1. KHỞI TẠO SERVER VÀ CORS
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "https://dlua-chat.vercel.app"], 
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// 2. KẾT NỐI DATABASE VÀ MIDDLEWARE
connectDB();
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173", "https://dlua-chat.vercel.app"]
}));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 3. KHAI BÁO ROUTES API
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// ==========================================
// 4. LOGIC SOCKET.IO (XỬ LÝ THỜI GIAN THỰC)
// ==========================================

// Biến lưu trữ tạm thời các cuộc gọi đang đổ chuông
let activeCalls = {};

io.on('connection', (socket) => {
    console.log('⚡ Một người dùng đã kết nối:', socket.id);

    // --- A. QUẢN LÝ TRẠNG THÁI ONLINE/OFFLINE ---
    socket.on('join_server', async (userId) => {
        try {
            if (!userId) return;
            socket.join(userId);
            socket.userId = userId;
            
            const updatedUser = await User.findByIdAndUpdate(userId, { isOnline: true }, { new: true });          
            socket.broadcast.emit('user_status_changed', { 
                userId: userId, 
                isOnline: true, 
                lastSeen: updatedUser.lastSeen 
            });
            console.log(`🟢 User ${userId} is Online`);

            // [FIX LỖI]: KIỂM TRA XEM CÓ AI ĐANG GỌI CHO NGƯỜI NÀY KHÔNG ĐỂ BÁO LẠI
            const ongoingCall = Object.values(activeCalls).find(call => call.userToCall === userId);
            if (ongoingCall) {
                console.log(`📞 Đang nhắc lại cuộc gọi cho User ${userId}`);
                socket.emit('call_incoming', ongoingCall);
            }

        } catch (error) {
            console.log("Lỗi join_server:", error.message);
        }
    });

    socket.on('disconnect', async () => {
        console.log('❌ Người dùng đã ngắt kết nối:', socket.id);
        try {
            if (socket.userId) {
                const now = new Date();
                await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: now });
                socket.broadcast.emit('user_status_changed', { userId: socket.userId, isOnline: false, lastSeen: now });
                
                // [FIX LỖI]: Xóa cuộc gọi nếu người gọi bị rớt mạng đột ngột
                if (activeCalls[socket.userId]) {
                    socket.to(activeCalls[socket.userId].userToCall).emit('call_ended');
                    delete activeCalls[socket.userId];
                }
            }
        } catch (error) {
            console.log("Lỗi khi disconnect:", error.message);
        }
    });

    // --- B. QUẢN LÝ TIN NHẮN CHAT ---
    socket.on('send_message', (data) => {
        if (data.groupId) {
            socket.to(data.groupId).emit('receive_message', data);
        } else {
            socket.to(data.receiverId).emit('receive_message', data);
        }
    });

    socket.on('mark_read', (data) => {
        socket.to(data.senderId).emit('messages_read', { receiverId: data.receiverId, readAt: data.readAt });
    });

    socket.on('typing', (data) => socket.to(data.receiverId).emit('display_typing', data.senderId));
    socket.on('stop_typing', (data) => socket.to(data.receiverId).emit('hide_typing', data.senderId));
    socket.on('unsend_message', (data) => socket.to(data.receiverId).emit('message_unsent', data.messageId));
    socket.on('react_message', (data) => socket.to(data.receiverId).emit('message_reacted', data));

    // --- C. QUẢN LÝ NHÓM (GROUPS) ---
    socket.on('join_groups', (groupIds) => {
        if (Array.isArray(groupIds)) {
            groupIds.forEach(id => socket.join(id));
            console.log(`👥 User ${socket.userId} joined rooms:`, groupIds);
        }
    });

    socket.on('new_group_created', (data) => {
        try {
            if (data.members && Array.isArray(data.members)) {
                data.members.forEach(memberId => socket.to(memberId).emit('group_added'));
            }
        } catch (error) {
            console.log("Lỗi socket tạo nhóm:", error.message);
        }
    });

    socket.on('leave_group', (data) => socket.to(data.receiverId).emit('group_updated', data));

    // --- D. QUẢN LÝ BẠN BÈ ---
    socket.on('send_friend_request', (data) => socket.to(data.receiverId).emit('new_friend_request'));
    socket.on('accept_friend_request', (data) => socket.to(data.receiverId).emit('friend_request_accepted'));

    // --- E. QUẢN LÝ GỌI ĐIỆN (WEBRTC) ---
    socket.on('call_user', (data) => {
        // Lưu thông tin cuộc gọi vào danh sách chờ
        activeCalls[data.from] = data; 
        socket.to(data.userToCall).emit('call_incoming', {
            from: data.from,
            name: data.name,
            type: data.type,
            offer: data.offer
        });
    });

    socket.on('answer_call', (data) => {
        // Khi người kia đã bắt máy, xóa cuộc gọi khỏi hàng đợi
        if(activeCalls[data.to]) {
            delete activeCalls[data.to];
        }
        socket.to(data.to).emit('call_accepted', data.answer);
    });

    socket.on('ice_candidate', (data) => socket.to(data.to).emit('ice_candidate', data.candidate));

    socket.on('end_call', (data) => {
        // Tìm và dọn dẹp sạch sẽ cuộc gọi rác trong bộ nhớ
        Object.keys(activeCalls).forEach(callerId => {
            if (callerId === data.to || activeCalls[callerId].userToCall === data.to) {
                delete activeCalls[callerId];
            }
        });
        socket.to(data.to).emit('call_ended');
    });
});

// ==========================================
// 5. KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});