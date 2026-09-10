import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LimitsService } from './limits.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Limits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('limits')
export class LimitsController {
  constructor(private limitsService: LimitsService) {}

  @Post()
  @ApiOperation({ summary: 'Set monthly limit' })
  setLimit(
    @Body()
    body: {
      amount: number;
      currency?: string;
      categoryId?: string;
      userId?: string;
      month: number;
      year: number;
      groupId: string;
    },
  ) {
    return this.limitsService.setLimit(body);
  }

  @Get()
  @ApiOperation({ summary: 'Get limits with usage' })
  getLimits(
    @Query('groupId') groupId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.limitsService.getLimitsWithUsage(
      groupId,
      month ? parseInt(month) : now.getMonth() + 1,
      year ? parseInt(year) : now.getFullYear(),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete limit' })
  deleteLimit(@Param('id') id: string) {
    return this.limitsService.deleteLimit(id);
  }
}
