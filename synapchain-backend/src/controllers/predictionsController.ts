import { Request, Response } from 'express';
import { generateDemandForecast, generateRiskAssessment } from '../services/openai';

// POST /api/predictions/demand
export async function demandForecast(req: Request, res: Response): Promise<void> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-YOUR_KEY_HERE') {
    res.status(503).json({ error: 'AI service unavailable — OPENAI_API_KEY not configured' });
    return;
  }

  try {
    const result = await generateDemandForecast(req.user!.companyId);
    res.json(result);
  } catch (err: any) {
    const isAuthError = err?.status === 401 || err?.code === 'invalid_api_key';
    res.status(503).json({
      error: isAuthError
        ? 'AI service unavailable — invalid OpenAI API key'
        : 'AI service temporarily unavailable',
    });
  }
}

// GET /api/predictions/risk
export async function riskAssessment(req: Request, res: Response): Promise<void> {
  const result = await generateRiskAssessment(req.user!.companyId);
  res.json(result);
}
