import app from '../server';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Function Top-Level Error]', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Vercel Serverless Function Execution Failure',
        message: err?.message || String(err),
      });
    }
  }
}
