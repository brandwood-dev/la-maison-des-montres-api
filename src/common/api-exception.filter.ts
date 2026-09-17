import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody } from './api-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    if (response.headersSent || response.writableEnded || response.destroyed) {
      // Ignore late exceptions after a serverless response timed out or closed.
      return;
    }
    this.logUnexpectedException(exception);
    const databaseError = this.databaseError(exception);
    const status = databaseError
      ? databaseError.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    response
      .status(status)
      .json(databaseError?.body ?? this.toBody(raw, status));
  }

  private logUnexpectedException(exception: unknown): void {
    if (exception instanceof HttpException) return;
    const value =
      exception && typeof exception === 'object'
        ? (exception as { name?: unknown; code?: unknown; cause?: unknown })
        : undefined;
    const cause =
      value?.cause && typeof value.cause === 'object'
        ? (value.cause as { name?: unknown; code?: unknown })
        : undefined;
    const rawMessage = exception instanceof Error ? exception.message : '';
    const message = rawMessage.toLowerCase();
    const category = /password|authentication|invalid authorization/.test(
      message,
    )
      ? 'database_authentication'
      : /timeout|timed out|connect|socket|econn|enotfound/.test(message)
        ? 'database_connection'
        : /does not exist|undefined table|undefined column/.test(message)
          ? 'database_schema'
          : /constraint|foreign key|duplicate|violates/.test(message)
            ? 'database_constraint'
            : 'unknown';
    // Keep production diagnostics useful without logging SQL, connection
    // strings, request payloads, or any other potentially sensitive detail.
    console.error(
      JSON.stringify({
        type: typeof exception,
        name: typeof value?.name === 'string' ? value.name : 'UnknownError',
        code: typeof value?.code === 'string' ? value.code : undefined,
        causeName: typeof cause?.name === 'string' ? cause.name : undefined,
        causeCode: typeof cause?.code === 'string' ? cause.code : undefined,
        category,
        keys:
          exception && typeof exception === 'object'
            ? Object.keys(exception).slice(0, 20)
            : [],
        hasMessage: Boolean(rawMessage),
      }),
    );
  }

  private databaseError(
    exception: unknown,
  ): { status: HttpStatus; body: ApiErrorBody } | null {
    const details = this.databaseErrorDetails(exception);
    if (!details) return null;
    const { code, constraint } = details;
    if (code === '23505') {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          code: 'RESOURCE_CONFLICT',
          message: this.conflictMessage(constraint),
        },
      };
    }
    if (code === '23503') {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          code: 'RESOURCE_IN_USE',
          message: 'Resource is referenced by another resource',
        },
      };
    }
    if (code === '23514') {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'Database constraint rejected the request',
        },
      };
    }
    return null;
  }

  /**
   * postgres-js normally exposes the SQLSTATE on the thrown error itself, but
   * adapters and transaction wrappers may put it on `cause` (or `original`
   * error). Walk only a short, known chain so database failures never fall
   * through to a misleading 500 response.
   */
  private databaseErrorDetails(
    exception: unknown,
  ): { code: string; constraint?: string } | null {
    let current: unknown = exception;
    for (let depth = 0; depth < 4; depth += 1) {
      if (!current || typeof current !== 'object') return null;
      const value = current as {
        code?: unknown;
        constraint?: unknown;
        constraint_name?: unknown;
        cause?: unknown;
        original?: unknown;
      };
      if (typeof value.code === 'string' && /^23\d{3}$/.test(value.code)) {
        const constraint =
          typeof value.constraint === 'string'
            ? value.constraint
            : typeof value.constraint_name === 'string'
              ? value.constraint_name
              : undefined;
        return {
          code: value.code,
          ...(constraint ? { constraint } : {}),
        };
      }
      current = value.cause ?? value.original;
    }
    return null;
  }

  private conflictMessage(constraint?: string): string {
    switch (constraint) {
      case 'brands_name_unique':
        return 'Une marque avec ce nom existe déjà.';
      case 'brands_slug_unique':
        return 'Une marque avec ce slug existe déjà.';
      case 'categories_slug_unique':
        return 'Une catégorie avec ce slug existe déjà.';
      case 'attributes_slug_unique':
        return 'Un attribut avec cet identifiant existe déjà.';
      case 'attribute_values_attribute_slug_unique':
        return 'Cette valeur existe déjà pour cet attribut.';
      case 'promo_banner_messages_message_unique':
        return 'Ce message promotionnel existe déjà.';
      case 'products_reference_unique':
        return 'Cette référence produit existe déjà.';
      case 'products_seo_slug_unique':
        return 'Ce slug produit existe déjà.';
      default:
        return 'Cette ressource existe déjà.';
    }
  }

  private toBody(raw: unknown, status: number): ApiErrorBody {
    if (raw && typeof raw === 'object' && 'code' in raw && 'message' in raw) {
      return raw as ApiErrorBody;
    }
    if (typeof raw === 'string') {
      return { code: `HTTP_${status}`, message: raw };
    }
    if (
      raw &&
      typeof raw === 'object' &&
      'message' in raw &&
      typeof raw.message === 'string'
    ) {
      return { code: `HTTP_${status}`, message: raw.message };
    }
    return status >= 500
      ? { code: 'INTERNAL_ERROR', message: 'Internal server error' }
      : { code: `HTTP_${status}`, message: 'Request failed' };
  }
}
