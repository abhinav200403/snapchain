import { Router } from 'express';
import {
  listApprovalRules,
  createApprovalRule,
  updateApprovalRule,
  deleteApprovalRule,
} from '../controllers/approvalRulesController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listApprovalRules);
router.post('/', allowRoles('admin'), createApprovalRule);
router.patch('/:id', allowRoles('admin'), updateApprovalRule);
router.delete('/:id', allowRoles('admin'), deleteApprovalRule);

export default router;
