import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['UZS', 'USD', 'EUR', 'RUB']).default('UZS'),
  description: z.string().min(1).max(500),
  categoryId: z.string().optional(),
  date: z.string().datetime().optional(),
  groupId: z.string(),
  source: z.enum(['TEXT', 'VOICE', 'OCR', 'RECURRING', 'MANUAL']).default('MANUAL'),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial().omit({ groupId: true });

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  nameUz: z.string().optional(),
  icon: z.string().default('💰'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  groupId: z.string().optional(),
});

export const SetLimitSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['UZS', 'USD', 'EUR', 'RUB']).default('UZS'),
  categoryId: z.string().optional(),
  userId: z.string().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  groupId: z.string(),
});

export const LoginSchema = z.object({
  telegramId: z.string(),
  initData: z.string(),
});

export const ExportSchema = z.object({
  format: z.enum(['PDF', 'CSV', 'EXCEL']),
  groupId: z.string(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  categoryId: z.string().optional(),
  userId: z.string().optional(),
});

export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseSchema>;
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type SetLimitDto = z.infer<typeof SetLimitSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ExportDto = z.infer<typeof ExportSchema>;
