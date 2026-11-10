import express from 'express';
import { login, getCurrentUser, logout } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', getCurrentUser);
router.post('/logout', logout);

export default router;

