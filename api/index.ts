import handler from '../server.ts';

export default function apiEntry(req: any, res: any) {
  if (!req.socket) {
    req.socket = { remoteAddress: '127.0.0.1' };
  }
  if (!req.connection) {
    req.connection = req.socket;
  }
  if (!req.socket.remoteAddress) {
    req.socket.remoteAddress = '127.0.0.1';
  }
  return handler(req, res);
}
