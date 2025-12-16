import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware to add correlation IDs to requests for distributed tracing
 * Adds X-Correlation-ID header to all requests and responses
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if correlation ID already exists (from upstream service/load balancer)
    const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
    
    // Attach to request object for use in controllers/services
    (req as any).correlationId = correlationId;
    
    // Add to response headers
    res.setHeader('X-Correlation-ID', correlationId);
    
    // Add to Pino logger context (will be picked up by nestjs-pino)
    (req as any).log = (req as any).log || {};
    (req as any).log.correlationId = correlationId;
    
    next();
  }
}
