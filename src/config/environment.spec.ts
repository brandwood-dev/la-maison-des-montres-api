import { parseOrigins } from './environment';

describe('parseOrigins', () => {
  it('normalizes explicit origins and removes trailing slashes', () => {
    expect(
      parseOrigins('https://admin.example.com/, http://localhost:4173/'),
    ).toEqual(['https://admin.example.com', 'http://localhost:4173']);
  });

  it('rejects wildcard origins when credentials are enabled', () => {
    expect(() => parseOrigins('*')).toThrow(
      'CORS_ORIGINS must contain explicit origins',
    );
  });

  it('rejects origins containing paths or credentials', () => {
    expect(() => parseOrigins('https://example.com/admin')).toThrow(
      'Invalid CORS origin',
    );
    expect(() => parseOrigins('https://user:password@example.com')).toThrow(
      'Invalid CORS origin',
    );
  });
});
