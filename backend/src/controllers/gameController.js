const Game = require('../models/Game');

exports.addGame = async (req, res) => {
    try {
        const { title, url, thumbnail, author } = req.body;
        
        if (!url.startsWith('http')) {
            return res.status(400).json({ message: "Đường link game không hợp lệ!" });
        }

        const newGame = new Game({ title, url, thumbnail, author });
        await newGame.save();
        
        const populatedGame = await Game.findById(newGame._id).populate('author', 'fullName uniqueName avatar');
        res.status(201).json(populatedGame);
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi đăng game", error });
    }
};

// 2. Tải danh sách tất cả các Game
exports.getGames = async (req, res) => {
    try {
        const games = await Game.find()
            .populate('author', 'fullName uniqueName avatar')
            .sort({ createdAt: -1 });
            
        res.status(200).json(games);
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi tải danh sách game", error });
    }
};

exports.playGame = async (req, res) => {
    try {
        const game = await Game.findByIdAndUpdate(
            req.params.gameId, 
            { $inc: { plays: 1 } },
            { new: true }
        );
        res.status(200).json(game);
    } catch (error) {
        res.status(500).json({ message: "Lỗi cập nhật lượt chơi" });
    }
};
exports.deleteGame = async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId } = req.body; 
        const game = await Game.findById(gameId);
        if (!game) return res.status(404).json({ message: "Không tìm thấy game" });
        if (game.author.toString() !== userId) {
            return res.status(403).json({ message: "Bạn không có quyền xóa game này!" });
        }
        await Game.findByIdAndDelete(gameId);
        res.status(200).json({ message: "Đã xóa game thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa game", error });
    }
};