import { Request, Response } from 'express';
import { validate as isUUID } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';

// ─── Multer configuration ─────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const companyId = req.user?.companyId ?? 'unknown';
    const dir = path.join(process.cwd(), 'uploads', companyId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ─── POST /api/attachments/upload ────────────────────────────────────────────

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  const { resource_type, resource_id } = req.body;

  if (!resource_type || !['order', 'shipment', 'invoice'].includes(resource_type)) {
    res.status(400).json({ error: 'resource_type must be order, shipment, or invoice' }); return;
  }
  if (!resource_id || !isUUID(resource_id)) {
    res.status(400).json({ error: 'Valid resource_id is required' }); return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' }); return;
  }

  const companyId = req.user!.companyId;
  const fileUrl = `/uploads/${companyId}/${req.file.filename}`;

  const result = await query(
    `INSERT INTO attachments (company_id, resource_type, resource_id, file_name, file_url, file_size, mime_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      companyId,
      resource_type,
      resource_id,
      req.file.originalname,
      fileUrl,
      req.file.size,
      req.file.mimetype,
      req.user!.userId,
    ],
  );
  res.status(201).json(result.rows[0]);
}

// ─── GET /api/attachments ─────────────────────────────────────────────────────

export async function listAttachments(req: Request, res: Response): Promise<void> {
  const { resource_type, resource_id } = req.query;

  let sql = `
    SELECT a.*, u.name AS uploaded_by_name
    FROM attachments a
    LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.company_id = $1
  `;
  const params: unknown[] = [req.user!.companyId];

  if (resource_type) {
    params.push(resource_type);
    sql += ` AND a.resource_type = $${params.length}`;
  }
  if (resource_id && isUUID(String(resource_id))) {
    params.push(resource_id);
    sql += ` AND a.resource_id = $${params.length}`;
  }

  sql += ' ORDER BY a.created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
}

// ─── DELETE /api/attachments/:id ─────────────────────────────────────────────

export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid attachment ID' }); return; }

  const existing = await query(
    `SELECT * FROM attachments WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId],
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Attachment not found' }); return;
  }

  const attachment = existing.rows[0];
  // Remove file from disk
  const filePath = path.join(process.cwd(), attachment.file_url);
  try { fs.unlinkSync(filePath); } catch { /* ignore if file missing */ }

  await query(`DELETE FROM attachments WHERE id = $1`, [id]);
  res.json({ message: 'Attachment deleted' });
}

// ─── GET /api/attachments/:id/download ───────────────────────────────────────

export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid attachment ID' }); return; }

  const result = await query(
    `SELECT * FROM attachments WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Attachment not found' }); return;
  }

  const attachment = result.rows[0];
  const filePath = path.join(process.cwd(), attachment.file_url);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on disk' }); return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
  res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}
