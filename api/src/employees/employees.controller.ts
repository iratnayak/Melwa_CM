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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles('admin')
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateEmployeeDto) {
    return this.employeesService.create(body, req.user.id);
  }

  @Get()
  list(@Query() query: ListEmployeesQueryDto) {
    return this.employeesService.list({
      q: query.q,
      departmentId: query.departmentId,
      isActive: query.isActive,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.get(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, body, req.user.id);
  }

  @Patch(':id/active')
  @Roles('admin')
  setActive(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetActiveDto,
  ) {
    return this.employeesService.setActive(id, body.isActive, req.user.id);
  }
}
