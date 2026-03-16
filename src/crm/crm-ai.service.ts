import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CrmActionRiskLevel,
  CrmActionRunStatus,
  CrmActivityType,
  CrmCaseCategory,
  CrmCasePriority,
  CrmOpportunityStage,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecuteCrmAiActionDto, InterpretCrmAiInstructionDto } from './dto/crm-ai.dto';
import { CrmService } from './crm.service';

type SupportedActionKey =
  | 'crm.lead.create'
  | 'crm.task.create'
  | 'crm.activity.create'
  | 'crm.case.create'
  | 'crm.opportunity.advance'
  | 'crm.lead.delete';

type ActionCatalogItem = {
  key: SupportedActionKey;
  label: string;
  description: string;
  riskLevel: CrmActionRiskLevel;
  requiresApproval: boolean;
  requiredFields: string[];
  examples: string[];
};

type InterpretResult = {
  instruction: string;
  actionKey: SupportedActionKey | null;
  actionLabel: string | null;
  riskLevel: CrmActionRiskLevel;
  requiresApproval: boolean;
  confidence: number;
  rationale: string;
  missingFields: string[];
  payload: Record<string, unknown>;
  candidates: Record<string, unknown[]>;
  executable: boolean;
};

const ACTION_CATALOG: ActionCatalogItem[] = [
  {
    key: 'crm.lead.create',
    label: '创建线索',
    description: '新增一条家长/客户线索，补充电话、城市、来源和备注。',
    riskLevel: CrmActionRiskLevel.LOW,
    requiresApproval: false,
    requiredFields: ['fullName'],
    examples: [
      '为王女士创建线索，电话13800138000，城市天津，来源小红书',
      '新建线索：李先生，备注孩子 8 岁想学钢琴',
    ],
  },
  {
    key: 'crm.task.create',
    label: '创建任务',
    description: '创建待回访/待处理任务，可关联线索并设置截止时间。',
    riskLevel: CrmActionRiskLevel.LOW,
    requiresApproval: false,
    requiredFields: ['title'],
    examples: [
      '给王女士建一个回访任务，明天下午 3 点联系',
      '创建任务：跟进试听安排',
    ],
  },
  {
    key: 'crm.activity.create',
    label: '写入跟进',
    description: '为线索或客户写备注、电话、微信等跟进记录。',
    riskLevel: CrmActionRiskLevel.LOW,
    requiresApproval: false,
    requiredFields: ['content'],
    examples: [
      '给王女士记一条备注：家长更关注上门时间',
      '记录电话跟进：客户希望周末试听',
    ],
  },
  {
    key: 'crm.case.create',
    label: '创建工单',
    description: '发起投诉、改约、退款、换老师等售后工单。',
    riskLevel: CrmActionRiskLevel.MEDIUM,
    requiresApproval: false,
    requiredFields: ['title', 'category'],
    examples: [
      '为王女士创建退款工单，原因是老师临时请假',
      '发起改约工单：周六课程改到周日',
    ],
  },
  {
    key: 'crm.opportunity.advance',
    label: '推进商机阶段',
    description: '把商机推进到资格化、试听已排、试听完成、成单或输单。',
    riskLevel: CrmActionRiskLevel.MEDIUM,
    requiresApproval: false,
    requiredFields: ['opportunityId', 'stage'],
    examples: [
      '把王女士钢琴试听商机推进到试听已排',
      '将李先生首单商机标记为成单',
    ],
  },
  {
    key: 'crm.lead.delete',
    label: '删除线索',
    description: '删除 CRM 线索。该动作不可逆，必须明确人工授权。',
    riskLevel: CrmActionRiskLevel.HIGH,
    requiresApproval: true,
    requiredFields: ['leadId'],
    examples: ['删除线索：王女士', '把 13800138000 这条重复线索删掉'],
  },
];

@Injectable()
export class CrmAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
  ) {}

  listActions() {
    return ACTION_CATALOG;
  }

  async interpret(dto: InterpretCrmAiInstructionDto) {
    return this.interpretInstruction(dto.instruction);
  }

  async execute(dto: ExecuteCrmAiActionDto, actorUserId: string) {
    const catalog = ACTION_CATALOG.find((item) => item.key === dto.actionKey);
    if (!catalog) {
      throw new BadRequestException(`不支持的 CRM 动作：${dto.actionKey}`);
    }

    const interpreted = dto.instruction
      ? await this.interpretInstruction(dto.instruction, catalog.key)
      : null;

    const payload = {
      ...(interpreted?.payload ?? {}),
      ...(dto.payload ?? {}),
    } as Record<string, unknown>;

    const missingFields = catalog.requiredFields.filter((field) => {
      const value = payload[field];
      if (typeof value === 'string') {
        return !value.trim();
      }
      return value === undefined || value === null;
    });

    const preview = {
      actionKey: catalog.key,
      actionLabel: catalog.label,
      riskLevel: catalog.riskLevel,
      requiresApproval: catalog.requiresApproval,
      payload,
      missingFields,
      executable: missingFields.length === 0,
    };

    if (dto.dryRun !== false || missingFields.length > 0) {
      const run = await this.crmService.recordActionRun({
        instruction: dto.instruction ?? null,
        actionKey: catalog.key,
        status: CrmActionRunStatus.PREVIEW,
        riskLevel: catalog.riskLevel,
        requiresApproval: catalog.requiresApproval,
        executedByUserId: actorUserId,
        payload,
        result: preview,
      });

      return {
        executed: false,
        approvalRequired: catalog.requiresApproval,
        preview,
        run,
      };
    }

    if (catalog.requiresApproval && !dto.approved) {
      const run = await this.crmService.recordActionRun({
        instruction: dto.instruction ?? null,
        actionKey: catalog.key,
        status: CrmActionRunStatus.APPROVAL_REQUIRED,
        riskLevel: catalog.riskLevel,
        requiresApproval: true,
        executedByUserId: actorUserId,
        payload,
        result: preview,
      });

      return {
        executed: false,
        approvalRequired: true,
        preview,
        run,
      };
    }

    try {
      const result = await this.executeAction(catalog.key, payload, actorUserId);
      const entity = this.extractEntityReference(catalog.key, result, payload);

      const run = await this.crmService.recordActionRun({
        instruction: dto.instruction ?? null,
        actionKey: catalog.key,
        status: CrmActionRunStatus.EXECUTED,
        riskLevel: catalog.riskLevel,
        requiresApproval: catalog.requiresApproval,
        approvedByUserId: dto.approved ? actorUserId : null,
        executedByUserId: actorUserId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        payload,
        result,
      });

      return {
        executed: true,
        approvalRequired: false,
        result,
        run,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CRM AI action failed';
      await this.crmService.recordActionRun({
        instruction: dto.instruction ?? null,
        actionKey: catalog.key,
        status: CrmActionRunStatus.FAILED,
        riskLevel: catalog.riskLevel,
        requiresApproval: catalog.requiresApproval,
        approvedByUserId: dto.approved ? actorUserId : null,
        executedByUserId: actorUserId,
        payload,
        result: { message },
      });
      throw error;
    }
  }

  private async interpretInstruction(
    instruction: string,
    forcedActionKey?: SupportedActionKey,
  ): Promise<InterpretResult> {
    const normalized = instruction.trim();
    const action =
      (forcedActionKey
        ? ACTION_CATALOG.find((item) => item.key === forcedActionKey)
        : this.detectAction(normalized)) ?? null;

    if (!action) {
      return {
        instruction: normalized,
        actionKey: null,
        actionLabel: null,
        riskLevel: CrmActionRiskLevel.LOW,
        requiresApproval: false,
        confidence: 0.2,
        rationale: '当前语句还不足以映射到受控 CRM 动作。',
        missingFields: [],
        payload: {},
        candidates: {},
        executable: false,
      };
    }

    const parsed = await this.buildPayloadForAction(action.key, normalized);
    const missingFields = action.requiredFields.filter((field) => {
      const value = parsed.payload[field];
      if (typeof value === 'string') {
        return !value.trim();
      }
      return value === undefined || value === null;
    });

    return {
      instruction: normalized,
      actionKey: action.key,
      actionLabel: action.label,
      riskLevel: action.riskLevel,
      requiresApproval: action.requiresApproval,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      missingFields,
      payload: parsed.payload,
      candidates: parsed.candidates,
      executable: missingFields.length === 0,
    };
  }

  private detectAction(input: string) {
    if (/(删除).*(线索)|线索.*删除/.test(input)) {
      return ACTION_CATALOG.find((item) => item.key === 'crm.lead.delete');
    }

    if (/(工单|投诉|退款|改约|改期|换老师|售后)/.test(input)) {
      return ACTION_CATALOG.find((item) => item.key === 'crm.case.create');
    }

    if (/(商机).*(推进|成单|输单|试听|资格化)|推进.*商机/.test(input)) {
      return ACTION_CATALOG.find((item) => item.key === 'crm.opportunity.advance');
    }

    if (/(任务|提醒|回访)/.test(input)) {
      return ACTION_CATALOG.find((item) => item.key === 'crm.task.create');
    }

    if (/(备注|跟进|电话|微信|记录)/.test(input)) {
      return ACTION_CATALOG.find((item) => item.key === 'crm.activity.create');
    }

    if (/(新建|创建).*(线索)|线索.*(新建|创建)/.test(input)) {
      return ACTION_CATALOG.find((item) => item.key === 'crm.lead.create');
    }

    return null;
  }

  private extractQuotedText(input: string) {
    const match = input.match(/[“"']([^“"']{2,200})[”"']/);
    return match?.[1]?.trim() || null;
  }

  private extractPhone(input: string) {
    return input.match(/1\d{10}/)?.[0] ?? null;
  }

  private extractField(input: string, labels: string[]) {
    for (const label of labels) {
      const regex = new RegExp(`${label}[：:]?\s*([^，,。；;\n]+)`, 'i');
      const match = input.match(regex);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private extractName(input: string) {
    return (
      this.extractField(input, ['姓名', '名字', '家长', '客户', '线索']) ||
      input.match(/为([^，,。；;\s]{2,12})(?:创建|新建|发起|安排|记一条|建一个)/)?.[1] ||
      input.match(/给([^，,。；;\s]{2,12})(?:建一个|记一条|创建|发起)/)?.[1] ||
      null
    );
  }

  private extractDateTime(input: string) {
    const isoMatch = input.match(/(20\d{2}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (isoMatch) {
      const hour = isoMatch[2] ? Number(isoMatch[2]) : 10;
      const minute = isoMatch[3] ? Number(isoMatch[3]) : 0;
      const date = new Date(`${isoMatch[1]}T00:00:00+08:00`);
      date.setHours(hour, minute, 0, 0);
      return date.toISOString();
    }

    const relativeMatch = input.match(/(今天|明天|后天)(?:\s*(上午|中午|下午|晚上))?(?:\s*(\d{1,2})(?:[:点时](\d{1,2}))?)?/);
    if (relativeMatch) {
      const now = new Date();
      const date = new Date(now);
      const offsetMap: Record<string, number> = {
        今天: 0,
        明天: 1,
        后天: 2,
      };
      date.setDate(date.getDate() + (offsetMap[relativeMatch[1]] ?? 0));
      let hour = relativeMatch[3] ? Number(relativeMatch[3]) : 10;
      const minute = relativeMatch[4] ? Number(relativeMatch[4]) : 0;
      const dayPart = relativeMatch[2];
      if ((dayPart === '下午' || dayPart === '晚上') && hour < 12) {
        hour += 12;
      }
      if (dayPart === '中午' && hour < 11) {
        hour = 12;
      }
      date.setHours(hour, minute, 0, 0);
      return date.toISOString();
    }

    return null;
  }

  private detectActivityType(input: string): CrmActivityType {
    if (input.includes('电话')) {
      return CrmActivityType.CALL;
    }
    if (input.includes('微信')) {
      return CrmActivityType.WECHAT;
    }
    if (input.includes('跟进')) {
      return CrmActivityType.FOLLOW_UP;
    }
    return CrmActivityType.NOTE;
  }

  private detectCaseCategory(input: string): CrmCaseCategory {
    if (/(退款|退费)/.test(input)) {
      return CrmCaseCategory.REFUND;
    }
    if (/(投诉|不满意)/.test(input)) {
      return CrmCaseCategory.COMPLAINT;
    }
    if (/(改约|改期|时间调整|调课)/.test(input)) {
      return CrmCaseCategory.SCHEDULE_CHANGE;
    }
    if (/(换老师|更换老师)/.test(input)) {
      return CrmCaseCategory.TEACHER_CHANGE;
    }
    if (/(支付|付款|账单)/.test(input)) {
      return CrmCaseCategory.PAYMENT;
    }
    return CrmCaseCategory.OTHER;
  }

  private detectOpportunityStage(input: string) {
    if (/(成单|成交|赢单|首单完成)/.test(input)) {
      return CrmOpportunityStage.WON;
    }
    if (/(输单|丢单|流失)/.test(input)) {
      return CrmOpportunityStage.LOST;
    }
    if (/(试听完成)/.test(input)) {
      return CrmOpportunityStage.TRIAL_COMPLETED;
    }
    if (/(试听已排|安排试听|预约试听)/.test(input)) {
      return CrmOpportunityStage.TRIAL_SCHEDULED;
    }
    if (/(资格化|已资格化)/.test(input)) {
      return CrmOpportunityStage.QUALIFIED;
    }
    return null;
  }

  private async resolveLead(reference: string | null) {
    if (!reference) {
      return { id: null, candidates: [] as Array<Record<string, unknown>> };
    }

    const exact = await this.prisma.crmLead.findUnique({ where: { id: reference } });
    if (exact) {
      return {
        id: exact.id,
        candidates: [{ id: exact.id, fullName: exact.fullName, phone: exact.phone }],
      };
    }

    const candidates = await this.prisma.crmLead.findMany({
      where: {
        OR: [
          { fullName: { contains: reference, mode: Prisma.QueryMode.insensitive } },
          { phone: { contains: reference, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        status: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    const exactName = candidates.find((item) => item.fullName === reference);
    const exactPhone = candidates.find((item) => item.phone === reference);

    return {
      id: exactName?.id ?? exactPhone?.id ?? (candidates.length === 1 ? candidates[0].id : null),
      candidates,
    };
  }

  private async resolveOpportunity(reference: string | null) {
    if (!reference) {
      return { id: null, candidates: [] as Array<Record<string, unknown>> };
    }

    const exact = await this.prisma.crmOpportunity.findUnique({
      where: { id: reference },
    });
    if (exact) {
      return {
        id: exact.id,
        candidates: [{ id: exact.id, title: exact.title, stage: exact.stage }],
      };
    }

    const candidates = await this.prisma.crmOpportunity.findMany({
      where: {
        title: { contains: reference, mode: Prisma.QueryMode.insensitive },
      },
      select: {
        id: true,
        title: true,
        stage: true,
        guardianProfileId: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    const exactTitle = candidates.find((item) => item.title === reference);

    return {
      id: exactTitle?.id ?? (candidates.length === 1 ? candidates[0].id : null),
      candidates,
    };
  }

  private async resolveGuardian(reference: string | null) {
    if (!reference) {
      return { id: null, candidates: [] as Array<Record<string, unknown>> };
    }

    const exact = await this.prisma.guardianProfile.findUnique({ where: { id: reference } });
    if (exact) {
      return {
        id: exact.id,
        candidates: [{ id: exact.id, displayName: exact.displayName, phone: exact.phone }],
      };
    }

    const candidates = await this.prisma.guardianProfile.findMany({
      where: {
        OR: [
          {
            displayName: {
              contains: reference,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { phone: { contains: reference, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        phone: true,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    const exactName = candidates.find((item) => item.displayName === reference);
    const exactPhone = candidates.find((item) => item.phone === reference);

    return {
      id: exactName?.id ?? exactPhone?.id ?? (candidates.length === 1 ? candidates[0].id : null),
      candidates,
    };
  }

  private async buildPayloadForAction(
    actionKey: SupportedActionKey,
    instruction: string,
  ) {
    const candidates: Record<string, unknown[]> = {};

    if (actionKey === 'crm.lead.create') {
      const fullName = this.extractName(instruction);
      const phone = this.extractPhone(instruction);
      const city = this.extractField(instruction, ['城市', 'city']);
      const source = this.extractField(instruction, ['来源', '渠道']);
      const notes = this.extractField(instruction, ['备注', '说明', '需求']);

      return {
        payload: {
          fullName,
          phone,
          city,
          source,
          notes,
        },
        candidates,
        confidence: fullName ? 0.91 : 0.58,
        rationale: '根据“创建/新建线索”等关键词匹配到 CRM 线索创建动作。',
      };
    }

    if (actionKey === 'crm.task.create') {
      const title =
        this.extractField(instruction, ['任务', '提醒', '回访']) ||
        this.extractQuotedText(instruction) ||
        instruction.replace(/^(请|帮我|帮忙)?/, '').trim();
      const dueAt = this.extractDateTime(instruction);
      const leadRef = this.extractField(instruction, ['线索', '客户', '家长']) || this.extractName(instruction);
      const lead = await this.resolveLead(leadRef);
      candidates.leads = lead.candidates;

      return {
        payload: {
          title,
          dueAt,
          leadId: lead.id,
          description: this.extractField(instruction, ['内容', '备注']) || null,
        },
        candidates,
        confidence: title ? 0.88 : 0.55,
        rationale: '识别到“任务/提醒/回访”语义，映射为 CRM 任务创建。',
      };
    }

    if (actionKey === 'crm.activity.create') {
      const content =
        this.extractField(instruction, ['备注', '内容', '跟进']) ||
        this.extractQuotedText(instruction) ||
        instruction;
      const leadRef = this.extractField(instruction, ['线索', '客户', '家长']) || this.extractName(instruction);
      const opportunityRef = this.extractField(instruction, ['商机']);
      const lead = await this.resolveLead(leadRef);
      const opportunity = await this.resolveOpportunity(opportunityRef);
      candidates.leads = lead.candidates;
      candidates.opportunities = opportunity.candidates;

      return {
        payload: {
          type: this.detectActivityType(instruction),
          content,
          leadId: lead.id,
          opportunityId: opportunity.id,
        },
        candidates,
        confidence: content ? 0.89 : 0.52,
        rationale: '识别到“备注/电话/微信/跟进”等语义，映射为 CRM 活动记录。',
      };
    }

    if (actionKey === 'crm.case.create') {
      const guardianRef =
        this.extractField(instruction, ['客户', '家长']) || this.extractName(instruction) || this.extractPhone(instruction);
      const guardian = await this.resolveGuardian(guardianRef);
      candidates.guardians = guardian.candidates;
      const category = this.detectCaseCategory(instruction);
      const title =
        this.extractField(instruction, ['工单', '投诉', '退款', '改约', '换老师']) ||
        `${guardianRef || '客户'}${this.caseCategoryLabel(category)}`;
      const description =
        this.extractField(instruction, ['原因', '说明', '内容', '备注']) || instruction;

      return {
        payload: {
          title,
          category,
          priority: /紧急|尽快|马上/.test(instruction)
            ? CrmCasePriority.URGENT
            : CrmCasePriority.MEDIUM,
          description,
          guardianProfileId: guardian.id,
        },
        candidates,
        confidence: title ? 0.87 : 0.62,
        rationale: '识别到售后/投诉/退款/改约语义，映射为 CRM 工单创建。',
      };
    }

    if (actionKey === 'crm.opportunity.advance') {
      const opportunityRef =
        this.extractField(instruction, ['商机']) || this.extractQuotedText(instruction) || this.extractName(instruction);
      const opportunity = await this.resolveOpportunity(opportunityRef);
      candidates.opportunities = opportunity.candidates;
      const stage = this.detectOpportunityStage(instruction);

      return {
        payload: {
          opportunityId: opportunity.id,
          stage,
          summary: this.extractField(instruction, ['备注', '说明']) || null,
          nextFollowUpAt: this.extractDateTime(instruction),
        },
        candidates,
        confidence: stage ? 0.9 : 0.61,
        rationale: '识别到商机推进语义，并从文本中提取目标阶段。',
      };
    }

    const leadRef =
      this.extractField(instruction, ['线索']) || this.extractName(instruction) || this.extractPhone(instruction);
    const lead = await this.resolveLead(leadRef);
    candidates.leads = lead.candidates;

    return {
      payload: { leadId: lead.id },
      candidates,
      confidence: lead.id ? 0.84 : 0.5,
      rationale: '识别到删除线索语义，动作会进入高风险审批流。',
    };
  }

  private caseCategoryLabel(category: CrmCaseCategory) {
    switch (category) {
      case CrmCaseCategory.REFUND:
        return '退款工单';
      case CrmCaseCategory.COMPLAINT:
        return '投诉工单';
      case CrmCaseCategory.SCHEDULE_CHANGE:
        return '改约工单';
      case CrmCaseCategory.TEACHER_CHANGE:
        return '换老师工单';
      case CrmCaseCategory.PAYMENT:
        return '支付工单';
      default:
        return '售后工单';
    }
  }

  private async executeAction(
    actionKey: SupportedActionKey,
    payload: Record<string, unknown>,
    actorUserId: string,
  ) {
    if (actionKey === 'crm.lead.create') {
      return this.crmService.createLead(
        {
          fullName: String(payload.fullName),
          phone: this.asOptionalString(payload.phone),
          city: this.asOptionalString(payload.city),
          source: this.asOptionalString(payload.source),
          notes: this.asOptionalString(payload.notes),
        },
        actorUserId,
      );
    }

    if (actionKey === 'crm.task.create') {
      return this.crmService.createTask(
        {
          title: String(payload.title),
          dueAt: this.asOptionalString(payload.dueAt),
          leadId: this.asOptionalString(payload.leadId),
          description: this.asOptionalString(payload.description),
        },
        actorUserId,
      );
    }

    if (actionKey === 'crm.activity.create') {
      return this.crmService.createActivity(
        {
          type: (payload.type as CrmActivityType) ?? CrmActivityType.NOTE,
          content: String(payload.content),
          leadId: this.asOptionalString(payload.leadId),
          opportunityId: this.asOptionalString(payload.opportunityId),
        },
        actorUserId,
      );
    }

    if (actionKey === 'crm.case.create') {
      return this.crmService.createCase(
        {
          title: String(payload.title),
          category: payload.category as CrmCaseCategory,
          priority: (payload.priority as CrmCasePriority) ?? CrmCasePriority.MEDIUM,
          description: this.asOptionalString(payload.description),
          guardianProfileId: this.asOptionalString(payload.guardianProfileId),
        },
        actorUserId,
      );
    }

    if (actionKey === 'crm.opportunity.advance') {
      return this.crmService.updateOpportunity(
        String(payload.opportunityId),
        {
          stage: payload.stage as CrmOpportunityStage,
          summary: this.asOptionalString(payload.summary),
          nextFollowUpAt: this.asOptionalString(payload.nextFollowUpAt),
        },
        actorUserId,
      );
    }

    return this.crmService.removeLead(String(payload.leadId), actorUserId);
  }

  private extractEntityReference(
    actionKey: SupportedActionKey,
    result: unknown,
    payload: Record<string, unknown>,
  ) {
    if (actionKey === 'crm.lead.create') {
      return {
        entityType: 'CRM_LEAD',
        entityId:
          typeof result === 'object' && result !== null && 'id' in result
            ? String((result as { id: unknown }).id)
            : null,
      };
    }

    if (actionKey === 'crm.task.create') {
      return {
        entityType: 'CRM_TASK',
        entityId:
          typeof result === 'object' && result !== null && 'id' in result
            ? String((result as { id: unknown }).id)
            : null,
      };
    }

    if (actionKey === 'crm.activity.create') {
      return {
        entityType: 'CRM_ACTIVITY',
        entityId:
          typeof result === 'object' && result !== null && 'id' in result
            ? String((result as { id: unknown }).id)
            : null,
      };
    }

    if (actionKey === 'crm.case.create') {
      return {
        entityType: 'CRM_CASE',
        entityId:
          typeof result === 'object' && result !== null && 'id' in result
            ? String((result as { id: unknown }).id)
            : null,
      };
    }

    if (actionKey === 'crm.opportunity.advance') {
      return {
        entityType: 'CRM_OPPORTUNITY',
        entityId:
          typeof result === 'object' && result !== null && 'id' in result
            ? String((result as { id: unknown }).id)
            : this.asOptionalString(payload.opportunityId),
      };
    }

    return {
      entityType: 'CRM_LEAD',
      entityId: this.asOptionalString(payload.leadId),
    };
  }

  private asOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
