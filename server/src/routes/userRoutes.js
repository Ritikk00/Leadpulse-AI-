import { Router } from 'express';
import { z } from 'zod';
import { createEmployee, deleteEmployee, listEmployees, listStaff } from '../controllers/userController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth, requireAdmin);
router.get('/employees', listEmployees);
router.get('/staff', listStaff);
router.post('/employees', validate(z.object({
	name: z.string().trim().min(2).max(100),
	email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
	temporaryPassword: z.string().min(8).max(128)
})), createEmployee);
router.delete('/employees/:id', (req, _res, next) => /^[\da-f]{24}$/i.test(req.params.id)
	? next()
	: next(new AppError(400, 'Employee id is invalid.')), deleteEmployee);

export default router;