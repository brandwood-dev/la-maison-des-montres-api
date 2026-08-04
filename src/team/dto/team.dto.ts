import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { adminRoles } from '../../auth/permissions';

export class CreateTeamInvitationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsIn(adminRoles)
  role!: (typeof adminRoles)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class AcceptTeamInvitationDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsIn(adminRoles)
  role?: (typeof adminRoles)[number];

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
