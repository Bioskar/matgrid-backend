import { BadRequestException } from '@nestjs/common';

export function assertAllowedQueryKeys(
  rawQuery: Record<string, any>,
  allowedKeys: string[],
): void {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(rawQuery || {}).filter(
    (key) => !allowed.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Unsupported query parameter(s): ${unknownKeys.join(', ')}`,
    );
  }
}
