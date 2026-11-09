import { Router } from 'express';
import { assign, create, list, overdue, updateStatus } from '../controllers/task.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { AssignSchema, TaskCreateSchema, TaskStatusUpdateSchema } from '../types/dto';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.use(authMiddleware);

router.get('/overdue', asyncHandler(overdue));
router.get('/', asyncHandler(list));
router.post('/', validate(TaskCreateSchema), asyncHandler(create));
router.patch('/:id/status', validate(TaskStatusUpdateSchema), asyncHandler(updateStatus));
router.patch('/:id/assign', validate(AssignSchema), asyncHandler(assign));

export default router;
