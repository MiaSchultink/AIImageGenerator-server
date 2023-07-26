const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require('@sendgrid/mail'); 
const crypto = require('crypto')

sgMail.setApiKey(process.env.SG_API_KEY);


const HttpError = require("../models/http-error");
const User = require('../models/user');
const { error } = require("console");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    const error = new HttpError(
      "Fetching users failed, please try again later.",
      500
    );
    return next(error);
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }
  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Signing up failed, please try again later.",
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User exists already, please login instead.",
      422
    );
    return next(error);
  }
  let hashedPassword;

  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError("Could not create user, please try again", 500);
    return next(error);
  }

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Logging in failed, please try again later.",
      500
    );
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      "Could not log you in, please check your credentials and try again",
      500
    );
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      "Invalid credentials, could not log you in.",
      403
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Logging in failed, please try again.", 500);
    return next(error);
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
  });
};

exports.getUser = async (req, res, next) =>{
  try{
    const user = await User.findById(req.params.userId).populate('images')
    res.status(200).json({user: user})
  }
  catch(err){
    console.log(err)
    const error = new HttpError("Could not find user", 404);
    return next(error)
  }
}

exports.deleteUser = async (req, res, next) =>{
  try{
    const user = await User.findById(req.body.userId);
    for(const image of user.images){
      await image.deleteOne()
    }
    await user.deleteOne();
  }
  catch(err){
    console.log(err)
    const error = new HttpError("Could not delete user", 500)
    return next(error)
  }
}

exports.resetPassword = async (req, res, next) => {
  try {
      const token = crypto.randomBytes(32).toString('hex');
      const user = await User.findOne({ email: req.body.email }).exec()
      if (!user) { throw new Error('No accounts with this email') }
      else {
          user.resetToken = token;
          user.resetTokenExpiration = Date.now() + 3600000
          await user.save()
          const host = (process.env.NODE_ENV == 'development') ?
              'http://localhost:3000' :
              'http://www.miaschultink.com'
          const message = {
              to: req.body.email,
              from: 'contact@miaschultink.com',
              subject: 'Password Reset',
              html: `
      <p>You requested a password reset.</p>
      <p>Click this <a href ="${host}/user/new-password/${token}">link</a></p>`
          }
          await sgMail.send(message)
          res.status(200).json({message: message, token: token, userId: user._id})
      }
  }
  catch (err) {
      console.log(err)
      const error = new HttpError("Could not send reset email", 500)
      return next(error)
  }
}

exports.postNewPassword = async (req, res, next) => {
  try {
      const newPassword = req.body.password;
      const userId = req.body.userId;
      const passwordToken = req.body.passwordToken;
      console.log(newPassword, userId, passwordToken)

      const user = await User.findOne({ resetToken: passwordToken, resetTokenExpiration: { $gt: Date.now() }, _id: userId }).exec()
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      user.password = hashedPassword;
      user.resetToken = null;
      user.resetTokenExpiration = undefined;

      await user.save();
     res.status(200).json({user: user})
  }
  catch (err) {
      console.log(err)
      const error = new HttpError('Could not create new password', 500);
      return next(error)
  }
};

exports.getUserByResetToken = async (req, res, next) =>{
  try{
    const token = req.params.token;
    const user = await User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } }).exec()
    res.status(200).json({user: user})
  }
  catch(err){
    console.log(err)
    const error = new HttpError('Could not find user',404)
    return next(error);
  }
}


exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
