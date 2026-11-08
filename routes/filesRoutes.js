const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const f = require('../controllers/filesController');

router.get('/', auth, f.listFiles);
router.post('/', auth, f.uploadOne, f.uploadFile);
router.get('/:id/download', auth, f.downloadFile);
router.delete('/:id', auth, f.deleteFile);

module.exports = router;
