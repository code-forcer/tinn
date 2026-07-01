const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Question = require('../models/Question');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');

const upload = multer({ dest: 'uploads/' });

router.post('/import', verifyToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File required' });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let created = 0;
    for (const row of rows) {
      const text = row.Question || row.Title || row.Text;
      if (!text) continue;
      const exists = await Question.findOne({ text });
      if (!exists) {
        await Question.create({ text });
        created++;
      }
    }

    res.json({ message: 'Import complete', created });
  } catch (err) {
    res.status(500).json({ message: 'Import error', error: err.message });
  }
});

module.exports = router;
