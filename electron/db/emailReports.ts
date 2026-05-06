import nodemailer from 'nodemailer';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getSetting, getAdvancedReports, listSaleItems } from './database';
import { decryptCredential } from './crypto';
import type { DateRange } from './types';

/** Find the most recent .db backup file from the EVA_POS/Backups folder */
function findLatestBackup(): { path: string; name: string } | null {
  try {
    const backupDir = path.join(app.getPath('documents'), 'EVA_POS', 'Backups');
    if (!fs.existsSync(backupDir)) return null;
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .sort(); // ISO timestamp names sort chronologically
    if (files.length === 0) return null;
    const latest = files[files.length - 1];
    return { path: path.join(backupDir, latest), name: latest };
  } catch (err) {
    log.warn('[email] Could not find backup file:', err);
    return null;
  }
}

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  emailRecipient: string;
  emailEnabled: boolean;
  sendTime: string;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  // Get raw password from database (may be encrypted or plaintext)
  const rawPassword = (await getSetting('email_smtp_password')) || '';

  // Decrypt if encrypted, or return as-is if plaintext (for backwards compatibility)
  const smtpPassword = decryptCredential(rawPassword);

  const settings: EmailSettings = {
    smtpHost: (await getSetting('email_smtp_host')) || 'smtp.gmail.com',
    smtpPort: parseInt((await getSetting('email_smtp_port')) || '587', 10),
    smtpSecure: (await getSetting('email_smtp_secure')) === 'true',
    smtpUser: (await getSetting('email_smtp_user')) || '',
    smtpPassword,
    emailRecipient: (await getSetting('email_recipient')) || '',
    emailEnabled: (await getSetting('email_enabled')) === 'true',
    sendTime: (await getSetting('email_send_time')) || '20:00',
  };
  return settings;
}

export async function sendDailyReport(): Promise<{ success: boolean; error?: string }> {
  const settings = await getEmailSettings();

  if (!settings.emailEnabled) {
    return { success: false, error: 'Email reports are disabled. Check the "Enable Email Reports" box.' };
  }

  if (!settings.smtpUser) {
    return { success: false, error: 'Sender email is not configured.' };
  }

  if (!settings.smtpPassword) {
    return { success: false, error: 'Email password/app password is not configured.' };
  }

  if (!settings.emailRecipient) {
    return { success: false, error: 'Recipient email is not configured.' };
  }

  try {
    // Get today's date range
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const range: DateRange = { startDate: todayStr, endDate: todayStr };

    // Get report data
    const reports = await getAdvancedReports(range);

    // Get items sold today
    const itemsSold = await listSaleItems(todayStr);

    // Build Arabic email content
    const html = buildArabicEmailHtml(today, reports, itemsSold);

    // Configure transport
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
      tls: {
        // Fix for 'self signed certificate in certificate chain' errors
        // often caused by local firewalls or antiviruses intercepting SSL
        rejectUnauthorized: false,
      },
    });

    // Attach latest backup if it exists
    const latestBackup = findLatestBackup();
    const attachments: Array<{ filename: string; path: string; contentType: string }> = [];
    if (latestBackup) {
      attachments.push({
        filename: `eva-pos-backup-${todayStr}.db`,
        path: latestBackup.path,
        contentType: 'application/octet-stream',
      });
      log.info('[email] Attaching backup:', latestBackup.name);
    } else {
      log.warn('[email] No backup found to attach');
    }

    // Send email
    await transporter.sendMail({
      from: settings.smtpUser,
      to: settings.emailRecipient,
      subject: `📊 EVA POS - ملخص يومي - ${formatArabicDate(today)}`,
      html,
      attachments,
    });

    log.info('[email] Daily report sent successfully');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('[email] Failed to send daily report:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

function formatArabicDate(date: Date): string {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function buildArabicEmailHtml(
  date: Date,
  reports: any,
  itemsSold: Array<{ name: string; size?: string; color?: string; quantity: number }>
): string {
  const { profitAnalysis, returnsSummary } = reports;
  const lowStockCount = reports.lowStock?.length || 0;

  // Build items sold list
  let itemsHtml = '';
  let totalItems = 0;
  itemsSold.forEach((item) => {
    const variant = [item.color, item.size].filter(Boolean).join(' - ');
    itemsHtml += `<tr><td style="padding: 8px; border-bottom: 1px solid #333;">${item.name}${variant ? ` (${variant})` : ''}</td><td style="padding: 8px; border-bottom: 1px solid #333; text-align: center;">× ${item.quantity}</td></tr>`;
    totalItems += item.quantity;
  });

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #1a1a2e; color: #e2e8f0; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(120deg, #2563eb, #7c3aed); padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; color: white; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); }
    .section { padding: 20px; border-bottom: 1px solid #333; }
    .section h2 { margin: 0 0 16px; font-size: 18px; color: #60a5fa; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .stat-label { color: #94a3b8; }
    .stat-value { font-weight: bold; color: #e2e8f0; }
    .profit-positive { color: #10b981; }
    .profit-negative { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; }
    .footer { padding: 16px; text-align: center; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>EVA POS - ملخص يومي</h1>
      <p>${formatArabicDate(date)}</p>
    </div>
    
    <div class="section">
      <h2>💰 المبيعات</h2>
      <div class="stat-row">
        <span class="stat-label">إجمالي الإيرادات:</span>
        <span class="stat-value">${profitAnalysis.revenueIQD.toLocaleString('en-IQ')} د.ع</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">عدد الطلبات:</span>
        <span class="stat-value">${reports.dailySales?.[0]?.orders || 0}</span>
      </div>
    </div>

    <div class="section">
      <h2>📈 الأرباح</h2>
      <div class="stat-row">
        <span class="stat-label">تكلفة البضائع:</span>
        <span class="stat-value">${profitAnalysis.costIQD.toLocaleString('en-IQ')} د.ع</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">صافي الربح:</span>
        <span class="stat-value ${profitAnalysis.netProfitIQD >= 0 ? 'profit-positive' : 'profit-negative'}">${profitAnalysis.netProfitIQD.toLocaleString('en-IQ')} د.ع</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">نسبة الربح:</span>
        <span class="stat-value ${profitAnalysis.profitMarginPercent >= 0 ? 'profit-positive' : 'profit-negative'}">${profitAnalysis.profitMarginPercent.toFixed(1)}%</span>
      </div>
    </div>

    <div class="section">
      <h2>📦 المخزون</h2>
      <div class="stat-row">
        <span class="stat-label">منتجات منخفضة:</span>
        <span class="stat-value">${lowStockCount}</span>
      </div>
    </div>

    <div class="section">
      <h2>🔄 المرتجعات</h2>
      <div class="stat-row">
        <span class="stat-label">المرتجعات:</span>
        <span class="stat-value">${returnsSummary.count} (${returnsSummary.totalIQD.toLocaleString('en-IQ')} د.ع)</span>
      </div>
    </div>

    <div class="section">
      <h2>📋 المنتجات المباعة اليوم</h2>
      ${itemsSold.length === 0
      ? '<p style="color: #64748b;">لا توجد مبيعات اليوم</p>'
      : `
      <table>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div class="stat-row" style="margin-top: 12px; border-top: 2px solid #333; padding-top: 12px;">
        <span class="stat-label">إجمالي القطع:</span>
        <span class="stat-value">${totalItems}</span>
      </div>
      `
    }
    </div>

    <div class="footer">
      تم إنشاء هذا التقرير تلقائياً بواسطة EVA POS
    </div>
  </div>
</body>
</html>
  `;
}
