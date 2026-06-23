const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

router.post('/add', gameController.addGame);
router.get('/list', gameController.getGames);
router.put('/play/:gameId', gameController.playGame);

module.exports = router;