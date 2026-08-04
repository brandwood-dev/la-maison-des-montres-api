import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { TEAM_REPOSITORY } from './team.constants';
import {
  TeamController,
  PublicTeamInvitationController,
} from './team.controller';
import { DrizzleTeamRepository } from './team.repository';
import { TeamService } from './team.service';

@Module({
  imports: [AuthModule, EmailModule, AccessModule],
  controllers: [TeamController, PublicTeamInvitationController],
  providers: [
    TeamService,
    DrizzleTeamRepository,
    { provide: TEAM_REPOSITORY, useExisting: DrizzleTeamRepository },
  ],
  exports: [TeamService],
})
export class TeamModule {}
