const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    
    createdAt: { type: Date, default: Date.now, expires: '30d' } 
});

module.exports = mongoose.model('FriendRequest', friendRequestSchema);