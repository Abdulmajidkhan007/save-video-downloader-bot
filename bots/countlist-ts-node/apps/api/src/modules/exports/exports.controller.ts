import { Controller, Post, Get, Body, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { FastifyReply } from 'fastify';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exports')
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate and download export file' })
  async generate(
    @CurrentUser() user: User,
    @Body()
    body: {
      groupId: string;
      format: 'PDF' | 'CSV' | 'EXCEL';
      startDate?: string;
      endDate?: string;
      categoryId?: string;
    },
    @Res() reply: FastifyReply,
  ) {
    const result = await this.exportsService.generateExport({
      groupId: body.groupId,
      userId: user.id,
      format: body.format,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      categoryId: body.categoryId,
    });

    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.buffer);
  }
}
