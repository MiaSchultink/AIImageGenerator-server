const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth')
const imageController = require('../controllers/image')

const multer = require('multer');
const upload = multer();

router.get('/all', imageController.getAllPublishedImages)
router.post('/new', auth, imageController.createImage);
router.post('/delete/:imageId', auth, imageController.deleteImage);
router.get('/:imageId', imageController.getImage);
router.post('/correct/:imageId', auth, imageController.editImage)
router.post('/upscale/:imageId',auth, imageController.upscale)
router.post('/download/:imageId', imageController.downloadImage)
router.post('/suggest-prompt', auth, imageController.getPromptSuggestion);

module.exports = router;
