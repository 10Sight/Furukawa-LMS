import express from 'express';
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getPhases,
  createPhase,
  updatePhase,
  deletePhase,
  getTemplateHistory,
  recordTemplateHistory,
} from '../controllers/templateController.js';

const router = express.Router();

router.get('/history', getTemplateHistory);
router.post('/history', recordTemplateHistory);

router.get('/phases', getPhases);
router.post('/phases', createPhase);
router.put('/phases/:key', updatePhase);
router.delete('/phases/:key', deletePhase);

router.get('/', getTemplates);
router.get('/:id', getTemplateById);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
