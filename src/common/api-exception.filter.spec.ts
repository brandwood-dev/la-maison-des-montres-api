import { HttpStatus } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  function response() {
    const result = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      status: jest.fn(),
      json: jest.fn(),
    };
    result.status.mockReturnValue(result);
    return result;
  }

  function host(result: ReturnType<typeof response>) {
    return {
      switchToHttp: () => ({ getResponse: () => result }),
    } as never;
  }

  it('maps a duplicate constraint nested in a provider cause to 409', () => {
    const result = response();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    new ApiExceptionFilter().catch(
      {
        name: 'DatabaseErrorWrapper',
        cause: { code: '23505', constraint_name: 'brands_name_unique' },
      },
      host(result),
    );

    expect(result.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(result.json).toHaveBeenCalledWith({
      code: 'RESOURCE_CONFLICT',
      message: 'Une marque avec ce nom existe déjà.',
    });
  });

  it('maps a direct foreign-key violation to a safe conflict response', () => {
    const result = response();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    new ApiExceptionFilter().catch({ code: '23503' }, host(result));

    expect(result.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(result.json).toHaveBeenCalledWith({
      code: 'RESOURCE_IN_USE',
      message: 'Resource is referenced by another resource',
    });
  });
});
