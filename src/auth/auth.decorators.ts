import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.constants';
import type { Permission } from './permissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...required: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, required);
