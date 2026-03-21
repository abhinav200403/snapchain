import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditLogController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate, allowRoles('admin'));
router.get('/', listAuditLogs);

export default router;
