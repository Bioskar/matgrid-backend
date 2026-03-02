import { Module } from '@nestjs/common';
import { createBootstrapLogger } from '../../config/logger.config';


@Module({
  providers: [
    {
      provide: 'PINO_LOGGER',
      useValue: createBootstrapLogger(),
    },
  ],
  exports: ['PINO_LOGGER'],
})
export class LoggerProviderModule {}
