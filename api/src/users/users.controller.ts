import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { UserRole } from './user.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateUserDto) {
    return this.usersService.createUser(body, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  list(
    @Query('q') q?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.usersService.listUsers({
      q,
      role,
      isActive:
        typeof isActive === 'string'
          ? isActive === 'true'
          : undefined,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUser(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, body, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/active')
  setActive(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetActiveDto,
  ) {
    return this.usersService.setActive(id, body.isActive, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/reset-password')
  resetPassword(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(id, body.newPassword, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changeOwnPassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    return this.usersService.changeOwnPassword(
      req.user.id,
      body.currentPassword,
      body.newPassword,
      req.user.id,
    );
  }
}

