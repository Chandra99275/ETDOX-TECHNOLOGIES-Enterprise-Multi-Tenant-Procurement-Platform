import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { currentUser, register, signIn } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

export const router = Router();
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), signIn);
router.get('/me', authenticate, currentUser);
