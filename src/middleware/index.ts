import { Request, Response, NextFunction } from 'express';
import { getAuthAdmin } from '../config/firebase';
import { z, ZodSchema } from 'zod';
import rateLimit from 'express-rate-limit';
import { idempotencyRepository } from '../repositories';

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
    const userIdHeader = req.headers['x-user-id'] as string;
    
    // Support both Authorization header and x-user-id header (for backward compatibility)
    let token: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (userIdHeader) {
      // For development/testing - verify the user exists in Firebase
      try {
        const userRecord = await getAuthAdmin().getUser(userIdHeader);
        req.user = {
          uid: userRecord.uid,
          email: userRecord.email || '',
          displayName: userRecord.displayName || undefined,
        };
        return next();
      } catch {
        res.status(401).json({ error: 'Invalid user ID' });
        return;
      }
    }
    
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
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  const fwdHeader = req.headers['forwarded'];
  if (typeof fwdHeader === 'string') {
    const match = fwdHeader.match(/for="?([^;,\s"]+)"?/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
    default: false,
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 auth requests per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
    default: false,
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
    default: false,
  },
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

export async function checkIdempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.idempotencyKey) return next();
  
  try {
    const { isNew, response } = await idempotencyRepository.checkAndStore(
      req.idempotencyKey,
      null, // Will be filled after handler
      60 // 60 minutes TTL
    );
    
    if (!isNew) {
      // Return cached response
      res.setHeader('X-Idempotency-Replay', 'true');
      res.json(response);
      return;
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json to capture response
    res.json = (body: any) => {
      // Update idempotency record with actual response
      idempotencyRepository.checkAndStore(req.idempotencyKey!, body, 60);
      return originalJson(body);
    };
    
    next();
  } catch (error) {
    console.error('Idempotency error:', error);
    next(); // Continue without idempotency on error
  }
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