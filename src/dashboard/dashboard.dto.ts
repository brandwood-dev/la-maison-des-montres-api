import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class DashboardStatsQueryDto {
  @IsDateString({ strict: true })
  from!: string;

  @IsDateString({ strict: true })
  to!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/)
  timezone = 'Africa/Tunis';
}
