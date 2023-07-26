const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth')
const imageController = require('../controllers/image')

router.get('/all', imageController.getAllPublishedImages)
router.post('/new',auth, imageController.createImage);
router.post('/delete/:imageId', auth, imageController.deleteImage);
router.get('/:imageId', imageController.getImage);
router.post('/correct/:imageId', auth, imageController.editImage)
router.post('/upscale/:imageId',auth, imageController.upscale)
router.post('/mask/:imageId', auth, imageController.mask)
router.post('/download/:imageId', imageController.downloadImage)

module.exports = router;
