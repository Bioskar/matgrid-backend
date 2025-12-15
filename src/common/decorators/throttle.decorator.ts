import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle_key';

/**
 * Custom decorator for rate limiting configuration
 * Usage: @Throttle(3, 60) - 3 requests per 60 seconds
 */
export const Throttle = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_KEY, { limit, ttl });

export interface ThrottleConfig {
  limit: number;
  ttl: number;
}
