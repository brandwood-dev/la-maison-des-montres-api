import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AUTH_REPOSITORY } from './auth.constants';
import { AuthController } from './auth.controller';
import { AdminAuthGuard } from './auth.guard';
import { DrizzleAuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminAuthGuard,
    PermissionsGuard,
    DrizzleAuthRepository,
    { provide: AUTH_REPOSITORY, useExisting: DrizzleAuthRepository },
  ],
  exports: [AuthService, AdminAuthGuard, PermissionsGuard, AUTH_REPOSITORY],
})
export class AuthModule {}
