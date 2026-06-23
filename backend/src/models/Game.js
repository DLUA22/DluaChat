const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    thumbnail: { type: String, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    plays: { type: Number, default: 0 } 
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);