import { Request, Response, NextFunction } from 'express';
import { getAuthAdmin } from '../config/firebase';
import { z, ZodSchema } from 'zod';
import rateLimit from 'express-rate-limit';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        displayName?: string;
      };
      validatedBody?: any;
      idempotencyKey?: string;
    }
  }
}

// Firebase Auth Middleware
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    
    if (!token) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }
    
    const decodedToken = await getAuthAdmin().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth - doesn't fail if no token
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decodedToken = await getAuthAdmin().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        displayName: decodedToken.name,
      };
    }
    next();
  } catch {
    next(); // Continue without auth
  }
}

// Validation Middleware
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: result.error.flatten().fieldErrors 
      });
      return;
    }
    req.validatedBody = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ 
        error: 'Invalid query parameters', 
        details: result.error.flatten().fieldErrors 
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}

// Rate Limiting
// req.ip honours the app's `trust proxy` setting, so it is the address seen by
// our own load balancer. Reading X-Forwarded-For directly would let clients pick
// a fresh "IP" per request and bypass every limit.
const getClientIp = (req: Request): string => req.ip || req.socket?.remoteAddress || 'unknown';

// Authenticated requests are limited per user, anonymous ones per IP.
const getUserOrIpKey = (req: Request): string => {
  const uid = (req as any).authenticatedUser?.id;
  return uid ? `user:${uid}` : `ip:${getClientIp(req)}`;
};

const limiterDefaults = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
} as const;

// Mounted after auth: signed-in members get their own budget, so users sharing a
// NAT (common for mobile couriers) do not exhaust each other's. The client polls
// several endpoints, so the budget is generous.
export const apiRateLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: 4000,
  message: { error: 'Too many requests, please try again later' },
  keyGenerator: getUserOrIpKey,
});

export const authRateLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many authentication attempts, please try again later' },
  keyGenerator: (req) => getClientIp(req),
});

export const strictRateLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded' },
  keyGenerator: (req) => getClientIp(req),
});

// Paid AI model calls (Gemini / Groq): must run after the auth middleware.
export const aiRateLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { error: 'AI request limit reached, please try again later' },
  keyGenerator: getUserOrIpKey,
});

// Unauthenticated public forms (e.g. advertiser inquiries).
export const publicFormRateLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions, please try again later' },
  keyGenerator: (req) => getClientIp(req),
});

// Money-moving endpoints (deposits, withdrawals, joins).
export const moneyRateLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many payment requests, please slow down' },
  keyGenerator: getUserOrIpKey,
});

// Idempotency Middleware
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    // For non-mutating requests, skip idempotency check
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    res.status(400).json({ error: 'Idempotency-Key header required for mutating requests' });
    return;
  }
  
  req.idempotencyKey = idempotencyKey;
  next();
}

// Concurrency Control - Optimistic Locking
export function optimisticLockMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ifMatch = req.headers['if-match'] as string;
  if (ifMatch) {
    req.headers['if-match'] = ifMatch;
  }
  next();
}

// Error Handler
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Error:', err);
  
  if (err instanceof z.ZodError) {
    res.status(400).json({ 
      error: 'Validation error', 
      details: err.flatten().fieldErrors 
    });
    return;
  }
  
  if (err.message.includes('not found') || err.message.includes('Not found')) {
    res.status(404).json({ error: err.message });
    return;
  }
  
  if (err.message.includes('permission') || err.message.includes('unauthorized') || err.message.includes('forbidden')) {
    res.status(403).json({ error: err.message });
    return;
  }
  
  if (err.message.includes('conflict') || err.message.includes('already exists')) {
    res.status(409).json({ error: err.message });
    return;
  }
  
  res.status(500).json({ error: 'Internal server error' });
}

// Async handler wrapper
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export * from './countryContext';
