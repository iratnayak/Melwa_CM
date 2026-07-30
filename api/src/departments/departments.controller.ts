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
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';
import { DepartmentsService } from './departments.service';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles('admin')
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateDepartmentDto) {
    return this.departmentsService.create(body, req.user.id);
  }

  @Get()
  list(@Query() query: ListDepartmentsQueryDto) {
    return this.departmentsService.list({
      q: query.q,
      isActive: query.isActive,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.get(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, body, req.user.id);
  }

  @Patch(':id/active')
  @Roles('admin')
  setActive(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetActiveDto,
  ) {
    return this.departmentsService.setActive(id, body.isActive, req.user.id);
  }
}
