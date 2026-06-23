const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

router.post('/add', gameController.addGame);
router.get('/list', gameController.getGames);
router.put('/play/:gameId', gameController.playGame);
router.delete('/delete/:gameId', gameController.deleteGame);

module.exports = router;