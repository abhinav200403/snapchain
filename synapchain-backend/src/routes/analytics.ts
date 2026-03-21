import { Router } from 'express';
import { overview, ordersChart, inventoryChart, suppliersChart } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();
const analystAccess = allowRoles('admin', 'business_analyst');

router.use(authenticate, analystAccess);
router.get('/overview', overview);
router.get('/orders', ordersChart);
router.get('/inventory', inventoryChart);
router.get('/suppliers', suppliersChart);

export default router;
