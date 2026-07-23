import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    details?: unknown,
  ) {
    const body: ApiErrorBody = { code, message };
    if (details !== undefined) {
      body.details = details;
    }
    super(body, status);
  }
}
