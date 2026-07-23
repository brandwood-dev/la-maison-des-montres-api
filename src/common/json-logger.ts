import type { LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context,
      message: this.safeMessage(message),
      ...(trace ? { trace } : {}),
    });
    const output =
      level === 'error' || level === 'fatal' ? console.error : console.log;
    output(entry);
  }

  private safeMessage(message: unknown): string {
    if (message instanceof Error) {
      return message.message;
    }
    return typeof message === 'string' ? message : 'Structured event';
  }
}
