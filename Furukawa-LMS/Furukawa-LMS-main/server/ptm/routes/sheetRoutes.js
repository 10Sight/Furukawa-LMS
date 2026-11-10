import express from 'express';
import { getSheet, saveSheet } from '../controllers/sheetController.js';

const router = express.Router();

router.get('/:key', getSheet);
router.put('/:key', saveSheet);

export default router;

