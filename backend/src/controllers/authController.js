const User = require('../models/User');
const bcrypt = require('bcrypt');
const FriendRequest = require('../models/FriendRequest');
const jwt = require('jsonwebtoken');

// 1. Đăng ký
exports.register = async (req, res) => {
    try {
        const { fullName, username, uniqueName, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { uniqueName }] });
        if (existingUser) {
            if (existingUser.username === username) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại!' });
            if (existingUser.uniqueName === uniqueName) return res.status(400).json({ message: 'Tên đặc biệt này đã có người dùng!' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new User({ fullName, username, uniqueName, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'Đăng ký tài khoản thành công!' });
    } catch (error) { res.status(500).json({ message: 'Lỗi server', error: error.message }); }
};

// 2. Đăng nhập (Đã gỡ bỏ JWT Token, trả thẳng User)
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại!' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Sai mật khẩu!' });
        
        // Trả về trực tiếp thông tin User, loại bỏ hoàn toàn AccessToken/RefreshToken
        res.status(200).json({ 
            message: 'Đăng nhập thành công', 
            user: { 
                id: user._id, 
                fullName: user.fullName, 
                username: user.username, 
                uniqueName: user.uniqueName, 
                avatar: user.avatar 
            } 
        });
    } catch (error) { res.status(500).json({ message: 'Lỗi server', error: error.message }); }
};

// 3. Tìm kiếm người dùng
exports.searchUser = async (req, res) => {
    try {
        let { uniqueName } = req.query;
        if (!uniqueName) return res.status(400).json({ message: 'Vui lòng nhập tên định danh!' });
        const user = await User.findOne({ uniqueName: uniqueName.trim() }).select('-password');
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng này!' });
        res.status(200).json(user);
    } catch (error) { res.status(500).json({ message: 'Lỗi server khi tìm kiếm' }); }
};

// 4. Gửi lời mời kết bạn (Bảo vệ kiểm tra mảng Object)
exports.sendFriendRequest = async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        if (senderId === receiverId) return res.status(400).json({ message: 'Không thể tự kết bạn!' }); 
        
        const sender = await User.findById(senderId);
        // Ngăn chặn kết bạn 2 lần
        const isAlreadyFriend = sender.friends.some(f => f.userId && f.userId.toString() === receiverId);
        if (isAlreadyFriend) return res.status(400).json({ message: 'Đã là bạn bè rồi!' });     
        
        // Kiểm tra xem đã gửi lời mời trước đó chưa
        const existingRequest = await FriendRequest.findOne({ sender: senderId, receiver: receiverId, status: 'pending' });
        if(existingRequest) return res.status(400).json({ message: 'Đã gửi lời mời trước đó rồi!' });

        const newRequest = new FriendRequest({ sender: senderId, receiver: receiverId });
        await newRequest.save();
        res.status(201).json({ message: 'Đã gửi lời mời!' });
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

// 5. Lấy danh sách chờ
exports.getPendingRequests = async (req, res) => {
    try {
        const requests = await FriendRequest.find({ receiver: req.params.userId, status: 'pending' }).populate('sender', 'fullName uniqueName avatar');
        res.status(200).json(requests);
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

// 6. Phản hồi lời mời (Lưu kèm thời điểm kết bạn cho Locket)
exports.respondRequest = async (req, res) => {
    try {
        const { requestId, status } = req.body;
        const request = await FriendRequest.findById(requestId);
        if (!request) return res.status(404).json({ message: 'Yêu cầu không tồn tại!' });
        
        if (status === 'accepted') {
            const now = new Date();
            await User.findByIdAndUpdate(request.sender, { 
                $push: { friends: { userId: request.receiver, friendSince: now } } 
            });
            await User.findByIdAndUpdate(request.receiver, { 
                $push: { friends: { userId: request.sender, friendSince: now } } 
            });
            await FriendRequest.findByIdAndDelete(requestId);
            return res.status(200).json({ message: 'Đã kết bạn!' });
        } else {
            await FriendRequest.findByIdAndDelete(requestId);
            return res.status(200).json({ message: 'Đã từ chối.' });
        }
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

// 7. Lấy danh sách bạn bè (Bảo vệ dữ liệu trống)
exports.getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('friends.userId', 'fullName uniqueName avatar isOnline lastSeen');       
        
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        
        // Loại bỏ các Object rác (nếu có user nào bị xóa tài khoản)
        const formattedFriends = user.friends
            .filter(f => f.userId != null) 
            .map(f => f.userId);
            
        res.status(200).json(formattedFriends);
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' }); 
    }
};

// 8. Xóa bạn bè (Xóa triệt để object khỏi mảng)
exports.unfriend = async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await User.findByIdAndUpdate(userId, { $pull: { friends: { userId: friendId } } });
        await User.findByIdAndUpdate(friendId, { $pull: { friends: { userId: userId } } });
        res.status(200).json({ message: 'Đã xóa bạn bè' });
    } catch (error) { res.status(500).json({ message: 'Lỗi server khi xóa' }); }
};

// 9. Đổi mật khẩu
exports.changePassword = async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Tài khoản không tồn tại!' });
        
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Mật khẩu cũ không chính xác!' });
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        res.status(200).json({ message: 'Đổi mật khẩu thành công!' });
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

// 10. Cập nhật Avatar
exports.updateAvatar = async (req, res) => {
    try {
        const { userId, avatarUrl } = req.body;
        const user = await User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { new: true });
        res.status(200).json({ avatar: user.avatar });
    } catch (error) { res.status(500).json({ message: 'Lỗi cập nhật ảnh' }); }
};
exports.migrateFriends = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        const users = await usersCollection.find({}).toArray();
        let count = 0;
        for (let user of users) {
            if (user.friends && user.friends.length > 0) {
                let isOldFormat = false;
                const newFriends = user.friends.map(f => {
                    if (mongoose.Types.ObjectId.isValid(f) && !f.userId) {
                        isOldFormat = true;
                        return { userId: f, friendSince: new Date() };
                    }
                    return f;
                });
                if (isOldFormat) {
                    await usersCollection.updateOne(
                        { _id: user._id },
                        { $set: { friends: newFriends } }
                    );
                    count++;
                }
            }
        }
        res.status(200).json({ message: `ĐÃ SỬA LỖI! Cập nhật thành công ${count} tài khoản. Bạn có thể vào lại DluaChat!` });
    } catch (error) {
        res.status(500).json({ message: "Lỗi convert dữ liệu", error: error.message });
    }
};

exports.generateSSOToken = async (req, res) => {
    try {
        const { userId, redirectUri, appName } = req.body;
        const user = await User.findById(userId).select('_id fullName uniqueName avatar email');
        if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
        const ssoToken = jwt.sign(
            { id: user._id, fullName: user.fullName, uniqueName: user.uniqueName, avatar: user.avatar, email: user.email },
            process.env.JWT_SECRET || 'DluaChat_Secret_Key',
            { expiresIn: '5m' }
        );
        const finalRedirectUrl = `${redirectUri}?sso_token=${ssoToken}`;
        res.status(200).json({ redirectUrl: finalRedirectUrl });

    } catch (error) {
        res.status(500).json({ message: "Lỗi tạo SSO Token", error });
    }
};