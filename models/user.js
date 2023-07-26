const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role:{
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  resetToken: String,
  resetTokenExpiration: Date,
  plan:{
    type: String,
    enum: ['Free', 'Premium']
  },
  images: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Image",
    },
  ],
});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema);
