const express = require('express');
const router = express.Router();
// THÊM getUnreadCounts VÀO ĐÂY
const { migrateDatabase, getMessages, sendMessage, unsendMessage, reactMessage, markAsRead, getUnreadCounts } = require('../controllers/messageController');
const uploadCloud = require('../config/cloudinary');

router.post('/upload', uploadCloud.single('file'), (req, res) => {
    try {
        if (!req.file) {
            console.log("❌ LỖI: Server không nhận được file từ Frontend!");
            return res.status(400).json({ message: "Không có file nào được gửi lên" });
        }       
        console.log("✅ ĐÃ LƯU FILE LÊN CLOUDINARY:", req.file.originalname);
        res.status(200).json({ 
            url: req.file.path, 
            name: req.file.originalname 
        });
    } catch (error) {
        console.error("❌ LỖI SERVER KHI UPLOAD:", error);
        res.status(500).json({ message: 'Lỗi upload file' });
    }
});
router.get('/sys-admin/migrate-db', migrateDatabase);
router.get('/unread-counts/:userId', getUnreadCounts);

router.get('/:senderId/:receiverId', getMessages);
router.post('/send', sendMessage);
router.post('/mark-read', markAsRead);
router.put('/unsend/:messageId', unsendMessage);
router.put('/react/:messageId', reactMessage);

module.exports = router;