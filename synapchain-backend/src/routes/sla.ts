import { Router } from 'express';
import { getAtRisk, runSlaCheck } from '../controllers/slaController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/at-risk', getAtRisk);
router.post('/check', allowRoles('admin'), runSlaCheck);

export default router;
