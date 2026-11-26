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
} from '../controllers/templateController.js';

const router = express.Router();

router.get('/phases', getPhases);
router.post('/phases', createPhase);
router.put('/phases/:key', updatePhase);

router.get('/', getTemplates);
router.get('/:id', getTemplateById);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
