import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../src/auth/auth.constants';

describe('OpenAPI contract (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('documents concrete auth and catalog response schemas', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('La Maison des Montres API')
        .setVersion('1')
        .addCookieAuth(ACCESS_COOKIE, undefined, ACCESS_COOKIE)
        .addCookieAuth(REFRESH_COOKIE, undefined, REFRESH_COOKIE)
        .build(),
    );

    expect(
      jsonSchema(
        document.paths['/api/v1/auth/login']?.post?.responses?.['200'],
      ),
    ).toEqual({ $ref: '#/components/schemas/AuthSessionResponseDto' });
    expect(
      jsonSchema(document.paths['/api/v1/products']?.get?.responses?.['200']),
    ).toEqual({ $ref: '#/components/schemas/ProductPageResponseDto' });
    expect(
      jsonSchema(document.paths['/api/v1/products']?.post?.responses?.['201']),
    ).toEqual({ $ref: '#/components/schemas/ProductResponseDto' });
    expect(document.components?.schemas?.ProductResponseDto).toBeDefined();
    expect(document.components?.securitySchemes).toMatchObject({
      [ACCESS_COOKIE]: { type: 'apiKey', in: 'cookie', name: ACCESS_COOKIE },
      [REFRESH_COOKIE]: { type: 'apiKey', in: 'cookie', name: REFRESH_COOKIE },
    });
  });

  afterAll(async () => {
    await app.close();
  });
});

type OpenApiResponse =
  { $ref: string } | { content?: Record<string, { schema?: unknown }> };

function jsonSchema(response: OpenApiResponse | undefined): unknown {
  if (!response || '$ref' in response) return undefined;
  return response.content?.['application/json']?.schema;
}
