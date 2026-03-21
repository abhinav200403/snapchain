import { Router } from 'express';
import { demandForecast, riskAssessment } from '../controllers/predictionsController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();
const analystAccess = allowRoles('admin', 'business_analyst');

router.use(authenticate, analystAccess);
router.post('/demand', demandForecast);
router.get('/risk', riskAssessment);

export default router;
