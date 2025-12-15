import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  @Redirect()
  root() {
    const isDev = process.env.NODE_ENV !== 'production';
    return {
      url: isDev ? '/api/docs' : '/health',
      statusCode: 302,
    };
  }

  @Get('favicon.ico')
  favicon() {
    return;
  }
}
