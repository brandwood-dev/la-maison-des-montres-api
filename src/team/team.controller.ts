import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { Public, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  AcceptTeamInvitationDto,
  CreateTeamInvitationDto,
  UpdateTeamMemberDto,
} from './dto/team.dto';
import { TeamService } from './team.service';

@Controller('api/v1/admin/team')
@RequirePermissions('team.manage')
@ApiCookieAuth(ACCESS_COOKIE)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @ApiOkResponse()
  list() {
    return this.team.list();
  }

  @Post('invitations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse()
  invite(
    @Body() input: CreateTeamInvitationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.team.invite(input, request);
  }

  @Post('invitations/:id/resend')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse()
  resend(@Param('id', ParseUUIDPipe) id: string) {
    return this.team.resend(id);
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.team.revoke(id);
  }

  @Patch(':id')
  @ApiOkResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTeamMemberDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.team.updateMember(id, input, request);
  }
}

@Controller('api/v1/auth/invitations')
export class PublicTeamInvitationController {
  constructor(private readonly team: TeamService) {}

  @Public()
  @Post(':token/accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOkResponse()
  accept(
    @Param('token') token: string,
    @Body() input: AcceptTeamInvitationDto,
  ) {
    return this.team.accept(token, input.password);
  }
}
