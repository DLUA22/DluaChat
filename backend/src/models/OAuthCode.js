const mongoose = require('mongoose');

const oauthCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 } 
});

module.exports = mongoose.model('OAuthCode', oauthCodeSchema);