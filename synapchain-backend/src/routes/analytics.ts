import { Router } from 'express';
import { overview, ordersChart, inventoryChart, suppliersChart, kpis } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.get('/overview', allowRoles('admin', 'business_analyst', 'operations_manager'), overview);
router.get('/kpis', kpis);
router.get('/orders', allowRoles('admin', 'business_analyst'), ordersChart);
router.get('/inventory', allowRoles('admin', 'business_analyst'), inventoryChart);
router.get('/suppliers', allowRoles('admin', 'business_analyst'), suppliersChart);

export default router;
