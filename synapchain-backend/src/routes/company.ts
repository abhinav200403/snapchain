import { Router } from 'express';
import { getCompany, updateCompany } from '../controllers/companyController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate);
router.get('/', getCompany);
router.patch('/', allowRoles('admin'), updateCompany);

export default router;
