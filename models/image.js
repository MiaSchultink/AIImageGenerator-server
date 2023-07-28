const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;

const imageSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  prompt: {
    type: String,
    required: true,
  },
  iamgePrompt:{
    type: String
  },
  base64: {
    type: String,
    required: true,
  },
  style:{
    type:String
  },
  colors: [
    {
      type: String,
    },
  ],
  themes: [
    {
      type: String,
    },
  ],
  height:{
    type:Number
  },
  width: {
    type: Number
  },
  quality: {
    type: String
  },
  published: {
    type: Boolean,
    required: true,
    default: false,
  },
  creator:{
    type:mongoose.Types.ObjectId,
    ref: 'User'
  }
});

imageSchema.plugin(uniqueValidator);
module.exports = mongoose.model("Image", imageSchema);
