import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  } else {
    console.error(err.message);
  }
  res.status(500).json({ error: 'Internal server error' });
}
