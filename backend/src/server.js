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

// Tạo HTTP Server bọc quanh Express app
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS cho Frontend
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // URL của Vite/React
        methods: ["GET", "POST"]
    }
});

// Khởi tạo kết nối DB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

io.on('connection', (socket) => {
    console.log('⚡ Một người dùng đã kết nối:', socket.id);

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
        } catch (error) {
            console.log("Lỗi join_server:", error.message);
        }
    });

    socket.on('join_groups', (groupIds) => {
        if (Array.isArray(groupIds)) {
            groupIds.forEach(id => socket.join(id));
            console.log(`👥 User ${socket.userId} joined rooms:`, groupIds);
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.receiverId).emit('display_typing', data.senderId);
    });
    
    socket.on('stop_typing', (data) => {
        socket.to(data.receiverId).emit('hide_typing', data.senderId);
    });

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

    socket.on('new_group_created', (data) => {
        try {
            if (data.members && Array.isArray(data.members)) {
                data.members.forEach(memberId => {
                    socket.to(memberId).emit('group_added');
                });
            }
        } catch (error) {
            console.log("Lỗi socket tạo nhóm:", error.message);
        }
    });
    socket.on('leave_group', (data) => {
        socket.to(data.receiverId).emit('group_updated', data);
    });

    // Báo cho người kia biết có lời mời kết bạn mới
    socket.on('send_friend_request', (data) => {
        socket.to(data.receiverId).emit('new_friend_request');
    });

    // Báo cho người kia biết mình đã đồng ý kết bạn
    socket.on('accept_friend_request', (data) => {
        socket.to(data.receiverId).emit('friend_request_accepted');
    });

    socket.on('unsend_message', (data) => {
        socket.to(data.receiverId).emit('message_unsent', data.messageId);
    });

    socket.on('react_message', (data) => {
        socket.to(data.receiverId).emit('message_reacted', data);
    });

    // --- SỰ KIỆN CHO CALL VIDEO/VOICE (WEBRTC) ---
    socket.on('call_user', (data) => {
        socket.to(data.userToCall).emit('call_incoming', {
            from: data.from,
            name: data.name,
            type: data.type,
            offer: data.offer
        });
    });

    socket.on('answer_call', (data) => {
        socket.to(data.to).emit('call_accepted', data.answer);
    });

    socket.on('ice_candidate', (data) => {
        socket.to(data.to).emit('ice_candidate', data.candidate);
    });

    socket.on('end_call', (data) => {
        socket.to(data.to).emit('call_ended');
    });

    socket.on('disconnect', async () => {
        console.log('❌ Người dùng đã ngắt kết nối');
        try {
            if (socket.userId) {
                const now = new Date();
                // Cập nhật DB thành Offline kèm thời gian
                await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: now });
                // Báo cho mọi người biết
                socket.broadcast.emit('user_status_changed', { userId: socket.userId, isOnline: false, lastSeen: now });
            }
        } catch (error) {
            console.log("Lỗi khi disconnect:", error.message);
        }
    });
});

const PORT = process.env.PORT || 5000;

// QUAN TRỌNG: Đổi app.listen thành server.listen
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});