module.exports = {
    // GET /posts
    get: (req, res) => {
        res.json({
            posts: ['Post 1', 'Post 2']
        });
    }
};