
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function getChatGPTAPIResponse(prompt) {

const chatCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{role: "system", content: prompt}],
  });
  return chatCompletion.data.choices[0].message.content
}

module.exports = getChatGPTAPIResponse;
