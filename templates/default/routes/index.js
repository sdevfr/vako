module.exports = {
    get: (req, res) => {
        res.ender('index', { message: 'Hellow World!' });
    }
};