import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CrmActivity,
  CrmActivityType,
  CrmCase,
  CrmCasePriority,
  CrmCaseStatus,
  CrmLead,
  CrmLeadStatus,
  CrmOpportunity,
  CrmOpportunityStage,
  CrmTask,
  CrmTaskPriority,
  CrmTaskStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

const OPEN_OPPORTUNITY_STAGES = [
  CrmOpportunityStage.NEW,
  CrmOpportunityStage.QUALIFIED,
  CrmOpportunityStage.TRIAL_SCHEDULED,
  CrmOpportunityStage.TRIAL_COMPLETED,
] as const;

const ACTIONABLE_TASK_STATUSES = [
  CrmTaskStatus.TODO,
  CrmTaskStatus.IN_PROGRESS,
] as const;

const OPEN_CASE_STATUSES = [
  CrmCaseStatus.OPEN,
  CrmCaseStatus.IN_PROGRESS,
  CrmCaseStatus.WAITING_CUSTOMER,
  CrmCaseStatus.RESOLVED,
] as const;

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return Number(value);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private normalizeTags(tags?: string[]) {
    if (!tags?.length) {
      return [];
    }

    return Array.from(
      new Set(tags.map((item) => item.trim()).filter(Boolean)),
    ).slice(0, 12);
  }

  private normalizeNullableString(value?: string | null) {
    return value?.trim() || null;
  }

  private buildLeadKeywordWhere(
    keyword?: string,
  ): Prisma.CrmLeadWhereInput | undefined {
    const value = keyword?.trim();
    if (!value) {
      return undefined;
    }

    return {
      OR: [
        { fullName: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { wechat: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { city: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { source: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: value, mode: Prisma.QueryMode.insensitive } },
      ],
    };
  }

  private buildOpportunityKeywordWhere(
    keyword?: string,
  ): Prisma.CrmOpportunityWhereInput | undefined {
    const value = keyword?.trim();
    if (!value) {
      return undefined;
    }

    return {
      OR: [
        { title: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { summary: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { lossReason: { contains: value, mode: Prisma.QueryMode.insensitive } },
        {
          guardianProfileId: {
            contains: value,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          studentProfileId: {
            contains: value,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        { bookingId: { contains: value, mode: Prisma.QueryMode.insensitive } },
      ],
    };
  }

  private buildTaskKeywordWhere(
    keyword?: string,
  ): Prisma.CrmTaskWhereInput | undefined {
    const value = keyword?.trim();
    if (!value) {
      return undefined;
    }

    return {
      OR: [
        { title: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: value, mode: Prisma.QueryMode.insensitive } },
      ],
    };
  }

  private buildActivityKeywordWhere(
    keyword?: string,
  ): Prisma.CrmActivityWhereInput | undefined {
    const value = keyword?.trim();
    if (!value) {
      return undefined;
    }

    return {
      content: { contains: value, mode: Prisma.QueryMode.insensitive },
    };
  }

  private buildCaseKeywordWhere(
    keyword?: string,
  ): Prisma.CrmCaseWhereInput | undefined {
    const value = keyword?.trim();
    if (!value) {
      return undefined;
    }

    return {
      OR: [
        { title: { contains: value, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: value, mode: Prisma.QueryMode.insensitive } },
        {
          resolutionSummary: {
            contains: value,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  private async ensureLeadExists(id: string) {
    const lead = await this.prisma.crmLead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException(`未找到 CRM 线索：${id}`);
    }
    return lead;
  }

  private async ensureOpportunityExists(id: string) {
    const opportunity = await this.prisma.crmOpportunity.findUnique({
      where: { id },
    });
    if (!opportunity) {
      throw new NotFoundException(`未找到 CRM 商机：${id}`);
    }
    return opportunity;
  }

  private async ensureTaskExists(id: string) {
    const task = await this.prisma.crmTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`未找到 CRM 任务：${id}`);
    }
    return task;
  }

  private async ensureActivityExists(id: string) {
    const activity = await this.prisma.crmActivity.findUnique({ where: { id } });
    if (!activity) {
      throw new NotFoundException(`未找到 CRM 跟进记录：${id}`);
    }
    return activity;
  }

  private async ensureCaseExists(id: string) {
    const crmCase = await this.prisma.crmCase.findUnique({ where: { id } });
    if (!crmCase) {
      throw new NotFoundException(`未找到 CRM 工单：${id}`);
    }
    return crmCase;
  }

  async logAction(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string | null,
    payload?: Prisma.InputJsonValue,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        payload,
      },
    });
  }

  private toLeadResponse(lead: CrmLead) {
    return {
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      wechat: lead.wechat,
      city: lead.city,
      source: lead.source,
      status: lead.status,
      interestSubjectId: lead.interestSubjectId,
      budgetMin: this.toNumber(lead.budgetMin),
      budgetMax: this.toNumber(lead.budgetMax),
      desiredStartDate: lead.desiredStartDate,
      notes: lead.notes,
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      ownerUserId: lead.ownerUserId,
      convertedGuardianProfileId: lead.convertedGuardianProfileId,
      convertedStudentProfileId: lead.convertedStudentProfileId,
      lastContactedAt: lead.lastContactedAt,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private toOpportunityResponse(opportunity: CrmOpportunity) {
    return {
      id: opportunity.id,
      title: opportunity.title,
      leadId: opportunity.leadId,
      guardianProfileId: opportunity.guardianProfileId,
      studentProfileId: opportunity.studentProfileId,
      teacherProfileId: opportunity.teacherProfileId,
      subjectId: opportunity.subjectId,
      bookingId: opportunity.bookingId,
      stage: opportunity.stage,
      ownerUserId: opportunity.ownerUserId,
      estimatedValue: this.toNumber(opportunity.estimatedValue),
      expectedBookingAt: opportunity.expectedBookingAt,
      nextFollowUpAt: opportunity.nextFollowUpAt,
      summary: opportunity.summary,
      lossReason: opportunity.lossReason,
      lastActivityAt: opportunity.lastActivityAt,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    };
  }

  private toTaskResponse(task: CrmTask) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      leadId: task.leadId,
      opportunityId: task.opportunityId,
      guardianProfileId: task.guardianProfileId,
      bookingId: task.bookingId,
      assigneeUserId: task.assigneeUserId,
      createdByUserId: task.createdByUserId,
      dueAt: task.dueAt,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private toActivityResponse(activity: CrmActivity) {
    return {
      id: activity.id,
      type: activity.type,
      content: activity.content,
      leadId: activity.leadId,
      opportunityId: activity.opportunityId,
      guardianProfileId: activity.guardianProfileId,
      bookingId: activity.bookingId,
      createdByUserId: activity.createdByUserId,
      happenedAt: activity.happenedAt,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
    };
  }

  private toCaseResponse(crmCase: CrmCase) {
    return {
      id: crmCase.id,
      title: crmCase.title,
      description: crmCase.description,
      category: crmCase.category,
      status: crmCase.status,
      priority: crmCase.priority,
      leadId: crmCase.leadId,
      opportunityId: crmCase.opportunityId,
      guardianProfileId: crmCase.guardianProfileId,
      studentProfileId: crmCase.studentProfileId,
      teacherProfileId: crmCase.teacherProfileId,
      bookingId: crmCase.bookingId,
      ownerUserId: crmCase.ownerUserId,
      createdByUserId: crmCase.createdByUserId,
      resolutionSummary: crmCase.resolutionSummary,
      nextActionAt: crmCase.nextActionAt,
      closedAt: crmCase.closedAt,
      createdAt: crmCase.createdAt,
      updatedAt: crmCase.updatedAt,
    };
  }

  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalLeads,
      newLeads,
      qualifiedLeads,
      convertedLeads,
      totalOpportunities,
      openOpportunities,
      wonOpportunities,
      totalTasks,
      overdueTasks,
      dueTodayTasks,
      openCases,
      urgentCases,
      recentActivities,
      nextFollowUps,
    ] = await Promise.all([
      this.prisma.crmLead.count(),
      this.prisma.crmLead.count({ where: { status: CrmLeadStatus.NEW } }),
      this.prisma.crmLead.count({ where: { status: CrmLeadStatus.QUALIFIED } }),
      this.prisma.crmLead.count({ where: { status: CrmLeadStatus.CONVERTED } }),
      this.prisma.crmOpportunity.count(),
      this.prisma.crmOpportunity.count({
        where: { stage: { in: [...OPEN_OPPORTUNITY_STAGES] } },
      }),
      this.prisma.crmOpportunity.count({
        where: { stage: CrmOpportunityStage.WON },
      }),
      this.prisma.crmTask.count({
        where: { status: { not: CrmTaskStatus.CANCELLED } },
      }),
      this.prisma.crmTask.count({
        where: {
          status: { in: [...ACTIONABLE_TASK_STATUSES] },
          dueAt: { lt: now },
        },
      }),
      this.prisma.crmTask.count({
        where: {
          status: { in: [...ACTIONABLE_TASK_STATUSES] },
          dueAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.crmCase.count({
        where: { status: { in: [...OPEN_CASE_STATUSES] } },
      }),
      this.prisma.crmCase.count({
        where: {
          status: { in: [...OPEN_CASE_STATUSES] },
          priority: CrmCasePriority.URGENT,
        },
      }),
      this.prisma.crmActivity.findMany({
        orderBy: { happenedAt: 'desc' },
        take: 8,
      }),
      this.prisma.crmTask.findMany({
        where: { status: { in: [...ACTIONABLE_TASK_STATUSES] } },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 6,
      }),
    ]);

    return {
      metrics: {
        totalLeads,
        newLeads,
        qualifiedLeads,
        convertedLeads,
        totalOpportunities,
        openOpportunities,
        wonOpportunities,
        totalTasks,
        overdueTasks,
        dueTodayTasks,
        openCases,
        urgentCases,
      },
      recentActivities: recentActivities.map((item) => this.toActivityResponse(item)),
      nextFollowUps: nextFollowUps.map((item) => this.toTaskResponse(item)),
    };
  }

  async listLeads(query: ListCrmLeadsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CrmLeadWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId.trim() } : {}),
      ...(this.buildLeadKeywordWhere(query.keyword) ?? {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.crmLead.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.crmLead.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toLeadResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getLead(id: string) {
    const lead = await this.ensureLeadExists(id);
    return this.toLeadResponse(lead);
  }

  async createLead(dto: CreateCrmLeadDto, actorUserId: string) {
    if (dto.budgetMin && dto.budgetMax && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException('budgetMin 不能大于 budgetMax');
    }

    const lead = await this.prisma.crmLead.create({
      data: {
        fullName: dto.fullName.trim(),
        phone: this.normalizeNullableString(dto.phone),
        wechat: this.normalizeNullableString(dto.wechat),
        city: this.normalizeNullableString(dto.city),
        source: this.normalizeNullableString(dto.source),
        status: dto.status ?? CrmLeadStatus.NEW,
        interestSubjectId: this.normalizeNullableString(dto.interestSubjectId),
        budgetMin: dto.budgetMin ?? null,
        budgetMax: dto.budgetMax ?? null,
        desiredStartDate: dto.desiredStartDate
          ? new Date(dto.desiredStartDate)
          : null,
        notes: this.normalizeNullableString(dto.notes),
        tags: this.normalizeTags(dto.tags),
        ownerUserId: this.normalizeNullableString(dto.ownerUserId) || actorUserId,
        convertedGuardianProfileId: this.normalizeNullableString(
          dto.convertedGuardianProfileId,
        ),
        convertedStudentProfileId: this.normalizeNullableString(
          dto.convertedStudentProfileId,
        ),
      },
    });

    await this.logAction(actorUserId, 'crm.lead.create', 'CRM_LEAD', lead.id, {
      fullName: lead.fullName,
      status: lead.status,
    });

    return this.toLeadResponse(lead);
  }

  async updateLead(id: string, dto: UpdateCrmLeadDto, actorUserId: string) {
    await this.ensureLeadExists(id);

    if (dto.budgetMin && dto.budgetMax && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException('budgetMin 不能大于 budgetMax');
    }

    const lead = await this.prisma.crmLead.update({
      where: { id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.phone !== undefined
          ? { phone: this.normalizeNullableString(dto.phone) }
          : {}),
        ...(dto.wechat !== undefined
          ? { wechat: this.normalizeNullableString(dto.wechat) }
          : {}),
        ...(dto.city !== undefined
          ? { city: this.normalizeNullableString(dto.city) }
          : {}),
        ...(dto.source !== undefined
          ? { source: this.normalizeNullableString(dto.source) }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.interestSubjectId !== undefined
          ? {
              interestSubjectId: this.normalizeNullableString(
                dto.interestSubjectId,
              ),
            }
          : {}),
        ...(dto.budgetMin !== undefined ? { budgetMin: dto.budgetMin } : {}),
        ...(dto.budgetMax !== undefined ? { budgetMax: dto.budgetMax } : {}),
        ...(dto.desiredStartDate !== undefined
          ? {
              desiredStartDate: dto.desiredStartDate
                ? new Date(dto.desiredStartDate)
                : null,
            }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: this.normalizeNullableString(dto.notes) }
          : {}),
        ...(dto.tags !== undefined ? { tags: this.normalizeTags(dto.tags) } : {}),
        ...(dto.ownerUserId !== undefined
          ? { ownerUserId: this.normalizeNullableString(dto.ownerUserId) }
          : {}),
        ...(dto.convertedGuardianProfileId !== undefined
          ? {
              convertedGuardianProfileId: this.normalizeNullableString(
                dto.convertedGuardianProfileId,
              ),
            }
          : {}),
        ...(dto.convertedStudentProfileId !== undefined
          ? {
              convertedStudentProfileId: this.normalizeNullableString(
                dto.convertedStudentProfileId,
              ),
            }
          : {}),
      },
    });

    await this.logAction(actorUserId, 'crm.lead.update', 'CRM_LEAD', id, {
      status: lead.status,
    });

    return this.toLeadResponse(lead);
  }

  async removeLead(id: string, actorUserId: string) {
    await this.ensureLeadExists(id);
    await this.prisma.crmLead.delete({ where: { id } });
    await this.logAction(actorUserId, 'crm.lead.delete', 'CRM_LEAD', id);
    return { success: true };
  }

  async listOpportunities(query: ListCrmOpportunitiesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CrmOpportunityWhereInput = {
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId.trim() } : {}),
      ...(this.buildOpportunityKeywordWhere(query.keyword) ?? {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.crmOpportunity.findMany({
        where,
        orderBy: [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.crmOpportunity.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toOpportunityResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getOpportunity(id: string) {
    const opportunity = await this.ensureOpportunityExists(id);
    return this.toOpportunityResponse(opportunity);
  }

  async createOpportunity(dto: CreateCrmOpportunityDto, actorUserId: string) {
    const opportunity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.crmOpportunity.create({
        data: {
          title: dto.title.trim(),
          leadId: this.normalizeNullableString(dto.leadId),
          guardianProfileId: this.normalizeNullableString(dto.guardianProfileId),
          studentProfileId: this.normalizeNullableString(dto.studentProfileId),
          teacherProfileId: this.normalizeNullableString(dto.teacherProfileId),
          subjectId: this.normalizeNullableString(dto.subjectId),
          bookingId: this.normalizeNullableString(dto.bookingId),
          stage: dto.stage ?? CrmOpportunityStage.NEW,
          ownerUserId: this.normalizeNullableString(dto.ownerUserId) || actorUserId,
          estimatedValue: dto.estimatedValue ?? null,
          expectedBookingAt: dto.expectedBookingAt
            ? new Date(dto.expectedBookingAt)
            : null,
          nextFollowUpAt: dto.nextFollowUpAt
            ? new Date(dto.nextFollowUpAt)
            : null,
          summary: this.normalizeNullableString(dto.summary),
          lossReason: this.normalizeNullableString(dto.lossReason),
        },
      });

      if (created.leadId) {
        await tx.crmLead.updateMany({
          where: {
            id: created.leadId,
            status: { in: [CrmLeadStatus.NEW, CrmLeadStatus.CONTACTED] },
          },
          data: { status: CrmLeadStatus.QUALIFIED },
        });
      }

      return created;
    });

    await this.logAction(
      actorUserId,
      'crm.opportunity.create',
      'CRM_OPPORTUNITY',
      opportunity.id,
      { title: opportunity.title, stage: opportunity.stage },
    );

    return this.toOpportunityResponse(opportunity);
  }

  async updateOpportunity(
    id: string,
    dto: UpdateCrmOpportunityDto,
    actorUserId: string,
  ) {
    const current = await this.ensureOpportunityExists(id);

    const opportunity = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.crmOpportunity.update({
        where: { id },
        data: {
          ...(dto.title ? { title: dto.title.trim() } : {}),
          ...(dto.leadId !== undefined
            ? { leadId: this.normalizeNullableString(dto.leadId) }
            : {}),
          ...(dto.guardianProfileId !== undefined
            ? {
                guardianProfileId: this.normalizeNullableString(
                  dto.guardianProfileId,
                ),
              }
            : {}),
          ...(dto.studentProfileId !== undefined
            ? {
                studentProfileId: this.normalizeNullableString(
                  dto.studentProfileId,
                ),
              }
            : {}),
          ...(dto.teacherProfileId !== undefined
            ? {
                teacherProfileId: this.normalizeNullableString(
                  dto.teacherProfileId,
                ),
              }
            : {}),
          ...(dto.subjectId !== undefined
            ? { subjectId: this.normalizeNullableString(dto.subjectId) }
            : {}),
          ...(dto.bookingId !== undefined
            ? { bookingId: this.normalizeNullableString(dto.bookingId) }
            : {}),
          ...(dto.stage ? { stage: dto.stage } : {}),
          ...(dto.ownerUserId !== undefined
            ? { ownerUserId: this.normalizeNullableString(dto.ownerUserId) }
            : {}),
          ...(dto.estimatedValue !== undefined
            ? { estimatedValue: dto.estimatedValue }
            : {}),
          ...(dto.expectedBookingAt !== undefined
            ? {
                expectedBookingAt: dto.expectedBookingAt
                  ? new Date(dto.expectedBookingAt)
                  : null,
              }
            : {}),
          ...(dto.nextFollowUpAt !== undefined
            ? {
                nextFollowUpAt: dto.nextFollowUpAt
                  ? new Date(dto.nextFollowUpAt)
                  : null,
              }
            : {}),
          ...(dto.summary !== undefined
            ? { summary: this.normalizeNullableString(dto.summary) }
            : {}),
          ...(dto.lossReason !== undefined
            ? { lossReason: this.normalizeNullableString(dto.lossReason) }
            : {}),
        },
      });

      if (updated.leadId && updated.stage === CrmOpportunityStage.WON) {
        await tx.crmLead.updateMany({
          where: { id: updated.leadId },
          data: { status: CrmLeadStatus.CONVERTED },
        });
      }

      if (current.leadId && updated.stage === CrmOpportunityStage.LOST) {
        await tx.crmLead.updateMany({
          where: {
            id: current.leadId,
            status: { not: CrmLeadStatus.CONVERTED },
          },
          data: { status: CrmLeadStatus.LOST },
        });
      }

      return updated;
    });

    await this.logAction(
      actorUserId,
      'crm.opportunity.update',
      'CRM_OPPORTUNITY',
      id,
      { stage: opportunity.stage },
    );

    return this.toOpportunityResponse(opportunity);
  }

  async removeOpportunity(id: string, actorUserId: string) {
    await this.ensureOpportunityExists(id);
    await this.prisma.crmOpportunity.delete({ where: { id } });
    await this.logAction(
      actorUserId,
      'crm.opportunity.delete',
      'CRM_OPPORTUNITY',
      id,
    );
    return { success: true };
  }

  async listTasks(query: ListCrmTasksQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CrmTaskWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeUserId
        ? { assigneeUserId: query.assigneeUserId.trim() }
        : {}),
      ...(this.buildTaskKeywordWhere(query.keyword) ?? {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.crmTask.findMany({
        where,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.crmTask.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toTaskResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getTask(id: string) {
    const task = await this.ensureTaskExists(id);
    return this.toTaskResponse(task);
  }

  async createTask(dto: CreateCrmTaskDto, actorUserId: string) {
    const task = await this.prisma.crmTask.create({
      data: {
        title: dto.title.trim(),
        description: this.normalizeNullableString(dto.description),
        status: dto.status ?? CrmTaskStatus.TODO,
        priority: dto.priority ?? CrmTaskPriority.MEDIUM,
        leadId: this.normalizeNullableString(dto.leadId),
        opportunityId: this.normalizeNullableString(dto.opportunityId),
        guardianProfileId: this.normalizeNullableString(dto.guardianProfileId),
        bookingId: this.normalizeNullableString(dto.bookingId),
        assigneeUserId: this.normalizeNullableString(dto.assigneeUserId) || actorUserId,
        createdByUserId: actorUserId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });

    await this.logAction(actorUserId, 'crm.task.create', 'CRM_TASK', task.id, {
      status: task.status,
      priority: task.priority,
    });

    return this.toTaskResponse(task);
  }

  async updateTask(id: string, dto: UpdateCrmTaskDto, actorUserId: string) {
    await this.ensureTaskExists(id);

    const nextStatus = dto.status;
    const task = await this.prisma.crmTask.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: this.normalizeNullableString(dto.description) }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.leadId !== undefined
          ? { leadId: this.normalizeNullableString(dto.leadId) }
          : {}),
        ...(dto.opportunityId !== undefined
          ? { opportunityId: this.normalizeNullableString(dto.opportunityId) }
          : {}),
        ...(dto.guardianProfileId !== undefined
          ? {
              guardianProfileId: this.normalizeNullableString(
                dto.guardianProfileId,
              ),
            }
          : {}),
        ...(dto.bookingId !== undefined
          ? { bookingId: this.normalizeNullableString(dto.bookingId) }
          : {}),
        ...(dto.assigneeUserId !== undefined
          ? {
              assigneeUserId: this.normalizeNullableString(dto.assigneeUserId),
            }
          : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
          : {}),
        ...(nextStatus === CrmTaskStatus.DONE ? { completedAt: new Date() } : {}),
        ...(nextStatus && nextStatus !== CrmTaskStatus.DONE
          ? { completedAt: null }
          : {}),
      },
    });

    await this.logAction(actorUserId, 'crm.task.update', 'CRM_TASK', id, {
      status: task.status,
    });

    return this.toTaskResponse(task);
  }

  async removeTask(id: string, actorUserId: string) {
    await this.ensureTaskExists(id);
    await this.prisma.crmTask.delete({ where: { id } });
    await this.logAction(actorUserId, 'crm.task.delete', 'CRM_TASK', id);
    return { success: true };
  }

  async listActivities(query: ListCrmActivitiesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CrmActivityWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.leadId ? { leadId: query.leadId.trim() } : {}),
      ...(query.opportunityId ? { opportunityId: query.opportunityId.trim() } : {}),
      ...(this.buildActivityKeywordWhere(query.keyword) ?? {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.crmActivity.findMany({
        where,
        orderBy: [{ happenedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.crmActivity.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toActivityResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getActivity(id: string) {
    const activity = await this.ensureActivityExists(id);
    return this.toActivityResponse(activity);
  }

  async createActivity(dto: CreateCrmActivityDto, actorUserId: string) {
    const happenedAt = dto.happenedAt ? new Date(dto.happenedAt) : new Date();

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.crmActivity.create({
        data: {
          type: dto.type,
          content: dto.content.trim(),
          leadId: this.normalizeNullableString(dto.leadId),
          opportunityId: this.normalizeNullableString(dto.opportunityId),
          guardianProfileId: this.normalizeNullableString(dto.guardianProfileId),
          bookingId: this.normalizeNullableString(dto.bookingId),
          createdByUserId: actorUserId,
          happenedAt,
        },
      });

      if (created.leadId) {
        await tx.crmLead.updateMany({
          where: {
            id: created.leadId,
            status: {
              in: [
                CrmLeadStatus.NEW,
                CrmLeadStatus.CONTACTED,
                CrmLeadStatus.QUALIFIED,
              ],
            },
          },
          data: {
            lastContactedAt: happenedAt,
            status: CrmLeadStatus.CONTACTED,
          },
        });
      }

      if (created.opportunityId) {
        await tx.crmOpportunity.updateMany({
          where: { id: created.opportunityId },
          data: { lastActivityAt: happenedAt },
        });
      }

      return created;
    });

    await this.logAction(
      actorUserId,
      'crm.activity.create',
      'CRM_ACTIVITY',
      activity.id,
      { type: activity.type },
    );

    return this.toActivityResponse(activity);
  }

  async listCases(query: ListCrmCasesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CrmCaseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId.trim() } : {}),
      ...(this.buildCaseKeywordWhere(query.keyword) ?? {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.crmCase.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.crmCase.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toCaseResponse(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getCase(id: string) {
    const crmCase = await this.ensureCaseExists(id);
    return this.toCaseResponse(crmCase);
  }

  async createCase(dto: CreateCrmCaseDto, actorUserId: string) {
    const status = dto.status ?? CrmCaseStatus.OPEN;
    const crmCase = await this.prisma.crmCase.create({
      data: {
        title: dto.title.trim(),
        description: this.normalizeNullableString(dto.description),
        category: dto.category,
        status,
        priority: dto.priority ?? CrmCasePriority.MEDIUM,
        leadId: this.normalizeNullableString(dto.leadId),
        opportunityId: this.normalizeNullableString(dto.opportunityId),
        guardianProfileId: this.normalizeNullableString(dto.guardianProfileId),
        studentProfileId: this.normalizeNullableString(dto.studentProfileId),
        teacherProfileId: this.normalizeNullableString(dto.teacherProfileId),
        bookingId: this.normalizeNullableString(dto.bookingId),
        ownerUserId: this.normalizeNullableString(dto.ownerUserId) || actorUserId,
        createdByUserId: actorUserId,
        resolutionSummary: this.normalizeNullableString(dto.resolutionSummary),
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
        closedAt:
          status === CrmCaseStatus.CLOSED
            ? dto.closedAt
              ? new Date(dto.closedAt)
              : new Date()
            : null,
      },
    });

    await this.logAction(actorUserId, 'crm.case.create', 'CRM_CASE', crmCase.id, {
      title: crmCase.title,
      category: crmCase.category,
      status: crmCase.status,
    });

    return this.toCaseResponse(crmCase);
  }

  async updateCase(id: string, dto: UpdateCrmCaseDto, actorUserId: string) {
    await this.ensureCaseExists(id);

    const crmCase = await this.prisma.crmCase.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: this.normalizeNullableString(dto.description) }
          : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.leadId !== undefined
          ? { leadId: this.normalizeNullableString(dto.leadId) }
          : {}),
        ...(dto.opportunityId !== undefined
          ? { opportunityId: this.normalizeNullableString(dto.opportunityId) }
          : {}),
        ...(dto.guardianProfileId !== undefined
          ? {
              guardianProfileId: this.normalizeNullableString(
                dto.guardianProfileId,
              ),
            }
          : {}),
        ...(dto.studentProfileId !== undefined
          ? {
              studentProfileId: this.normalizeNullableString(
                dto.studentProfileId,
              ),
            }
          : {}),
        ...(dto.teacherProfileId !== undefined
          ? {
              teacherProfileId: this.normalizeNullableString(
                dto.teacherProfileId,
              ),
            }
          : {}),
        ...(dto.bookingId !== undefined
          ? { bookingId: this.normalizeNullableString(dto.bookingId) }
          : {}),
        ...(dto.ownerUserId !== undefined
          ? { ownerUserId: this.normalizeNullableString(dto.ownerUserId) }
          : {}),
        ...(dto.resolutionSummary !== undefined
          ? {
              resolutionSummary: this.normalizeNullableString(
                dto.resolutionSummary,
              ),
            }
          : {}),
        ...(dto.nextActionAt !== undefined
          ? {
              nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
            }
          : {}),
        ...(dto.status === CrmCaseStatus.CLOSED
          ? {
              closedAt: dto.closedAt ? new Date(dto.closedAt) : new Date(),
            }
          : {}),
        ...(dto.status && dto.status !== CrmCaseStatus.CLOSED
          ? { closedAt: null }
          : {}),
      },
    });

    await this.logAction(actorUserId, 'crm.case.update', 'CRM_CASE', id, {
      status: crmCase.status,
      priority: crmCase.priority,
    });

    return this.toCaseResponse(crmCase);
  }

  async removeCase(id: string, actorUserId: string) {
    await this.ensureCaseExists(id);
    await this.prisma.crmCase.delete({ where: { id } });
    await this.logAction(actorUserId, 'crm.case.delete', 'CRM_CASE', id);
    return { success: true };
  }

  async listCustomers(query: ListCrmCustomersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const now = new Date();
    const keyword = query.keyword?.trim();

    const where: Prisma.GuardianProfileWhereInput = keyword
      ? {
          OR: [
            {
              displayName: {
                contains: keyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              phone: {
                contains: keyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              students: {
                some: {
                  studentProfile: {
                    displayName: {
                      contains: keyword,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
              },
            },
          ],
        }
      : {};

    const [guardians, total] = await Promise.all([
      this.prisma.guardianProfile.findMany({
        where,
        include: {
          defaultServiceAddress: true,
          students: {
            include: {
              studentProfile: {
                select: { id: true, displayName: true },
              },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.guardianProfile.count({ where }),
    ]);

    const guardianIds = guardians.map((item) => item.id);

    if (!guardianIds.length) {
      return {
        items: [],
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    const [bookingAggs, upcomingAggs, opportunityAggs, taskAggs, caseAggs, activityAggs] =
      await Promise.all([
        this.prisma.booking.groupBy({
          by: ['guardianProfileId'],
          where: { guardianProfileId: { in: guardianIds } },
          _count: { _all: true },
          _max: { startAt: true },
        }),
        this.prisma.booking.groupBy({
          by: ['guardianProfileId'],
          where: {
            guardianProfileId: { in: guardianIds },
            startAt: { gte: now },
            status: {
              in: [
                BookingStatus.PENDING_ACCEPTANCE,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED,
                BookingStatus.IN_PROGRESS,
              ],
            },
          },
          _count: { _all: true },
        }),
        this.prisma.crmOpportunity.groupBy({
          by: ['guardianProfileId'],
          where: {
            guardianProfileId: { in: guardianIds },
            stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
          },
          _count: { _all: true },
        }),
        this.prisma.crmTask.groupBy({
          by: ['guardianProfileId'],
          where: {
            guardianProfileId: { in: guardianIds },
            status: { in: [...ACTIONABLE_TASK_STATUSES] },
          },
          _count: { _all: true },
        }),
        this.prisma.crmCase.groupBy({
          by: ['guardianProfileId'],
          where: {
            guardianProfileId: { in: guardianIds },
            status: { in: [...OPEN_CASE_STATUSES] },
          },
          _count: { _all: true },
        }),
        this.prisma.crmActivity.groupBy({
          by: ['guardianProfileId'],
          where: { guardianProfileId: { in: guardianIds } },
          _max: { happenedAt: true },
        }),
      ]);

    const bookingMap = new Map(
      bookingAggs.map((item) => [item.guardianProfileId, item]),
    );
    const upcomingMap = new Map(
      upcomingAggs.map((item) => [item.guardianProfileId, item]),
    );
    const opportunityMap = new Map(
      opportunityAggs.map((item) => [item.guardianProfileId, item]),
    );
    const taskMap = new Map(taskAggs.map((item) => [item.guardianProfileId, item]));
    const caseMap = new Map(caseAggs.map((item) => [item.guardianProfileId, item]));
    const activityMap = new Map(
      activityAggs.map((item) => [item.guardianProfileId, item]),
    );

    return {
      items: guardians.map((guardian) => ({
        guardianProfileId: guardian.id,
        displayName: guardian.displayName,
        phone: guardian.phone,
        city: guardian.defaultServiceAddress?.city ?? null,
        district: guardian.defaultServiceAddress?.district ?? null,
        studentNames: guardian.students.map((item) => item.studentProfile.displayName),
        linkedStudentsCount: guardian.students.length,
        totalBookings: bookingMap.get(guardian.id)?._count._all ?? 0,
        upcomingBookings: upcomingMap.get(guardian.id)?._count._all ?? 0,
        activeOpportunities: opportunityMap.get(guardian.id)?._count._all ?? 0,
        openTasks: taskMap.get(guardian.id)?._count._all ?? 0,
        openCases: caseMap.get(guardian.id)?._count._all ?? 0,
        lastBookingAt: bookingMap.get(guardian.id)?._max.startAt ?? null,
        lastActivityAt: activityMap.get(guardian.id)?._max.happenedAt ?? null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getCustomer360(guardianProfileId: string) {
    const guardian = await this.prisma.guardianProfile.findUnique({
      where: { id: guardianProfileId },
      include: {
        defaultServiceAddress: true,
        students: {
          include: {
            studentProfile: {
              select: {
                id: true,
                displayName: true,
                gradeLevel: true,
                schoolName: true,
                learningGoals: true,
              },
            },
          },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException(`未找到客户档案：${guardianProfileId}`);
    }

    const leadWhere: Prisma.CrmLeadWhereInput = guardian.phone
      ? {
          OR: [
            { convertedGuardianProfileId: guardianProfileId },
            { phone: guardian.phone },
          ],
        }
      : { convertedGuardianProfileId: guardianProfileId };

    const leads = await this.prisma.crmLead.findMany({
      where: leadWhere,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    });

    const leadIds = leads.map((item) => item.id);

    const opportunityWhere: Prisma.CrmOpportunityWhereInput = {
      OR: [
        { guardianProfileId },
        ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
      ],
    };

    const [
      opportunities,
      tasks,
      activities,
      cases,
      recentBookings,
      recentLessons,
      reviews,
      totalBookings,
      completedLessons,
      averageReview,
      openTaskCount,
      openCaseCount,
    ] = await Promise.all([
      this.prisma.crmOpportunity.findMany({
        where: opportunityWhere,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.crmTask.findMany({
        where: {
          OR: [
            { guardianProfileId },
            ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
          ],
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.crmActivity.findMany({
        where: {
          OR: [
            { guardianProfileId },
            ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
          ],
        },
        orderBy: [{ happenedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      this.prisma.crmCase.findMany({
        where: {
          OR: [
            { guardianProfileId },
            ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.booking.findMany({
        where: { guardianProfileId },
        include: {
          subject: { select: { id: true, name: true } },
          teacherProfile: { select: { id: true, displayName: true } },
          studentProfile: { select: { id: true, displayName: true } },
        },
        orderBy: { startAt: 'desc' },
        take: 8,
      }),
      this.prisma.lesson.findMany({
        where: { booking: { guardianProfileId } },
        include: {
          booking: { select: { bookingNo: true, startAt: true } },
          teacherProfile: { select: { id: true, displayName: true } },
          studentProfile: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.teacherReview.findMany({
        where: { guardianProfileId },
        include: {
          teacherProfile: { select: { id: true, displayName: true } },
          studentProfile: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.booking.count({ where: { guardianProfileId } }),
      this.prisma.lesson.count({ where: { booking: { guardianProfileId } } }),
      this.prisma.teacherReview.aggregate({
        where: { guardianProfileId },
        _avg: { rating: true },
      }),
      this.prisma.crmTask.count({
        where: {
          guardianProfileId,
          status: { in: [...ACTIONABLE_TASK_STATUSES] },
        },
      }),
      this.prisma.crmCase.count({
        where: {
          guardianProfileId,
          status: { in: [...OPEN_CASE_STATUSES] },
        },
      }),
    ]);

    return {
      customer: {
        guardianProfileId: guardian.id,
        displayName: guardian.displayName,
        phone: guardian.phone,
        emergencyContactName: guardian.emergencyContactName,
        emergencyContactPhone: guardian.emergencyContactPhone,
        defaultAddress: guardian.defaultServiceAddress
          ? {
              city: guardian.defaultServiceAddress.city,
              district: guardian.defaultServiceAddress.district,
              street: guardian.defaultServiceAddress.street,
              building: guardian.defaultServiceAddress.building,
            }
          : null,
      },
      students: guardian.students.map((item) => ({
        id: item.studentProfile.id,
        displayName: item.studentProfile.displayName,
        gradeLevel: item.studentProfile.gradeLevel,
        schoolName: item.studentProfile.schoolName,
        learningGoals: item.studentProfile.learningGoals,
      })),
      metrics: {
        totalBookings,
        completedLessons,
        averageReviewRating: averageReview._avg.rating
          ? Number(averageReview._avg.rating.toFixed(2))
          : null,
        openTasks: openTaskCount,
        openCases: openCaseCount,
      },
      crm: {
        leads: leads.map((item) => this.toLeadResponse(item)),
        opportunities: opportunities.map((item) => this.toOpportunityResponse(item)),
        tasks: tasks.map((item) => this.toTaskResponse(item)),
        activities: activities.map((item) => this.toActivityResponse(item)),
        cases: cases.map((item) => this.toCaseResponse(item)),
      },
      bookings: recentBookings.map((item) => ({
        id: item.id,
        bookingNo: item.bookingNo,
        status: item.status,
        startAt: item.startAt,
        endAt: item.endAt,
        totalAmount: this.toNumber(item.totalAmount),
        paymentStatus: item.paymentStatus,
        isTrial: item.isTrial,
        subject: item.subject,
        teacher: item.teacherProfile,
        student: item.studentProfile,
      })),
      lessons: recentLessons.map((item) => ({
        id: item.id,
        attendanceStatus: item.attendanceStatus,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        teacherSummary: item.teacherSummary,
        homework: item.homework,
        booking: item.booking,
        teacher: item.teacherProfile,
        student: item.studentProfile,
      })),
      reviews: reviews.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        tags: Array.isArray(item.tags) ? item.tags : [],
        createdAt: item.createdAt,
        teacher: item.teacherProfile,
        student: item.studentProfile,
      })),
    };
  }
}
