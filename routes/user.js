const express = require('express');
const { check } = require('express-validator');

const usersController = require('../controllers/user.js');
const router = express.Router();
const auth = require('../middleware/auth.js')

router.get('/', usersController.getUsers);
router.get('/:userId', usersController.getUser)

router.post(
  '/signup',
  [
    check('name')
      .not()
      .isEmpty(),
    check('email')
      .normalizeEmail() // Test@test.com => test@test.com
      .isEmail(),
    check('password').isLength({ min: 6 })
  ],
  usersController.signup
);

router.post('/login', usersController.login);
router.post('/reset', usersController.resetPassword)
router.post('/new-password/:token', usersController.postNewPassword)
router.get('/new-password/:token', usersController.getUserByResetToken)
router.post('/delete', usersController.deleteUser)

module.exports = router;
