import { Router } from 'express';
import {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getSupplierScorecard,
} from '../controllers/suppliersController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);
router.get('/', listSuppliers);
router.get('/:id/scorecard', getSupplierScorecard);
router.post('/', allowRoles('admin'), auditLog('suppliers'), createSupplier);
router.patch('/:id', allowRoles('admin'), auditLog('suppliers'), updateSupplier);
router.delete('/:id', allowRoles('admin'), auditLog('suppliers'), deleteSupplier);

export default router;
