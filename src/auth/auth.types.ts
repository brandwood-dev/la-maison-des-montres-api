import type { Request } from 'express';
import type { AdminRole, Permission } from './permissions';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: AdminRole;
  status: 'active' | 'pending' | 'disabled';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  admin?: AuthenticatedAdmin;
  permissions?: readonly Permission[];
}

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  type: 'refresh';
}
