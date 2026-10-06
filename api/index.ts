import handler from '../server.ts';

export default async function apiEntry(req: any, res: any) {
  try {
    if (!req.socket) {
      req.socket = { remoteAddress: '127.0.0.1' };
    }
    if (!req.connection) {
      req.connection = req.socket;
    }
    if (!req.socket.remoteAddress) {
      req.socket.remoteAddress = '127.0.0.1';
    }
    return await handler(req, res);
  } catch (err: any) {
    console.error('[API Entry Exception]', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: err?.message || 'Internal Server Error',
      });
    }
  }
}
