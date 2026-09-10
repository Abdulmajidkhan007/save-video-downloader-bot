import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ example: 500000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ enum: ['UZS', 'USD', 'EUR', 'RUB'] })
  @IsOptional()
  @IsEnum(['UZS', 'USD', 'EUR', 'RUB'])
  currency?: 'UZS' | 'USD' | 'EUR' | 'RUB';

  @ApiProperty({ example: 'Ovqat uchun' })
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty()
  @IsString()
  groupId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'VOICE', 'OCR', 'RECURRING', 'MANUAL'] })
  @IsOptional()
  @IsEnum(['TEXT', 'VOICE', 'OCR', 'RECURRING', 'MANUAL'])
  source?: 'TEXT' | 'VOICE' | 'OCR' | 'RECURRING' | 'MANUAL';
}

export class UpdateExpenseDto extends PartialType(OmitType(CreateExpenseDto, ['groupId'] as const)) {}

export class ExpenseQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  month?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
