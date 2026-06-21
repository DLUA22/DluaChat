const Message = require('../models/Message');
const Group = require('../models/Group');
const mongoose = require('mongoose');

exports.getMessages = async (req, res) => {
    try {
        const { senderId, receiverId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const isGroup = req.query.isGroup === 'true'; // Nhận biết đang mở Nhóm hay Cá nhân
        const skip = (page - 1) * limit;

        const query = isGroup 
            ? { groupId: receiverId } 
            : { $or: [{ senderId, receiverId }, { senderId: receiverId, receiverId: senderId }] };

        const messages = await Message.find(query)
        .populate('senderId', 'fullName avatar') // Cần cho group để biết ai vừa nhắn
        .populate('replyTo', 'text imageUrl fileUrl videoUrl fileName senderId isUnsent')
        .sort({ createdAt: -1 }).skip(skip).limit(limit);

        res.status(200).json(messages.reverse());
    } catch (error) { res.status(500).json({ message: 'Lỗi server' }); }
};

exports.sendMessage = async (req, res) => {
    try {
        const { senderId, receiverId, groupId, text, replyTo, imageUrl, fileUrl, videoUrl, fileName, type, callDuration, isMissedCall } = req.body;
        let newMessage = new Message({ senderId, receiverId, groupId, text, replyTo, imageUrl, fileUrl, videoUrl, fileName, type, callDuration, isMissedCall });
        await newMessage.save();
        
        newMessage = await newMessage.populate('senderId', 'fullName avatar');
        if (replyTo) newMessage = await newMessage.populate('replyTo', 'text imageUrl fileUrl videoUrl fileName senderId isUnsent');
        
        res.status(201).json(newMessage);
    } catch (error) { res.status(500).json({ message: 'Lỗi khi gửi tin nhắn' }); }
};

exports.markAsRead = async (req, res) => {
    try {
        const { chatId, userId, isGroup } = req.body; 
        const userObjId = new mongoose.Types.ObjectId(userId);
        const chatObjId = new mongoose.Types.ObjectId(chatId);

        let query = {};

        if (isGroup) {
            query = { 
                groupId: chatObjId, 
                senderId: { $ne: userObjId }, 
                readBy: { $not: { $elemMatch: { userId: userObjId } } } 
            };
        } else {
            query = { 
                senderId: chatObjId, 
                receiverId: userObjId, 
                readBy: { $not: { $elemMatch: { userId: userObjId } } } 
            };
        }
        await Message.updateMany(query, {
            $push: { readBy: { userId: userObjId, readAt: new Date() } },
            $set: { isRead: true } 
        });

        res.status(200).json({ message: 'Đã cập nhật trạng thái xem' });
    } catch (error) {
        console.error("Lỗi cập nhật đã xem:", error);
        res.status(500).json({ message: 'Lỗi cập nhật đã xem' });
    }
};

// Thu hồi tin nhắn
exports.unsendMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const updatedMsg = await Message.findByIdAndUpdate(messageId, { isUnsent: true }, { new: true });
        res.status(200).json(updatedMsg);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi thu hồi' });
    }
};

// Thả/Gỡ cảm xúc
exports.reactMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { userId, emoji } = req.body;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Không tìm thấy tin nhắn' });

        // Kiểm tra xem user đã thả cảm xúc này chưa
        const existingReactionIndex = message.reactions.findIndex(r => r.userId.toString() === userId && r.emoji === emoji);

        if (existingReactionIndex !== -1) {
            // Nếu có rồi thì gỡ (unlike)
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Xóa cảm xúc cũ của user này (nếu có) và thêm cảm xúc mới
            message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);
            message.reactions.push({ userId, emoji });
        }

        await message.save();
        res.status(200).json(message.reactions);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi thả cảm xúc' });
    }
};
exports.getUnreadCounts = async (req, res) => {
    try {
        const { userId } = req.params;
        const userObjId = new mongoose.Types.ObjectId(userId);
        const userGroups = await Group.find({ members: userObjId }).select('_id');
        const groupIds = userGroups.map(g => g._id);
        const unreadMessages = await Message.find({ 
            senderId: { $ne: userObjId },
            $or: [
                { receiverId: userObjId },         
                { groupId: { $in: groupIds } }  
            ],
            readBy: { $not: { $elemMatch: { userId: userObjId } } },
            isRead: { $ne: true } 
        });

        const counts = {};
        unreadMessages.forEach(msg => {
            const senderKey = msg.groupId ? msg.groupId.toString() : msg.senderId.toString();
            counts[senderKey] = (counts[senderKey] || 0) + 1;
        });

        res.status(200).json(counts);
    } catch (error) {
        console.error("Lỗi đếm tin nhắn chưa đọc:", error);
        res.status(500).json({ message: 'Lỗi lấy số lượng tin nhắn chưa đọc' });
    }
};
exports.migrateDatabase = async (req, res) => {
    try {
        const oldMessages = await Message.find({ isRead: { $exists: true } });
        let migratedCount = 0;

        for (let msg of oldMessages) {
            if (msg.isRead === true && !msg.groupId) {
                msg.readBy = [{ 
                    userId: msg.receiverId, 
                    readAt: msg.readAt || msg.updatedAt 
                }];
            } else {
                msg.readBy = [];
            }
            await Message.updateOne(
                { _id: msg._id }, 
                { 
                    $set: { readBy: msg.readBy }, 
                    $unset: { isRead: 1, readAt: 1 } 
                }
            );
            migratedCount++;
        }
        res.status(200).json({ 
            message: "Đã nâng cấp xong Database an toàn!", 
            totalMigrated: migratedCount 
        });
    } catch (error) {
        console.error("Lỗi Migrate:", error);
        res.status(500).json({ message: "Lỗi trong quá trình nâng cấp DB" });
    }
};