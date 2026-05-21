import { Router } from 'express';
import {
  uploadAttachment,
  listAttachments,
  deleteAttachment,
  downloadAttachment,
  upload,
} from '../controllers/attachmentsController';
import { authenticate } from '../middleware/auth';
import { allowRoles } from '../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/', listAttachments);
router.post('/upload', upload.single('file'), uploadAttachment);
router.get('/:id/download', downloadAttachment);
router.delete('/:id', allowRoles('admin'), deleteAttachment);

export default router;
