import { getThrottlerTracker } from './throttling';

describe('getThrottlerTracker', () => {
  it('uses the real client address and scopes login attempts by e-mail', () => {
    expect(
      getThrottlerTracker(
        {
          headers: {
            'cf-connecting-ip': '203.0.113.10',
            'x-forwarded-for': '198.51.100.2',
          },
          body: { email: ' Admin@Example.test ' },
        },
        {} as never,
      ),
    ).toBe('203.0.113.10:login:admin@example.test');
  });

  it('falls back to the first forwarded address for non-login requests', () => {
    expect(
      getThrottlerTracker(
        {
          headers: { 'x-forwarded-for': '198.51.100.2, 198.51.100.3' },
          body: {},
        },
        {} as never,
      ),
    ).toBe('198.51.100.2');
  });
});
