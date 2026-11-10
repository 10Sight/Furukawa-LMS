import express from 'express';
import { getAllPTM, createPTM, updatePTM, deletePTM } from '../controllers/ptmController.js';

const router = express.Router();

router.get('/', getAllPTM);
router.post('/', createPTM);
router.put('/:id', updatePTM);
router.delete('/:id', deletePTM);

export default router;

