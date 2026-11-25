import express from 'express';
import { getAllPTM, createPTM, updatePTM, deletePTM } from '../controllers/ptmController.js';
import { sendPtmEmail, getPtmDefaultMails, savePtmDefaultMails } from '../controllers/ptmEmailController.js';
import templateRoutes from './templateRoutes.js';

const router = express.Router();

router.get('/', getAllPTM);
router.post('/', createPTM);

router.post('/send-email', sendPtmEmail);
router.get('/default-mails', getPtmDefaultMails);
router.put('/default-mails', savePtmDefaultMails);

router.use('/templates', templateRoutes);

router.put('/:id', updatePTM);
router.delete('/:id', deletePTM);

export default router;

