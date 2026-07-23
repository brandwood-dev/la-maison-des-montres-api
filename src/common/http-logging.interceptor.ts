import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const route = request.route as { path?: string } | undefined;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        finalize: () => {
          this.logger.log(
            JSON.stringify({
              method: request.method,
              path: route?.path ?? request.path,
              status: response.statusCode,
              durationMs: Date.now() - startedAt,
            }),
          );
        },
      }),
    );
  }
}
