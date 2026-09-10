import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportFormat } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { formatAmount } from '@expense-tracker/shared';

interface ExportOptions {
  groupId: string;
  userId: string;
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
}

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async generateExport(options: ExportOptions): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const expenses = await this.getExpenses(options);

    switch (options.format) {
      case 'CSV':
        return this.generateCSV(expenses);
      case 'EXCEL':
        return this.generateExcel(expenses);
      case 'PDF':
        return this.generatePDF(expenses, options);
      default:
        throw new Error('Unsupported format');
    }
  }

  private async getExpenses(options: ExportOptions) {
    const where: any = { groupId: options.groupId, status: 'ACTIVE' };
    if (options.startDate || options.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = options.startDate;
      if (options.endDate) where.date.lte = options.endDate;
    }
    if (options.categoryId) where.categoryId = options.categoryId;

    return this.prisma.expense.findMany({
      where,
      include: { user: true, category: true },
      orderBy: { date: 'desc' },
    });
  }

  private async generateCSV(expenses: any[]): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const rows = expenses.map((e) => ({
      Sana: new Date(e.date).toLocaleDateString('uz-UZ'),
      Miqdor: Number(e.amount),
      Valyuta: e.currency,
      Tavsif: e.description,
      Kategoriya: e.category?.name || 'Boshqa',
      Foydalanuvchi: e.user.firstName,
    }));

    const csv = stringify(rows, { header: true });
    return {
      buffer: Buffer.from(csv),
      filename: `expenses-${Date.now()}.csv`,
      mimeType: 'text/csv',
    };
  }

  private async generateExcel(expenses: any[]): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Xarajatlar');

    sheet.columns = [
      { header: 'Sana', key: 'date', width: 15 },
      { header: 'Miqdor', key: 'amount', width: 15 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Tavsif', key: 'description', width: 30 },
      { header: 'Kategoriya', key: 'category', width: 20 },
      { header: 'Foydalanuvchi', key: 'user', width: 20 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6366F1' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    expenses.forEach((e) => {
      sheet.addRow({
        date: new Date(e.date).toLocaleDateString('uz-UZ'),
        amount: Number(e.amount),
        currency: e.currency,
        description: e.description,
        category: e.category?.name || 'Boshqa',
        user: e.user.firstName,
      });
    });

    // Total row
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalRow = sheet.addRow({ date: 'JAMI', amount: total, currency: 'UZS' });
    totalRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: `expenses-${Date.now()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private async generatePDF(
    expenses: any[],
    options: ExportOptions,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `expenses-${Date.now()}.pdf`,
          mimeType: 'application/pdf',
        }),
      );
      doc.on('error', reject);

      // Header
      doc
        .fontSize(22)
        .fillColor('#6366f1')
        .text('💰 Xarajatlar Hisoboti', { align: 'center' });
      doc.moveDown(0.5);

      doc
        .fontSize(11)
        .fillColor('#64748b')
        .text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, { align: 'center' });
      doc.moveDown(1.5);

      // Summary
      const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
      doc
        .fontSize(13)
        .fillColor('#1e293b')
        .text(`Jami xarajatlar: ${formatAmount(total)} • ${expenses.length} ta`, { align: 'left' });
      doc.moveDown(1);

      // Table header
      const tableTop = doc.y;
      const colWidths = [90, 100, 150, 120, 90];
      const headers = ['Sana', 'Miqdor', 'Tavsif', 'Kategoriya', 'Foydalanuvchi'];
      let x = 40;

      doc.fillColor('#6366f1').fontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, x, tableTop, { width: colWidths[i], continued: i < headers.length - 1 });
        x += colWidths[i];
      });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.3);

      // Rows
      doc.fillColor('#1e293b').fontSize(9);
      expenses.slice(0, 100).forEach((e, idx) => {
        if (doc.y > 750) {
          doc.addPage();
        }
        const y = doc.y;
        x = 40;
        const row = [
          new Date(e.date).toLocaleDateString('uz-UZ'),
          `${Number(e.amount).toLocaleString()} ${e.currency}`,
          e.description.slice(0, 25),
          e.category?.name || 'Boshqa',
          e.user.firstName,
        ];

        if (idx % 2 === 0) {
          doc.rect(40, y - 2, 515, 16).fillColor('#f8fafc').fill();
          doc.fillColor('#1e293b');
        }

        row.forEach((cell, i) => {
          doc.text(cell, x, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        doc.moveDown(0.6);
      });

      doc.end();
    });
  }

  async createExportRecord(userId: string, groupId: string, format: ExportFormat) {
    return this.prisma.export.create({
      data: { userId, groupId, format, status: 'PENDING' },
    });
  }
}
