const Group = require('../models/Group');

exports.createGroup = async (req, res) => {
    try {
        const { name, members, admin } = req.body;
        const newGroup = new Group({ name, members: [...members, admin], admin });
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (err) { res.status(500).json({ message: 'Lỗi tạo nhóm' }); }
};

exports.getUserGroups = async (req, res) => {
    try {
        const groups = await Group.find({ members: req.params.userId }).populate('members', 'fullName avatar isOnline lastSeen');
        res.status(200).json(groups);
    } catch (err) { res.status(500).json({ message: 'Lỗi lấy danh sách nhóm' }); }
};

exports.leaveGroup = async (req, res) => {
    try {
        const { groupId, userId } = req.body;
        
        // 1. Tìm nhóm trước để kiểm tra thành viên
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Không tìm thấy nhóm' });

        // 2. Xóa thành viên khỏi mảng
        group.members = group.members.filter(id => id.toString() !== userId);

        // 3. Nếu không còn ai -> Xóa sạch nhóm và tin nhắn
        if (group.members.length === 0) {
            await Group.findByIdAndDelete(groupId);
            const Message = require('../models/Message'); // Import tại chỗ để tránh vòng lặp
            await Message.deleteMany({ groupId: groupId });
            return res.status(200).json({ message: 'Nhóm đã được hủy diệt hoàn toàn' });
        }

        // 4. Nếu vẫn còn người -> Lưu lại nhóm đã cập nhật
        await group.save();
        res.status(200).json({ message: 'Đã thoát nhóm thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server khi thoát nhóm' });
    }
};