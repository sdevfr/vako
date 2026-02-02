module.exports = {
    get: (req, res) => {
        res.json({
            status: 'success',
            message: 'Vako API is running!'
        });
    }
};