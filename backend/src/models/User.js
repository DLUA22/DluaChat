const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    uniqueName: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: null },
    friends: [{ 
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        friendSince: { type: Date, default: Date.now }
    }],
    
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);