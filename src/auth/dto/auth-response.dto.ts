import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { adminRoles, permissions } from '../permissions';

export class AdminUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional({ format: 'uri' })
  avatarUrl?: string;

  @ApiProperty({ enum: adminRoles })
  role!: (typeof adminRoles)[number];

  @ApiProperty({ enum: ['active', 'pending', 'disabled'] })
  status!: 'active' | 'pending' | 'disabled';

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lastLoginAt?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: AdminUserResponseDto })
  user!: AdminUserResponseDto;

  @ApiProperty({ enum: permissions, isArray: true })
  permissions!: (typeof permissions)[number][];
}
