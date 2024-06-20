const bcryptjs = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
require('dotenv').config();

module.exports = {
    register_post:[
            body('username').isLength({ min: 1 }).trim().withMessage('Username must be specified.').
            custom((value) => {
                if (value !== value.toLowerCase()) {
                    throw new Error('Username must be in lowercase.');
                }
                return true;
            }),
            body('password').isLength({ min: 1 }).trim().withMessage('Password must be specified.'),

    async function(req, res, next) {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }    
        
        let { username, password, roles } = req.body;
        username = username.toLowerCase(); // for preventing similar usernames with uppercase e.g: john, joHn.

        try {

            const existingUser = await User.findOne({ username }) 
            
            if (existingUser) {
               return res.status(400).json({ message: 'Username already exists!' });
            }

            const hashedPW = await bcryptjs.hash(password, 10);

            const newUser = new User({ username, password: hashedPW, roles });
            await newUser.save();

            res.json({ message: 'User created successfully' });

        } catch(error) {

            next(error)
        }
    }
],

    login_post: [         
        body('username').isLength({ min: 1 }).trim().withMessage('Username must be specified.').
        custom(value => {
            if (value !== value.toLowerCase()) {
                throw new Error('Username must be in lowercase.')
            }
            return true;
        }) ,
        body('password').isLength({ min: 1 }).trim().withMessage('Password must be specified.'),

    async function(req, res, next) {

        const errors = validationResult(req);

           if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }    

             const { username, password } = req.body;

            try{ 
                const user = await User.findOne({ username });

                if (!user) {
                    return res.status(400).json({ message: 'Invalid credentials!' });
                }

                const passwordMatch = await bcryptjs.compare(password, user.password);

                if (!passwordMatch) {
                    return res.status(400).json({ message: 'Invalid credentials!' });
                }

            const token = jwt.sign({userId: user._id}, process.env.SECRET);
            res.json({ token });

        } catch(error) {

            next(error);

        }
    }
],
}
