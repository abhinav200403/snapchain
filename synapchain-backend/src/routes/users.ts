import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/usersController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';

const router = Router();
const adminOnly = allowRoles('admin');

router.use(authenticate, adminOnly);
router.get('/', listUsers);
router.post('/', auditLog('users'), createUser);
router.patch('/:id', auditLog('users'), updateUser);
router.delete('/:id', auditLog('users'), deleteUser);

export default router;
