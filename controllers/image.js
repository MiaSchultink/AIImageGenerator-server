const HttpError = require("../models/http-error");
const User = require("../models/user");
const Image = require("../models/image");
const fetch = require("node-fetch");
const fs = require("fs");
const FormData = require("form-data");
const Jimp = require("jimp");
const getChatGPTAPIResponse = require("../util/getGPTData");

const FIXED_DIMENTION = 1024;

function numberAspect(stringAspect) {
  if (stringAspect) {
    const widthRat = Number(stringAspect.split("X")[0]);
    const heightRat = Number(stringAspect.split("X")[1]);
    return { width: widthRat, height: heightRat };
  } else {
    return { width: 1, height: 1 };
  }
}

function calculateWidthAndHeight(stringAspect) {
  const numAspect = numberAspect(stringAspect);
  const widthRat = numAspect.width;
  const heightRat = numAspect.height;

  let width;
  let height;
  if (widthRat < heightRat) {
    width = FIXED_DIMENTION * (widthRat / heightRat);
    height = FIXED_DIMENTION;
  } else if (heightRat > widthRat) {
    width = FIXED_DIMENTION;
    height = FIXED_DIMENTION * (heightRat / widthRat);
  } else {
    height = width = FIXED_DIMENTION;
  }
  height = Math.round(height);

  return { width: height };
}

function downloadImageFromBase64(base64Data, response, imageName) {
  const base64Image = base64Data.split(";base64,").pop();
  const binaryData = Buffer.from(base64Image, "base64");
  response.setHeader("Content-Type", "image/png");
  response.setHeader("Content-Disposition", "attachment; filename=image.png");
  console.log(response);
  response.end(binaryData);
}

async function sendStableDiffusionPrompt(prompt, stringAspect, style) {
  try {
    const { width, height } = calculateWidthAndHeight(stringAspect);
    const apiKey = process.env.STABLEDIFFUSION_API_KEY;
    const url = `https://api.stability.ai/v1/generation/${process.env.STABLEDIFFUSION_ENGINE_ID}/text-to-image`;
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: prompt,
          },
        ],
        cfg_scale: 7,
        clip_guidance_preset: "FAST_BLUE",
        height: height,
        width: width,
        samples: 1,
        steps: 30,
        style_preset: style || "photographic",
      }),
    };
    console.log("Sending to Stability AI", url, options);
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Non-200 response: ${await response.text()}`);
    }
    const result = (await response.json()).artifacts[0].base64;
    return result;
  } catch (err) {
    console.log(err);
    return null;
  }
}

async function imageToImageStabilityAI(prompt, base64, style, stringAspect) {
  const engineId = "stable-diffusion-v1-5";
  const apiHost = process.env.API_HOST ?? "https://api.stability.ai";
  const apiKey = process.env.STABLEDIFFUSION_API_KEY;

  if (!apiKey) throw new Error("Missing Stability API key.");

  const base64Data = base64.split(",")[1];
  const binaryData = Buffer.from(base64Data, "base64");

  const formData = new FormData();
  formData.append("init_image", binaryData);
  formData.append("init_image_mode", "IMAGE_STRENGTH");
  formData.append("image_strength", 0.35);
  formData.append("text_prompts[0][text]", prompt);
  formData.append("cfg_scale", 7);
  formData.append("clip_guidance_preset", "FAST_BLUE");
  formData.append("samples", 1);
  formData.append("steps", 30);
  if (style) {
    formData.append("style_preset", style);
  }
  if (stringAspect) {
    const { width, height } = calculateWidthAndHeight(stringAspect);
    formData.append("width", width);
    formData.append("height", height);
  }

  console.log("sending to stability ai", formData);

  const response = await fetch(
    `${apiHost}/v1/generation/${engineId}/image-to-image`,
    {
      method: "POST",
      headers: {
        ...formData.getHeaders(),
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Non-200 response: ${await response.text()}`);
  }

  const responseJSON = await response.json();
  const newBase64 = responseJSON.artifacts[0].base64;
  console.log("done image to iamge");
  return newBase64;
}

async function stabilitAIUpscale(base64) {
  const engineId = "esrgan-v1-x2plus";
  const apiHost = process.env.API_HOST ?? "https://api.stability.ai";
  const apiKey = process.env.STABLEDIFFUSION_API_KEY;

  if (!apiKey) throw new Error("Missing Stability API key.");

  const base64Data = base64.split(",")[1];
  const binaryData = Buffer.from(base64Data, "base64");

  const formData = new FormData();
  formData.append("image", binaryData);
  formData.append("width", 1024);

  console.log("Upscaling image", formData);

  const response = await fetch(
    `${apiHost}/v1/generation/${engineId}/image-to-image/upscale`,
    {
      method: "POST",
      headers: {
        ...formData.getHeaders(),
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Non-200 response: ${await response.text()}`);
  }

  const image = (await response.json()).artifacts[0];
  const newBase64 = image.base64;
  console.log("done upscaling image");
  return newBase64;
}

exports.createImage = async (req, res, next) => {

  async function getKeyWordFromPrompt(prompt){
    let GPTPrompt = 'You are a summarizer and title writter. You are given the following image prompt: '+prompt;
    GPTPrompt+="Your goal is to construct an informative, short title for the image based on the most important information in the given prompt."
    GPTPrompt+="Provide only the title and no introductory or explanitory text about the title in your response."
    const GPTResponse = await getChatGPTAPIResponse(GPTPrompt);
    return GPTResponse;
  }

  console.log("Body", req);
  try {
    const {
      imagePrompt,
      aspectRatio,
      uploadedImage,
      colors,
      themes,
      style,
      published,
    } = req.body;

    const generatedName = await getKeyWordFromPrompt(imagePrompt);
    console.log(generatedName)
    let user;

    try {
      user = await User.findById(req.userData.userId);
    } catch (err) {
      console.log(err);
      const error = new HttpError("Could not find user for provided ID", 404);
      return next(error);
    }

    if (!user) {
      console.log("no user found");
      const error = new HttpError("No user found", 500);
      return next(error);
    }

    function tweekPrompt(originalPrompt, themes, colors) {
      let newPrompt = originalPrompt;
      function addColors() {
        colors.forEach((color, index, colors) => {
          newPrompt += ", " + color;
        });
        return newPrompt;
      }
      function addThemes() {
        themes.forEach((theme, index, themes) => {
          newPrompt += ", " + theme;
        });
        return newPrompt;
      }
      newPrompt = addColors();
      newPrompt = addThemes();
      return newPrompt;
    }
    const finalPrompt = tweekPrompt(imagePrompt, themes, colors);

    let imageBase64;
    if (uploadedImage) {
      const bufferImage = Buffer.from(uploadedImage.split(",")[1], "base64");
      const readImage = await Jimp.read(bufferImage);
      readImage.resize(1024, 1024).quality(60);
      const newBase64 = await readImage.getBase64Async(Jimp.MIME_JPEG);

      console.log("chose image");
      imageBase64 = await imageToImageStabilityAI(
        finalPrompt,
        newBase64,
        style,
        aspectRatio
      );
    } else {
      console.log("chose text");
      imageBase64 = await sendStableDiffusionPrompt(
        finalPrompt,
        aspectRatio,
        style
      );
    }

    const newBase64 = "data:image/jpeg;base64," + imageBase64;
    const numAspect = numberAspect(aspectRatio);

    const image = new Image({
      name: generatedName,
      prompt: finalPrompt,
      base64: newBase64,
      creator: user._id,
      width: FIXED_DIMENTION,
      height: FIXED_DIMENTION * (numAspect.height / numAspect.width),
      colors: colors,
      themes: themes,
      style: style,
      published: published,
    });

    await image.save();
    user.images.push(image);
    await user.save();
    res.status(200).json({ base64: imageBase64 });
  } catch (err) {
    console.log(err);
    const error = new HttpError("There was a problem creating this image", 500);
    return next(error);
  }
};

exports.getAllPublishedImages = async (req, res, next) => {
  try {
    const images = await Image.find({ published: true }).exec();
    res.status(200).json({ images: images });
  } catch (err) {
    console.log(err);
    const error = new HttpError("Something went wrong", 500);
    return next(error);
  }
};

exports.deleteImage = async (req, res, next) => {
  const imageId = req.params.imageId;
  try {
    const image = await Image.findById(imageId).populate("creator");
    const user = await User.findById(image.creator);
    user.images.pull(image._id);
    await image.deleteOne();
    await user.save();
    res.status(200).json({ image: image });
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not delete image", 500);
    return next(error);
  }
};

exports.getImage = async (req, res, next) => {
  try {
    const imageId = req.params.imageId;
    const image = await Image.findById(imageId).populate("creator");
    res.status(200).json({ image: image });
  } catch (err) {
    const error = new HttpError("Could not get image", 500);
    return next(error);
  }
};

exports.editImage = async (req, res, next) => {
  const imageId = req.params.imageId;
  let image;
  try {
    image = await Image.findById(imageId);
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not get image", 404);
    return next(error);
  }
  try {
    const newBase64 = await imageToImageStabilityAI(
      req.body.correctingInfo,
      image.base64
    );
    console.log(newBase64);
    const modifiedBase64 = "data:image/jpeg;base64," + newBase64;
    image.base64 = modifiedBase64;
    await image.save();
    res.status(200).json({ newImage: image });
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not edit image", 500);
    return next(error);
  }
};

exports.upscale = async (req, res, next) => {
  const imageId = req.params.imageId;
  let image;
  try {
    image = await Image.findById(imageId);
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not get image", 404);
    return next(error);
  }
  try {
    const newBase64 = await stabilitAIUpscale(image.base64);
    const modifiedBase64 = "data:image/jpeg;base64," + newBase64;
    image.base64 = modifiedBase64;
    await image.save();
    res.status(200).json({ newImage: image });
  } catch (err) {
    console.log(err);
    const error = new HttpError("Failed to upscale image", 500);
    return next(error);
  }
};

exports.downloadImage = async (req, res, next) => {
  let image;
  try {
    image = await Image.findById(req.params.imageId);
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not find image", 404);
    return next(error);
  }
  try {
    downloadImageFromBase64(image.base64, res, image.name);
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not download image", 500);
    return next(error);
  }
};

exports.uploadAndConvertToB64 = (req, res, next) => {
  try {
    const fileBuffer = req.file.buffer;
    const base64Data = fileBuffer.toString("base64");
    res.status(200).json({ base64: base64Data });
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not set image prompt");
    return next(error);
  }
};

exports.getPromptSuggestion = async (req, res, next) => {
async function getGPTPromptSuggestions(userPompt) {
  const openAIprompt = `You are a photographer and image prompt writer.
      You are provided with the following text: ${userPompt}.
      Yout goal is to create a concise, detailed prompt describing an.
      The prompt should be like a verbal desription of the image and should not include direct instructions suck as 'create an image'.
      Be concise in your response. Make sure to include details related to the forground and the background of the image.`;
  try {
    const GPTResponse = await getChatGPTAPIResponse(openAIprompt);
    console.log('response', GPTResponse);
    return GPTResponse
  } catch (err) {
    console.log(err);
  }
}
  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not find user", 404);
    return next(error);
  }

  if (user) {
    try {
      const suggestion = await getGPTPromptSuggestions(req.body.userPrompt);
      res.status(200).json({ suggestion: suggestion });
    } catch (err) {
      console.log(err);
      const error = new HttpError("Could not get sugestion", 500);
      return next(error);
    }
  }
};



