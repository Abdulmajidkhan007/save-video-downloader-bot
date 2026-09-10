import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { subMonths, subDays } from 'date-fns';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard/:groupId')
  @ApiOperation({ summary: 'Get dashboard overview stats' })
  getDashboard(@Param('groupId') groupId: string) {
    return this.analyticsService.getDashboardStats(groupId);
  }

  @Get('full/:groupId')
  @ApiOperation({ summary: 'Get full analytics data' })
  getFull(
    @Param('groupId') groupId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : subMonths(end, 1);
    return this.analyticsService.getFullAnalytics(groupId, start, end);
  }

  @Get('trends/:groupId')
  @ApiOperation({ summary: 'Get expense trends for charts' })
  getTrends(
    @Param('groupId') groupId: string,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ) {
    const end = new Date();
    const start = period === 'daily'
      ? subDays(end, 30)
      : period === 'weekly'
      ? subMonths(end, 3)
      : subMonths(end, 12);
    return this.analyticsService.getFullAnalytics(groupId, start, end);
  }
}
