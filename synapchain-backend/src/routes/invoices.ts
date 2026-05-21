import { Router } from 'express';
import { listInvoices, createInvoice, updateInvoiceStatus } from '../controllers/invoicesController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listInvoices);
router.post('/', allowRoles('supplier', 'admin', 'operations_manager'), createInvoice);
router.patch('/:id/status', allowRoles('admin', 'operations_manager'), updateInvoiceStatus);

export default router;
