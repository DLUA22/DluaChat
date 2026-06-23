const Post = require('../models/Post');
const User = require('../models/User');

exports.createPost = async (req, res) => {
    try {
        const { author, imageUrl, caption } = req.body;
        if (!imageUrl) return res.status(400).json({ message: "Phải có ảnh chụp!" });

        const newPost = new Post({ author, imageUrl, caption });
        await newPost.save();
        
        const populatedPost = await newPost.populate('author', 'fullName avatar uniqueName');
        res.status(201).json(populatedPost);
    } catch (error) { res.status(500).json({ message: "Lỗi đăng bài" }); }
};

exports.getFeed = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        const queryConditions = [{ author: userId }];

        user.friends.forEach(friend => {
            queryConditions.push({
                author: friend.userId,
                createdAt: { $gte: friend.friendSince }
            });
        });
        const feed = await Post.find({ $or: queryConditions })
            .populate('author', 'fullName avatar uniqueName')
            .populate('comments.userId', 'fullName avatar')
            .sort({ createdAt: -1 })
            .limit(50); 

        res.status(200).json(feed);
    } catch (error) { res.status(500).json({ message: "Lỗi tải bảng tin" }); }
};

exports.reactToPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, emoji } = req.body;
        
        const post = await Post.findById(postId);
        const existingReact = post.reactions.findIndex(r => r.userId.toString() === userId);
        
        if (existingReact !== -1) post.reactions.splice(existingReact, 1);
        post.reactions.push({ userId, emoji });
        
        await post.save();
        res.status(200).json(post.reactions);
    } catch (error) { res.status(500).json({ message: "Lỗi thả tim" }); }
};

exports.commentOnPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, text } = req.body;
        
        const post = await Post.findByIdAndUpdate(
            postId,
            { $push: { comments: { userId, text } } },
            { new: true }
        ).populate('comments.userId', 'fullName avatar');
        
        res.status(200).json(post.comments);
    } catch (error) { res.status(500).json({ message: "Lỗi bình luận" }); }
};