const express = require('express');
const router = express.Router();

const { 
    register, login, searchUser, 
    sendFriendRequest, getPendingRequests, respondRequest, getFriends,
    unfriend, changePassword, updateAvatar, refreshToken
} = require('../controllers/authController');

// Đăng nhập / Đăng ký
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken); 

// Người dùng
router.get('/search', searchUser);
router.post('/change-password', changePassword);
router.post('/update-avatar', updateAvatar);

// Quản lý Bạn bè
router.post('/friend-request/send', sendFriendRequest);
router.get('/friend-request/pending/:userId', getPendingRequests);
router.post('/friend-request/respond', respondRequest);
router.get('/friends/:userId', getFriends);
router.post('/unfriend', unfriend);

module.exports = router;