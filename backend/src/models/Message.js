const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    
    // LOẠI TIN NHẮN ('text' hoặc 'call_log')
    type: { type: String, default: 'text' },
    
    text: { type: String, default: '' },
    imageUrl: { type: String, default: null },
    fileUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    fileName: { type: String, default: null },

    // THÔNG TIN CUỘC GỌI
    callDuration: { type: Number, default: 0 }, // Giây
    isMissedCall: { type: Boolean, default: false },

    // TRẠNG THÁI ĐÃ XEM
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    reactions: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emoji: { type: String } }],
    isUnsent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ groupId: 1 });