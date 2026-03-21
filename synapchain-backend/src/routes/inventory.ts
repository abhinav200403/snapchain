import { Router } from 'express';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../controllers/inventoryController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);
router.get('/', listProducts);
router.post('/', allowRoles('admin', 'operations_manager'), auditLog('inventory'), createProduct);
router.patch('/:id', allowRoles('admin', 'operations_manager'), auditLog('inventory'), updateProduct);
router.delete('/:id', allowRoles('admin'), auditLog('inventory'), deleteProduct);

export default router;
