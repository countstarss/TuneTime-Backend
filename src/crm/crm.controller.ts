import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/supabase-auth.guard';
import { CrmAccessGuard } from './crm-access.guard';
import { CrmService } from './crm.service';
import { CreateCrmActivityDto } from './dto/crm-activity.dto';
import { CreateCrmCaseDto, UpdateCrmCaseDto } from './dto/crm-case.dto';
import { CreateCrmLeadDto, UpdateCrmLeadDto } from './dto/crm-lead.dto';
import {
  ListCrmActivitiesQueryDto,
  ListCrmCasesQueryDto,
  ListCrmCustomersQueryDto,
  ListCrmLeadsQueryDto,
  ListCrmOpportunitiesQueryDto,
  ListCrmTasksQueryDto,
} from './dto/crm-query.dto';
import {
  CreateCrmOpportunityDto,
  UpdateCrmOpportunityDto,
} from './dto/crm-opportunity.dto';
import { CreateCrmTaskDto, UpdateCrmTaskDto } from './dto/crm-task.dto';

type RequestWithUser = Request & { user?: { sub?: string } };

@ApiTags('CRM')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, CrmAccessGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  private getActorUserId(req: RequestWithUser) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user not found on request');
    }
    return userId;
  }

  @Get('overview')
  getOverview() {
    return this.crmService.getOverview();
  }

  @Get('customers')
  listCustomers(@Query() query: ListCrmCustomersQueryDto) {
    return this.crmService.listCustomers(query);
  }

  @Get('customers/:guardianProfileId/360')
  getCustomer360(@Param('guardianProfileId') guardianProfileId: string) {
    return this.crmService.getCustomer360(guardianProfileId);
  }

  @Get('leads')
  listLeads(@Query() query: ListCrmLeadsQueryDto) {
    return this.crmService.listLeads(query);
  }

  @Post('leads')
  createLead(@Body() dto: CreateCrmLeadDto, @Req() req: RequestWithUser) {
    return this.crmService.createLead(dto, this.getActorUserId(req));
  }

  @Get('leads/:id')
  getLead(@Param('id') id: string) {
    return this.crmService.getLead(id);
  }

  @Patch('leads/:id')
  updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateCrmLeadDto,
    @Req() req: RequestWithUser,
  ) {
    return this.crmService.updateLead(id, dto, this.getActorUserId(req));
  }

  @Delete('leads/:id')
  removeLead(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.crmService.removeLead(id, this.getActorUserId(req));
  }

  @Get('opportunities')
  listOpportunities(@Query() query: ListCrmOpportunitiesQueryDto) {
    return this.crmService.listOpportunities(query);
  }

  @Post('opportunities')
  createOpportunity(
    @Body() dto: CreateCrmOpportunityDto,
    @Req() req: RequestWithUser,
  ) {
    return this.crmService.createOpportunity(dto, this.getActorUserId(req));
  }

  @Get('opportunities/:id')
  getOpportunity(@Param('id') id: string) {
    return this.crmService.getOpportunity(id);
  }

  @Patch('opportunities/:id')
  updateOpportunity(
    @Param('id') id: string,
    @Body() dto: UpdateCrmOpportunityDto,
    @Req() req: RequestWithUser,
  ) {
    return this.crmService.updateOpportunity(id, dto, this.getActorUserId(req));
  }

  @Delete('opportunities/:id')
  removeOpportunity(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.crmService.removeOpportunity(id, this.getActorUserId(req));
  }

  @Get('tasks')
  listTasks(@Query() query: ListCrmTasksQueryDto) {
    return this.crmService.listTasks(query);
  }

  @Post('tasks')
  createTask(@Body() dto: CreateCrmTaskDto, @Req() req: RequestWithUser) {
    return this.crmService.createTask(dto, this.getActorUserId(req));
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    return this.crmService.getTask(id);
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateCrmTaskDto,
    @Req() req: RequestWithUser,
  ) {
    return this.crmService.updateTask(id, dto, this.getActorUserId(req));
  }

  @Delete('tasks/:id')
  removeTask(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.crmService.removeTask(id, this.getActorUserId(req));
  }

  @Get('activities')
  listActivities(@Query() query: ListCrmActivitiesQueryDto) {
    return this.crmService.listActivities(query);
  }

  @Post('activities')
  createActivity(
    @Body() dto: CreateCrmActivityDto,
    @Req() req: RequestWithUser,
  ) {
    return this.crmService.createActivity(dto, this.getActorUserId(req));
  }

  @Get('activities/:id')
  getActivity(@Param('id') id: string) {
    return this.crmService.getActivity(id);
  }

  @Get('cases')
  listCases(@Query() query: ListCrmCasesQueryDto) {
    return this.crmService.listCases(query);
  }

  @Post('cases')
  createCase(@Body() dto: CreateCrmCaseDto, @Req() req: RequestWithUser) {
    return this.crmService.createCase(dto, this.getActorUserId(req));
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string) {
    return this.crmService.getCase(id);
  }

  @Patch('cases/:id')
  updateCase(
    @Param('id') id: string,
    @Body() dto: UpdateCrmCaseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.crmService.updateCase(id, dto, this.getActorUserId(req));
  }

  @Delete('cases/:id')
  removeCase(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.crmService.removeCase(id, this.getActorUserId(req));
  }
}
