const express = require('express');
const router = express.Router();
const { 
    register, login, searchUser, 
    sendFriendRequest, getPendingRequests, respondRequest, 
    getFriends, unfriend, changePassword, updateAvatar,
    migrateFriends, generateSSOToken 
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/search', searchUser);
router.post('/friend-request/send', sendFriendRequest);
router.get('/friend-request/pending/:userId', getPendingRequests);
router.post('/friend-request/respond', respondRequest);
router.get('/friends/:userId', getFriends);
router.post('/unfriend', unfriend);
router.post('/change-password', changePassword);
router.post('/update-avatar', updateAvatar);
router.get('/sys-admin/migrate-friends', migrateFriends);
router.post('/sso-authorize', authController.generateSSOToken);

module.exports = router;