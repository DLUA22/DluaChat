const express = require('express');
const router = express.Router();
const { createGroup, getUserGroups, leaveGroup } = require('../controllers/groupController');

router.post('/create', createGroup);
router.get('/:userId', getUserGroups);
router.post('/leave', leaveGroup);

module.exports = router;