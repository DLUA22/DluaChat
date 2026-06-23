const express = require('express');
const router = express.Router();
const { createPost, getFeed, reactToPost, commentOnPost } = require('../controllers/postController');

router.post('/create', createPost);
router.get('/feed/:userId', getFeed);
router.put('/react/:postId', reactToPost);
router.post('/comment/:postId', commentOnPost);
router.delete('/delete/:postId', require('../controllers/postController').deletePost);

module.exports = router;