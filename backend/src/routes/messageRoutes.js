const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getMessages, sendMessage, unsendMessage, reactMessage, markAsRead } = require('../controllers/messageController');

// 1. Ép tạo thư mục uploads một cách an toàn
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); 
}

// 2. Cấu hình Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// 3. API Upload File (Có in log ra Terminal)
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            console.log("❌ LỖI: Server không nhận được file từ Frontend!");
            return res.status(400).json({ message: "Không có file nào được gửi lên" });
        }
        
        console.log("✅ ĐÃ NHẬN FILE THÀNH CÔNG:", req.file.originalname);
        
        const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
        res.status(200).json({ url: fileUrl, name: req.file.originalname });
    } catch (error) {
        console.error("❌ LỖI SERVER KHI UPLOAD:", error);
        res.status(500).json({ message: 'Lỗi upload file' });
    }
});

router.get('/:senderId/:receiverId', getMessages);
router.post('/send', sendMessage);
router.post('/mark-read', markAsRead);
router.put('/unsend/:messageId', unsendMessage);
router.put('/react/:messageId', reactMessage);

module.exports = router;