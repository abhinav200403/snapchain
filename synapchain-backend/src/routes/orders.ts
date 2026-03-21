import { Router } from 'express';
import { listOrders, getOrder, createOrder, updateOrderStatus } from '../controllers/ordersController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);
router.get('/', listOrders);
router.get('/:id', getOrder);
router.post('/', allowRoles('admin', 'operations_manager'), auditLog('orders'), createOrder);
router.patch('/:id/status', auditLog('orders'), updateOrderStatus);

export default router;
