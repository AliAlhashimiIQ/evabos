import fs from 'fs/promises';
import path from 'path';
import log from 'electron-log';
import { getSetting, setSetting, getAdvancedReports, listSaleItems } from './database';
import { get } from './core';
import { encryptCredential, decryptCredential } from './crypto';
import { createBackup } from './backup';
import type { SaleDetail, DateRange } from './types';

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyOnSale: boolean;
  notifyOnClose: boolean;
}

/**
 * Retrieve Telegram settings from the database (decrypting the token)
 */
export async function getTelegramSettings(): Promise<TelegramSettings> {
  const rawToken = (await getSetting('telegram_bot_token')) || '';
  const botToken = decryptCredential(rawToken);

  return {
    botToken,
    chatId: (await getSetting('telegram_chat_id')) || '',
    enabled: (await getSetting('telegram_enabled')) === 'true',
    notifyOnSale: (await getSetting('telegram_notify_on_sale')) === 'true',
    notifyOnClose: (await getSetting('telegram_notify_on_close')) === 'true',
  };
}

/**
 * Save Telegram settings to the database (encrypting the token)
 */
export async function saveTelegramSettings(settings: {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyOnSale: boolean;
  notifyOnClose: boolean;
}): Promise<boolean> {
  if (settings.botToken && settings.botToken !== '••••••••') {
    const encrypted = encryptCredential(settings.botToken);
    await setSetting('telegram_bot_token', encrypted);
  }

  await setSetting('telegram_chat_id', settings.chatId || '');
  await setSetting('telegram_enabled', settings.enabled ? 'true' : 'false');
  await setSetting('telegram_notify_on_sale', settings.notifyOnSale ? 'true' : 'false');
  await setSetting('telegram_notify_on_close', settings.notifyOnClose ? 'true' : 'false');

  log.info('[telegram] Settings saved successfully.');
  return true;
}

/**
 * Send an HTML formatted text message to the configured Telegram chat
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: string = 'HTML',
  overrideSettings?: { botToken?: string; chatId?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    const token = overrideSettings?.botToken || settings.botToken;
    const chatId = overrideSettings?.chatId || settings.chatId;

    if (!token || !chatId) {
      return { success: false, error: 'Telegram Bot Token or Chat ID is missing.' };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      log.error('[telegram] API error sending message:', data.description);
      return { success: false, error: data.description || 'Failed to send Telegram message' };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('[telegram] Exception in sendTelegramMessage:', message);
    return { success: false, error: message };
  }
}

/**
 * Send a document/file attachment to Telegram (e.g. database backup file)
 */
export async function sendTelegramDocument(
  filePath: string,
  caption: string = '',
  overrideSettings?: { botToken?: string; chatId?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    const token = overrideSettings?.botToken || settings.botToken;
    const chatId = overrideSettings?.chatId || settings.chatId;

    if (!token || !chatId) {
      return { success: false, error: 'Telegram Bot Token or Chat ID is missing.' };
    }

    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const fileBlob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('document', fileBlob, fileName);

    const url = `https://api.telegram.org/bot${token}/sendDocument`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      log.error('[telegram] API error sending document:', data.description);
      return { success: false, error: data.description || 'Failed to upload document to Telegram' };
    }

    log.info(`[telegram] Document "${fileName}" sent successfully.`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('[telegram] Exception in sendTelegramDocument:', message);
    return { success: false, error: message };
  }
}

/**
 * Send real-time notification on sale creation (runs asynchronously)
 */
export async function notifyTelegramSale(sale: SaleDetail): Promise<void> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled || !settings.notifyOnSale) {
      return;
    }

    if (!settings.botToken || !settings.chatId) {
      return;
    }

    let cashierName = 'كاشير';
    if (sale.cashierId) {
      try {
        const user = await get<{ name: string; username: string }>('SELECT name, username FROM users WHERE id = ?', [sale.cashierId]);
        if (user) cashierName = user.name || user.username;
      } catch {
        // ignore
      }
    }

    let customerName = '';
    if (sale.customerId) {
      try {
        const customer = await get<{ name: string }>('SELECT name FROM customers WHERE id = ?', [sale.customerId]);
        if (customer) customerName = customer.name;
      } catch {
        // ignore
      }
    }

    const totalQty = (sale.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0);

    const paymentMap: Record<string, string> = {
      cash: '💵 نقداً (Cash)',
      card: '💳 بطاقة (Card)',
      mixed: '💳💵 دفع مختلط',
    };
    const paymentStr = paymentMap[sale.paymentMethod || 'cash'] || sale.paymentMethod || 'نقداً';

    const itemsSummary = (sale.items || [])
      .slice(0, 5)
      .map((item) => {
        const variantDesc = [item.size, item.color].filter(Boolean).join(' - ');
        const extra = variantDesc ? ` (${variantDesc})` : '';
        return `▫️ <b>${escapeHtml(item.productName || 'منتج')}</b>${escapeHtml(extra)} × ${item.quantity} = ${item.lineTotalIQD.toLocaleString('en-IQ')} د.ع`;
      })
      .join('\n');

    const hasMore = (sale.items || []).length > 5 ? `\n<i>... ومجموع ${sale.items.length} أصناف</i>` : '';

    const formattedDate = new Date(sale.saleDate || Date.now()).toLocaleString('ar-IQ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    let message = `🛍️ <b>عملية بيع جديدة — EVA POS</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🧾 <b>رقم الفاتورة:</b> #<code>${sale.id}</code>\n`;
    message += `💰 <b>الإجمالي:</b> <b>${sale.totalIQD.toLocaleString('en-IQ')} د.ع</b>\n`;

    if (sale.discountIQD && sale.discountIQD > 0) {
      message += `🏷️ <b>الخصم:</b> ${sale.discountIQD.toLocaleString('en-IQ')} د.ع\n`;
    }

    message += `💳 <b>طريقة الدفع:</b> ${paymentStr}\n`;
    message += `👤 <b>الكاشير:</b> ${escapeHtml(cashierName)}\n`;

    if (sale.employeeName) {
      message += `👔 <b>الموظف:</b> ${escapeHtml(sale.employeeName)}\n`;
    }

    if (customerName) {
      message += `👥 <b>الزبون:</b> ${escapeHtml(customerName)}\n`;
    }

    message += `📦 <b>إجمالي القطع:</b> ${totalQty} قطعة\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (itemsSummary) {
      message += `${itemsSummary}${hasMore}\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
    }
    message += `🕒 <b>الوقت:</b> ${formattedDate}`;

    await sendTelegramMessage(message, 'HTML');
  } catch (err) {
    log.error('[telegram] Failed to send sale notification:', err);
  }
}

/**
 * Send full End-of-Day report and upload latest database backup file
 */
export async function sendTelegramDailyReportAndBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Telegram Bot is disabled in settings.' };
    }

    if (!settings.botToken || !settings.chatId) {
      return { success: false, error: 'Telegram Bot Token or Chat ID is not configured.' };
    }

    log.info('[telegram] Generating daily report & backup for Telegram...');

    // Today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const range: DateRange = { startDate: todayStr, endDate: todayStr };

    // Get report data
    const reports = await getAdvancedReports(range);
    const itemsSold = await listSaleItems(todayStr);

    const formattedDateStr = today.toLocaleDateString('ar-IQ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const profit = reports.profitAnalysis || {
      revenueIQD: 0,
      costIQD: 0,
      expensesIQD: 0,
      netProfitIQD: 0,
      profitMarginPercent: 0,
    };
    const returns = reports.returnsSummary || { count: 0, totalIQD: 0 };
    const totalOrders = reports.dailySales?.reduce((acc, d) => acc + (d.orders || 0), 0) || 0;
    const totalItems = reports.totalItemsSold || 0;
    const grossProfitIQD = (profit.revenueIQD || 0) - (profit.costIQD || 0);

    let reportMsg = `📊 <b>تقرير نهاية اليوم — EVA POS</b>\n`;
    reportMsg += `📅 <b>اليوم:</b> ${formattedDateStr}\n`;
    reportMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    reportMsg += `🧾 <b>عدد الفواتير:</b> ${totalOrders} فاتورة\n`;
    reportMsg += `📦 <b>القطع المباعة:</b> ${totalItems} قطعة\n`;
    reportMsg += `💰 <b>إجمالي المبيعات:</b> <b>${profit.revenueIQD.toLocaleString('en-IQ')} د.ع</b>\n`;
    reportMsg += `📈 <b>إجمالي الأرباح:</b> ${grossProfitIQD.toLocaleString('en-IQ')} د.ع\n`;

    if (profit.expensesIQD > 0) {
      reportMsg += `💸 <b>المصاريف:</b> ${profit.expensesIQD.toLocaleString('en-IQ')} د.ع\n`;
    }

    reportMsg += `💵 <b>صافي الربح اليومي:</b> <b>${profit.netProfitIQD.toLocaleString('en-IQ')} د.ع</b>\n`;

    if (returns.totalIQD > 0 || returns.count > 0) {
      reportMsg += `🔄 <b>المرتجعات:</b> ${returns.totalIQD.toLocaleString('en-IQ')} د.ع (${returns.count} عمليات)\n`;
    }

    if (itemsSold && itemsSold.length > 0) {
      reportMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      reportMsg += `🏆 <b>أبرز مبيعات اليوم:</b>\n`;
      const topItems = itemsSold.slice(0, 5);
      for (const it of topItems) {
        const variant = [it.color, it.size].filter(Boolean).join(' - ');
        const extra = variant ? ` (${variant})` : '';
        reportMsg += `▫️ ${escapeHtml(it.name)}${escapeHtml(extra)}: ${it.quantity} قطعة\n`;
      }
    }

    reportMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    reportMsg += `💾 <i>جاري رفع النسخة الاحتياطية لقاعدة البيانات أدناه...</i>`;

    // 1. Send the report message
    const msgResult = await sendTelegramMessage(reportMsg, 'HTML');
    if (!msgResult.success) {
      log.warn('[telegram] Daily report message warning:', msgResult.error);
    }

    // 2. Create fresh backup
    const backupInfo = await createBackup();

    // 3. Send the backup file
    const caption = `📦 <b>نسخة احتياطية لقاعدة البيانات</b>\n🏷️ الملف: <code>${backupInfo.filename}</code>\n📅 التاريخ: ${todayStr} (${(backupInfo.size / (1024 * 1024)).toFixed(2)} MB)`;
    const docResult = await sendTelegramDocument(backupInfo.filepath, caption);

    if (!docResult.success) {
      return { success: false, error: docResult.error };
    }

    log.info('[telegram] Daily report & database backup sent to Telegram successfully.');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error('[telegram] Failed in sendTelegramDailyReportAndBackup:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a test greeting message to verify bot token and chat ID
 */
export async function sendTelegramTest(): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toLocaleString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const testMessage = `🤖 <b>تم الاتصال بنجاح مع بوت EVA POS!</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ البوت يعمل وجاهز لاستقبال إشعارات المبيعات الفورية وتقارير الإغلاق اليومية والنسخ الاحتياطية.\n🕒 <b>الوقت:</b> ${now}`;

  return sendTelegramMessage(testMessage, 'HTML');
}

/**
 * Helper to escape HTML characters in dynamic strings
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
