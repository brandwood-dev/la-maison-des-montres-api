import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudflareAccessService } from './cloudflare-access.service';

describe('CloudflareAccessService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does nothing when the integration is not configured', async () => {
    const service = new CloudflareAccessService(new ConfigService({}));
    await expect(
      service.setEmailAccess('member@example.test', true),
    ).resolves.toBeUndefined();
  });

  it('adds an email to the configured Access group', async () => {
    const service = new CloudflareAccessService(
      new ConfigService({
        CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
        CLOUDFLARE_ACCESS_GROUP_ID: 'group-id',
        CLOUDFLARE_API_TOKEN: 'token',
      }),
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              name: 'Admin Team',
              include: [{ email: { email: 'contact@example.test' } }],
              exclude: [],
              require: [],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, result: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await service.setEmailAccess('member@example.test', true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/access/groups/group-id');
    const requestBody = fetchMock.mock.calls[1]?.[1]?.body;
    expect(typeof requestBody).toBe('string');
    expect(JSON.parse(requestBody as string)).toEqual(
      expect.objectContaining({
        include: [
          { email: { email: 'contact@example.test' } },
          { email: { email: 'member@example.test' } },
        ],
      }),
    );
  });

  it('rejects partial configuration without exposing the token', async () => {
    const service = new CloudflareAccessService(
      new ConfigService({ CLOUDFLARE_API_TOKEN: 'token' }),
    );
    await expect(
      service.setEmailAccess('member@example.test', true),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
