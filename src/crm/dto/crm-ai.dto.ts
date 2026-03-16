import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class InterpretCrmAiInstructionDto {
  @IsString()
  @MaxLength(1200)
  instruction!: string;
}

export class ExecuteCrmAiActionDto {
  @IsString()
  @MaxLength(1200)
  actionKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  instruction?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  approved?: boolean;
}
