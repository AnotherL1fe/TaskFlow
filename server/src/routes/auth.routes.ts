import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { LoginSchema, RegisterSchema } from '../types/dto';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.post('/register', validate(RegisterSchema), asyncHandler(register));
router.post('/login', validate(LoginSchema), asyncHandler(login));

export default router;
