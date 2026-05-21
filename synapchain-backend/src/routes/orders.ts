import { Router } from 'express';
import {
  listOrders, getOrder, createOrder,
  updateOrderStatus, updateOrderSupplier, partialFulfill,
} from '../controllers/ordersController';
import { getOrderTimeline } from '../controllers/timelineController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);

router.get('/',     listOrders);
router.get('/:id',  getOrder);
router.get('/:id/timeline', getOrderTimeline);

router.post(
  '/',
  allowRoles('admin', 'operations_manager'),
  auditLog('orders'),
  createOrder,
);

// Any authenticated role can call updateOrderStatus — the controller enforces
// per-transition role checks (supplier can only accept/reject their stage, etc.)
router.patch('/:id/status',   auditLog('orders'), updateOrderStatus);

// Only admin / ops can assign a supplier
router.patch(
  '/:id/supplier',
  allowRoles('admin', 'operations_manager'),
  auditLog('orders'),
  updateOrderSupplier,
);

// Partial fulfillment
router.post(
  '/:id/fulfill-partial',
  allowRoles('supplier', 'admin', 'operations_manager'),
  partialFulfill,
);

export default router;
