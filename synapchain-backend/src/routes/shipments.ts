import { Router } from 'express';
import { listShipments, createShipment, updateShipment } from '../controllers/shipmentsController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);
router.get('/', listShipments);
router.post('/', allowRoles('admin', 'supplier'), auditLog('shipments'), createShipment);
router.patch('/:id', allowRoles('admin', 'supplier'), auditLog('shipments'), updateShipment);

export default router;
