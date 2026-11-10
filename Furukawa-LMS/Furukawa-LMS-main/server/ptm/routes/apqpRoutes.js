import express from 'express';
import { getSuggestions, addSuggestion } from '../controllers/apqpController.js';

const router = express.Router();

router.get('/suggestions', getSuggestions);
router.post('/suggestions', addSuggestion);

export default router;

