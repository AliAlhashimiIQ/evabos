import fs from 'fs/promises';
import path from 'path';
import log from 'electron-log';
import { get, all, run, getSetting, setSetting } from './core';
import { encryptCredential, decryptCredential } from './crypto';
import { createBackup } from './backup';
import type { SaleDetail, DateRange, ShiftClosingRecord } from './types';

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

// ─── Keyboards & Menus ────────────────────────────────────────────────────────

/**
 * Persistent Reply Keyboard displayed at the bottom of the Telegram chat
 */
export const MAIN_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: '📊 مبيعات اليوم' }, { text: '📅 مبيعات الأمس' }, { text: '🗓️ مبيعات الشهر' }],
    [{ text: '📉 المصروفات' }, { text: '👥 مبيعات الكادر' }, { text: '💵 الكاش بالدرج' }],
    [{ text: '🔍 فحص منتج / باركود' }, { text: '⚠️ نواقص المخزون' }, { text: '🏆 الأكثر مبيعاً' }],
    [{ text: '📋 سجلات النشاط' }, { text: '💾 نسخة احتياطية' }, { text: '🟢 فحص الحالة' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

/**
 * Quick inline buttons displayed below report messages
 */
export const REPORT_INLINE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '📊 اليوم', callback_data: 'cmd:report' },
      { text: '📅 الأمس', callback_data: 'cmd:yesterday' },
      { text: '🗓️ الشهر', callback_data: 'cmd:month' },
    ],
    [
      { text: '📉 المصروفات', callback_data: 'cmd:expenses' },
      { text: '👥 الكادر', callback_data: 'cmd:employees' },
      { text: '💵 الكاش', callback_data: 'cmd:cash' },
    ],
    [
      { text: '📋 سجلات النشاط', callback_data: 'cmd:activity' },
      { text: '⚠️ النواقص', callback_data: 'cmd:stock' },
      { text: '💾 نسخة احتياطية', callback_data: 'cmd:backup' },
    ],
  ],
};

/**
 * Send an HTML formatted text message to the configured Telegram chat
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: string = 'HTML',
  overrideSettings?: { botToken?: string; chatId?: string },
  replyMarkup?: Record<string, unknown>,
): Promise<{ success: boolean; error?: string; messageId?: number }> {
  try {
    const settings = await getTelegramSettings();
    const token = overrideSettings?.botToken || settings.botToken;
    const chatId = overrideSettings?.chatId || settings.chatId;

    if (!token || !chatId) {
      log.warn('[telegram] Cannot send: botToken or chatId is missing in DB settings');
      return { success: false, error: 'Telegram Bot Token or Chat ID is missing.' };
    }

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!data.ok) {
      log.error('[telegram] API error sending message:', data.description);

      // Fallback: If Telegram failed due to entity HTML parsing error, strip HTML and resend as plain text
      if (parseMode === 'HTML') {
        log.warn('[telegram] Retrying message without HTML tags due to parsing error...');
        const plainText = text.replace(/<[^>]*>/g, '');
        const fallbackPayload: Record<string, unknown> = {
          chat_id: chatId,
          text: plainText,
        };
        if (replyMarkup) {
          fallbackPayload.reply_markup = replyMarkup;
        }
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload),
        });
        const retryData = (await retryRes.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
        if (retryData.ok) {
          log.info('[telegram] Fallback plain text message sent successfully.');
          return { success: true, messageId: retryData.result?.message_id };
        }
      }

      return { success: false, error: data.description || 'Failed to send Telegram message' };
    }

    log.info('[telegram] Message delivered successfully to chat_id:', chatId);
    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('[telegram] Exception in sendTelegramMessage:', message);
    return { success: false, error: message };
  }
}

/**
 * Answer an inline button callback query
 */
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
  overrideToken?: string,
): Promise<void> {
  try {
    const settings = await getTelegramSettings();
    const token = overrideToken || settings.botToken;
    if (!token) return;

    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
  } catch (err) {
    log.error('[telegram] Error answering callback query:', err);
  }
}

/**
 * Edit an existing Telegram message's text (e.g. after approval/rejection button clicked)
 */
export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode = 'HTML',
  replyMarkup?: Record<string, unknown>,
  overrideToken?: string,
): Promise<boolean> {
  try {
    const settings = await getTelegramSettings();
    const token = overrideToken || settings.botToken;
    if (!token) return false;

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
    };
    if (replyMarkup !== undefined) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean };
    return !!data.ok;
  } catch (err) {
    log.error('[telegram] Error editing message text:', err);
    return false;
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

    let profitIQD = sale.profitIQD;
    if (profitIQD === undefined || profitIQD === null) {
      try {
        const sRow = await get<{ profitIQD: number }>('SELECT profitIQD FROM sales WHERE id = ?', [sale.id]);
        if (sRow) profitIQD = sRow.profitIQD;
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

    if (profitIQD !== undefined && profitIQD !== null && profitIQD !== 0) {
      message += `📈 <b>الربح الصافي:</b> <b>${Math.round(profitIQD).toLocaleString('en-IQ')} د.ع</b>\n`;
    }

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

// ─── Internal Database Helpers for Bot Commands ─────────────────────────────

async function getReportsHelper(range: DateRange): Promise<any> {
  const db = await import('./database');
  return db.getAdvancedReports(range);
}

async function listSaleItemsHelper(dateStr: string): Promise<any> {
  const db = await import('./database');
  return db.listSaleItems(dateStr);
}

// ─── End-of-Day Daily Report & Database Backup ───────────────────────────────

/**
 * Send daily sales summary report and SQLite database backup file to Telegram
 */
export async function sendTelegramDailyReportAndBackup(
  customDateStr?: string,
  overrideSettings?: { botToken?: string; chatId?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.botToken || !settings.chatId) {
      return { success: false, error: 'Telegram Bot Token or Chat ID is not configured.' };
    }

    log.info('[telegram] Generating daily report & backup for Telegram...');

    // Today's local date (YYYY-MM-DD)
    const now = new Date();
    const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayStr = customDateStr || todayLocalStr;
    const range: DateRange = { startDate: todayStr, endDate: todayStr };

    // Get report data
    const reports = await getReportsHelper(range);
    const itemsSold = await listSaleItemsHelper(todayStr);

    const reportDateObj = new Date(todayStr + 'T12:00:00');
    const formattedDateStr = reportDateObj.toLocaleDateString('ar-IQ', {
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
    const totalOrders = reports.dailySales?.reduce((acc: number, d: any) => acc + (d.orders || 0), 0) || 0;
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

    // 1. Dispatch the text report message immediately (fast < 300ms)
    const msgPromise = sendTelegramMessage(reportMsg, 'HTML');

    // 2. Prepare fresh database backup concurrently
    const backupInfoPromise = createBackup();

    // Await text message first so it is guaranteed to reach Telegram even on fast OS shutdown
    const msgResult = await msgPromise;
    if (!msgResult.success) {
      log.warn('[telegram] Daily report message warning:', msgResult.error);
    }

    // 3. Upload the backup file
    try {
      const backupInfo = await backupInfoPromise;
      const caption = `📦 <b>نسخة احتياطية لقاعدة البيانات</b>\n🏷️ الملف: <code>${backupInfo.filename}</code>\n📅 التاريخ: ${todayStr} (${(backupInfo.size / (1024 * 1024)).toFixed(2)} MB)`;
      const docResult = await sendTelegramDocument(backupInfo.filepath, caption);

      if (!docResult.success) {
        log.warn('[telegram] Backup upload warning:', docResult.error);
      }
    } catch (backupErr) {
      log.error('[telegram] Backup creation/upload error on shutdown:', backupErr);
    }

    // Mark as sent in DB
    await setSetting('telegram_last_eod_sent_date', todayStr);

    log.info('[telegram] Daily report & database backup sent to Telegram successfully.');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error('[telegram] Failed in sendTelegramDailyReportAndBackup:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Automatically checks on app startup if yesterday's report was missed (e.g. PC was shut down directly or power cut)
 * and sends yesterday's report to Telegram.
 */
export async function checkTelegramRecoveryOnStartup(): Promise<void> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled || !settings.notifyOnClose || !settings.botToken || !settings.chatId) {
      return;
    }

    const now = new Date();
    const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const lastSentDate = await getSetting('telegram_last_eod_sent_date');
    if (lastSentDate !== todayLocalStr && lastSentDate !== yesterdayStr) {
      const yesterdaySales = await getReportsHelper({ startDate: yesterdayStr, endDate: yesterdayStr });
      if (yesterdaySales && (yesterdaySales.dailySales?.length || 0) > 0) {
        log.info('[telegram] Recovering missed daily report for yesterday:', yesterdayStr);
        await sendTelegramDailyReportAndBackup(yesterdayStr);
      }
    }
  } catch (err) {
    log.error('[telegram] Startup recovery check error:', err);
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

  const testMessage = `🤖 <b>تم الاتصال بنجاح مع بوت EVA POS الذكي!</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ البوت يعمل وجاهز لاستقبال إشعارات المبيعات والتقارير المباشرة.\n\n💡 <b>الأوامر السريعة المتاحة:</b>\n📊 /report — تقرير مبيعات اليوم المباشر\n📅 /yesterday — تقرير يوم أمس\n🗓️ /month — تقرير مبيعات الشهر\n⚠️ /stock — تنبيه نواقص المخزون\n🏆 /top — أكثر 10 منتجات مبيعاً\n💵 /cash — فحص الصندوق وحساب الكاش\n📉 /expenses — مصروفات اليوم\n👥 /employees — مبيعات الكادر اليوم\n💾 /backup — نسخة احتياطية فورية\n❓ /help — قائمة بجميع الأوامر\n\n🕒 <b>الوقت:</b> ${now}`;

  return sendTelegramMessage(testMessage, 'HTML');
}

/**
 * Send shift closing notification (Z-Report) to Telegram
 */
export async function sendTelegramShiftCloseNotification(
  closing: ShiftClosingRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled || !settings.notifyOnClose || !settings.botToken || !settings.chatId) {
      return { success: false, error: 'Telegram close notification disabled or unconfigured' };
    }

    let closedAtStr = closing.closedAt;
    if (closedAtStr && closedAtStr.includes(' ') && !closedAtStr.includes('T')) {
      closedAtStr = closedAtStr.replace(' ', 'T') + (closedAtStr.endsWith('Z') ? '' : 'Z');
    }
    const dateObj = new Date(closedAtStr || Date.now());
    const formattedDate = dateObj.toLocaleString('ar-IQ', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const diff = closing.differenceIQD;
    let statusText = '✅ <b>الصندوق مطابق تماماً (0 د.ع)</b>';
    if (diff > 0) {
      statusText = `📈 <b>فائض في الصندوق: +${diff.toLocaleString('en-IQ')} د.ع</b>`;
    } else if (diff < 0) {
      statusText = `⚠️ <b>عجز ونقص في الصندوق: ${diff.toLocaleString('en-IQ')} د.ع</b>`;
    }

    let msg = `🔒 <b>إغلاق الصندوق والوردية — Z-Report #${closing.id}</b>\n`;
    msg += `🏢 <b>الفرع:</b> ${closing.branchName || 'EVA Main'}\n`;
    msg += `👤 <b>الكاشير:</b> ${closing.cashierName || 'المستخدم'}\n`;
    msg += `🕒 <b>وقت الإغلاق:</b> ${formattedDate}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 <b>رصيد الافتتاح:</b> ${closing.openingCashIQD.toLocaleString('en-IQ')} د.ع\n`;
    msg += `💳 <b>مبيعات الكاش:</b> ${closing.cashSalesIQD.toLocaleString('en-IQ')} د.ع\n`;
    if (closing.cardSalesIQD > 0) {
      msg += `💳 <b>مبيعات البطاقة:</b> ${closing.cardSalesIQD.toLocaleString('en-IQ')} د.ع\n`;
    }
    if (closing.exchangeCashIQD > 0) {
      msg += `🔄 <b>مقبوضات نقدية (استبدال):</b> ${closing.exchangeCashIQD.toLocaleString('en-IQ')} د.ع\n`;
    }
    if (closing.cashRefundsIQD > 0) {
      msg += `↩️ <b>مستردات نقدية (إرجاع):</b> ${closing.cashRefundsIQD.toLocaleString('en-IQ')} د.ع\n`;
    }
    if (closing.expensesIQD > 0) {
      msg += `💸 <b>المصاريف النقدية:</b> ${closing.expensesIQD.toLocaleString('en-IQ')} د.ع\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎯 <b>الكاش المتوقع بالدرج:</b> <b>${closing.expectedCashIQD.toLocaleString('en-IQ')} د.ع</b>\n`;
    msg += `📥 <b>الكاش الفعلي المحسوب:</b> <b>${closing.actualCashIQD.toLocaleString('en-IQ')} د.ع</b>\n`;
    msg += `📊 <b>النتيجة:</b> ${statusText}\n`;

    if (closing.notes && closing.notes.trim()) {
      msg += `📝 <b>ملاحظات:</b> ${closing.notes}\n`;
    }

    return await sendTelegramMessage(msg, 'HTML');
  } catch (err) {
    log.error('[telegram] Failed to send shift close notification:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}



// ─── Interactive Telegram Bot Commands (Long-Polling) ─────────────────────────

let pollingActive = false;
let pollingAbortController: AbortController | null = null;
let lastUpdateId = 0;

export async function startTelegramBotPolling(): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.enabled || !settings.botToken) {
    log.info('[telegram-bot] Bot not enabled or token missing, skipping polling.');
    return;
  }

  if (pollingActive) {
    return;
  }
  pollingActive = true;
  pollingAbortController = new AbortController();

  log.info('[telegram-bot] Starting Telegram Bot command listener (long-polling)...');

  (async () => {
    while (pollingActive) {
      try {
        const currentSettings = await getTelegramSettings();
        if (!currentSettings.enabled || !currentSettings.botToken) {
          await new Promise((resolve) => setTimeout(resolve, 8000));
          continue;
        }

        const url = `https://api.telegram.org/bot${currentSettings.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=20&allowed_updates=["message","callback_query"]`;
        const resp = await fetch(url, {
          signal: pollingAbortController?.signal,
        });

        if (!resp.ok) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const data = (await resp.json()) as {
          ok: boolean;
          result: Array<{
            update_id: number;
            message?: {
              message_id: number;
              from?: { id: number; first_name?: string; username?: string };
              chat: { id: number | string; title?: string };
              text?: string;
              date: number;
            };
            callback_query?: {
              id: string;
              from: { id: number; first_name?: string; username?: string };
              message?: {
                message_id: number;
                chat: { id: number | string; title?: string };
              };
              data?: string;
            };
          }>;
        };

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);

            // Handle Inline Button Clicks (callback_query)
            if (update.callback_query) {
              const cb = update.callback_query;
              const cbData = cb.data || '';
              const chatIdStr = String(cb.message?.chat?.id || cb.from?.id);

              if (currentSettings.chatId && chatIdStr !== currentSettings.chatId) {
                await answerTelegramCallbackQuery(cb.id, '⛔ غير مصرح لك باستخدام هذا البوت', true, currentSettings.botToken);
                continue;
              }

              if (cbData.startsWith('cmd:')) {
                const cmd = '/' + cbData.replace('cmd:', '');
                await answerTelegramCallbackQuery(cb.id, `⏳ جاري تنفيذ أمر ${cmd}...`, false, currentSettings.botToken);
                await handleTelegramBotCommand(cmd, chatIdStr, currentSettings.botToken);
                continue;
              }
            }

            // Handle Standard Text Messages
            const msg = update.message;
            if (!msg || !msg.text) continue;

            const text = msg.text.trim();
            const chatIdStr = String(msg.chat.id);

            // Security: match authorized chat ID if configured
            if (currentSettings.chatId && chatIdStr !== currentSettings.chatId) {
              log.warn(`[telegram-bot] Ignored message from unauthorized chat ID: ${chatIdStr}`);
              continue;
            }

            await handleTelegramBotCommand(text, chatIdStr, currentSettings.botToken);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || !pollingActive) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    }
  })();
}

export function stopTelegramBotPolling(): void {
  if (pollingActive) {
    pollingActive = false;
    if (pollingAbortController) {
      pollingAbortController.abort();
      pollingAbortController = null;
    }
    log.info('[telegram-bot] Stopped Telegram Bot command listener.');
  }
}

/**
 * Strip all emojis, variation selectors, zero-width characters, symbols, and punctuation
 */
function normalizeTelegramCommand(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .split('@')[0]
    // Strip zero width spaces, joiners, variation selectors
    .replace(/[\u200B-\u200D\uFE00-\uFE0F\uE000-\uF8FF]/g, '')
    // Strip all emoji ranges (Unicode 6 to 15+)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2000}-\u{2BFF}\u{E0000}-\u{E007F}]/gu, '')
    // Normalize Arabic letters
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    // Remove all punctuation and symbols except letters and numbers
    .replace(/[^\w\s\u0600-\u06FF]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Handle incoming Telegram command from owner
 */
async function handleTelegramBotCommand(commandText: string, chatId: string, botToken: string): Promise<void> {
  const slashCmd = commandText.trim().toLowerCase().split('@')[0].split(' ')[0];
  const norm = normalizeTelegramCommand(commandText);
  const override = { botToken, chatId };

  log.info(`[telegram-bot] Received command: "${commandText}" (norm: "${norm}", slash: "${slashCmd}") from chat ${chatId}`);

  try {
    // ─── 1. Activity Logs & Auditing ─────────────────────────────────────────
    if (
      slashCmd.startsWith('/activity') ||
      slashCmd.startsWith('/logs') ||
      slashCmd.startsWith('/audit') ||
      norm.includes('نشاط') ||
      norm.includes('سجل') ||
      norm.includes('حركات')
    ) {
      let filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'today';
      if (slashCmd.includes('yest') || norm.includes('امس') || norm.includes('بارح')) {
        filter = 'yesterday';
      } else if (slashCmd.includes('week') || norm.includes('اسبوع') || norm.includes('7')) {
        filter = 'week';
      } else if (slashCmd.includes('month') || norm.includes('شهر')) {
        filter = 'month';
      } else if (slashCmd.includes('all') || norm.includes('كل') || norm.includes('جميع')) {
        filter = 'all';
      }

      await sendTelegramMessage('⏳ <i>جاري جلب سجلات النشاط...</i>', 'HTML', override);
      const msg = await formatActivityLogsTelegramMessage(filter);
      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 2. Expenses ────────────────────────────────────────────────────────
    if (
      slashCmd.startsWith('/exp') ||
      norm.includes('مصروف') ||
      norm.includes('مصاريف') ||
      norm.includes('صرفيات')
    ) {
      let filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'today';
      if (slashCmd.includes('yest') || norm.includes('امس') || norm.includes('بارح')) {
        filter = 'yesterday';
      } else if (slashCmd.includes('week') || norm.includes('اسبوع') || norm.includes('7')) {
        filter = 'week';
      } else if (slashCmd.includes('month') || norm.includes('شهر')) {
        filter = 'month';
      } else if (slashCmd.includes('all') || norm.includes('كل') || norm.includes('جميع')) {
        filter = 'all';
      }

      await sendTelegramMessage('⏳ <i>جاري جلب تقرير المصروفات...</i>', 'HTML', override);
      const msg = await formatExpensesTelegramMessage(filter);
      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 3. Staff & Employee Sales ──────────────────────────────────────────
    if (
      slashCmd.startsWith('/emp') ||
      slashCmd.startsWith('/staff') ||
      norm.includes('كادر') ||
      norm.includes('موظف') ||
      norm.includes('عمال')
    ) {
      let filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'today';
      if (slashCmd.includes('yest') || norm.includes('امس') || norm.includes('بارح')) {
        filter = 'yesterday';
      } else if (slashCmd.includes('week') || norm.includes('اسبوع') || norm.includes('7')) {
        filter = 'week';
      } else if (slashCmd.includes('month') || norm.includes('شهر')) {
        filter = 'month';
      } else if (slashCmd.includes('all') || norm.includes('كل') || norm.includes('جميع')) {
        filter = 'all';
      }

      await sendTelegramMessage('⏳ <i>جاري جلب مبيعات الكادر...</i>', 'HTML', override);
      const msg = await formatEmployeeSalesTelegramMessage(filter);
      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 4. Yesterday Sales Report ──────────────────────────────────────────
    if (
      slashCmd === '/yesterday' ||
      slashCmd === '/sales_yesterday' ||
      norm.includes('امس') ||
      norm.includes('الامس') ||
      norm.includes('البارحه') ||
      norm.includes('بارحه')
    ) {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      await sendTelegramMessage(`⏳ <i>جاري جلب تقرير يوم أمس (${yesterdayStr})...</i>`, 'HTML', override, REPORT_INLINE_KEYBOARD);
      await sendTelegramDailyReportAndBackup(yesterdayStr);
      return;
    }

    // ─── 5. Month Sales Report ──────────────────────────────────────────────
    if (
      slashCmd === '/month' ||
      slashCmd === '/monthly' ||
      norm.includes('شهر')
    ) {
      await sendTelegramMessage('⏳ <i>جاري حساب إحصائيات الشهر الحالي...</i>', 'HTML', override, REPORT_INLINE_KEYBOARD);
      const now = new Date();
      const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const reports = await getReportsHelper({ startDate: firstDayOfMonth, endDate: todayStr });
      const revenue = reports?.profitAnalysis?.revenueIQD || 0;
      const profit = reports?.profitAnalysis?.netProfitIQD || 0;
      const margin = reports?.profitAnalysis?.profitMarginPercent || 0;
      const orders = reports?.dailySales?.reduce((acc: number, d: any) => acc + (d.orders || 0), 0) || 0;
      const itemsSold = reports?.dailySales?.reduce((acc: number, d: any) => acc + (d.itemsSold || 0), 0) || 0;

      // Month Expenses
      const monthExpenses = await get<{ totalExp: number; count: number }>(
        `SELECT IFNULL(SUM(amountIQD), 0) as totalExp, COUNT(*) as count FROM expenses WHERE date(expenseDate) BETWEEN date(?) AND date(?)`,
        [firstDayOfMonth, todayStr],
      );
      const totalExp = monthExpenses?.totalExp || 0;
      const dayCount = Math.max(1, now.getDate());
      const dailyAvg = Math.round(revenue / dayCount);

      let msg = `🗓️ <b>تقرير مبيعات شهر (${now.getMonth() + 1}/${now.getFullYear()})</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 <b>إجمالي المبيعات:</b> <b>${revenue.toLocaleString('en-IQ')} د.ع</b>\n`;
      msg += `📦 <b>إجمالي القطع المباعة:</b> ${itemsSold.toLocaleString('en-IQ')} قطعة\n`;
      msg += `🧾 <b>عدد الفواتير:</b> ${orders} فاتورة\n`;
      msg += `💵 <b>صافي أرباح المبيعات:</b> ${profit.toLocaleString('en-IQ')} د.ع (${margin.toFixed(1)}%)\n`;
      msg += `📉 <b>إجمالي المصروفات:</b> ${totalExp.toLocaleString('en-IQ')} د.ع\n`;
      msg += `📊 <b>المعدل اليومي للمبيعات:</b> ${dailyAvg.toLocaleString('en-IQ')} د.ع/يوم\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `✨ <i>التقرير محدث حتى اللحظة.</i>`;

      await sendTelegramMessage(msg, 'HTML', override, REPORT_INLINE_KEYBOARD);
      return;
    }

    // ─── 6. Week Sales Report ───────────────────────────────────────────────
    if (
      slashCmd === '/week' ||
      slashCmd === '/weekly' ||
      norm.includes('اسبوع') ||
      norm.includes('7 ايام')
    ) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startDate = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const reports = await getReportsHelper({ startDate, endDate });
      const revenue = reports?.profitAnalysis?.revenueIQD || 0;
      const profit = reports?.profitAnalysis?.netProfitIQD || 0;
      const orders = reports?.dailySales?.reduce((acc: number, d: any) => acc + (d.orders || 0), 0) || 0;
      const itemsSold = reports?.dailySales?.reduce((acc: number, d: any) => acc + (d.itemsSold || 0), 0) || 0;

      let msg = `📅 <b>تقرير آخر 7 أيام (${startDate} ⬅️ ${endDate})</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 <b>إجمالي المبيعات:</b> <b>${revenue.toLocaleString('en-IQ')} د.ع</b>\n`;
      msg += `💵 <b>صافي الأرباح:</b> ${profit.toLocaleString('en-IQ')} د.ع\n`;
      msg += `📦 <b>القطع المباعة:</b> ${itemsSold.toLocaleString('en-IQ')} قطعة\n`;
      msg += `🧾 <b>عدد الفواتير:</b> ${orders} فاتورة\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      await sendTelegramMessage(msg, 'HTML', override, REPORT_INLINE_KEYBOARD);
      return;
    }

    // ─── 7. Low Stock Alerts ────────────────────────────────────────────────
    if (
      slashCmd === '/stock' ||
      slashCmd === '/lowstock' ||
      slashCmd === '/inventory' ||
      norm.includes('نواقص') ||
      norm.includes('مخزون') ||
      norm.includes('نفذ') ||
      norm.includes('ناقص')
    ) {
      const lowStockItems = await all<{
        productName: string;
        sku: string | null;
        color: string | null;
        size: string | null;
        stockOnHand: number;
        salePriceIQD: number;
      }>(
        `
        SELECT p.name as productName, pv.sku, pv.color, pv.size,
               IFNULL(SUM(vs.quantity), 0) as stockOnHand,
               pv.defaultPriceIQD as salePriceIQD
        FROM product_variants pv
        JOIN products p ON p.id = pv.productId
        LEFT JOIN variant_stock vs ON vs.variantId = pv.id
        WHERE pv.isActive = 1 AND p.isActive = 1
        GROUP BY pv.id
        HAVING stockOnHand <= 3
        ORDER BY stockOnHand ASC, p.name ASC
        LIMIT 25
      `,
      );

      if (!lowStockItems || lowStockItems.length === 0) {
        await sendTelegramMessage(`✅ <b>المخزون ممتاز!</b>\nلا توجد منتجات منخفضة المخزون (أقل من 3 قطع) حالياً.`, 'HTML', override);
        return;
      }

      let msg = `⚠️ <b>تنبيه نواقص المخزون (3 قطع أو أقل):</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      lowStockItems.forEach((item, index) => {
        const variantDesc = [item.color, item.size].filter(Boolean).join(' / ');
        const badge = item.stockOnHand <= 0 ? '🔴 <b>[نفذ]</b>' : `🟡 <b>[باقي ${item.stockOnHand}]</b>`;
        msg += `${index + 1}. <b>${escapeHtml(item.productName)}</b> ${badge}\n`;
        if (variantDesc) {
          msg += `   └ <i>${escapeHtml(variantDesc)}</i>`;
        }
        if (item.sku) {
          msg += ` | <code>${escapeHtml(item.sku)}</code>`;
        }
        msg += `\n`;
      });

      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📌 <i>إجمالي النواقص المعروضة: ${lowStockItems.length} صنف</i>`;

      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 8. Top Selling Products ───────────────────────────────────────────
    if (
      slashCmd === '/top' ||
      slashCmd === '/bestsellers' ||
      slashCmd === '/best' ||
      norm.includes('اكثر مبيعا') ||
      norm.includes('الاعلى مبيعا') ||
      norm.includes('اعلى مبيعا') ||
      norm.includes('توب')
    ) {
      const topItems = await all<{
        productName: string;
        color: string | null;
        size: string | null;
        totalQty: number;
        totalAmount: number;
      }>(
        `
        SELECT p.name as productName, pv.color, pv.size, SUM(si.quantity) as totalQty, SUM(si.lineTotalIQD) as totalAmount
        FROM sale_items si
        JOIN product_variants pv ON pv.id = si.variantId
        JOIN products p ON p.id = pv.productId
        JOIN sales s ON s.id = si.saleId
        WHERE date(s.saleDate, 'localtime') >= date('now', 'start of month', 'localtime')
        GROUP BY si.variantId
        ORDER BY totalQty DESC
        LIMIT 10
      `,
      );

      if (!topItems || topItems.length === 0) {
        await sendTelegramMessage(`📊 لا توجد مبيعات مسجلة لهذا الشهر حتى الآن.`, 'HTML', override);
        return;
      }

      let msg = `🏆 <b>أعلى 10 منتجات مبيعاً هذا الشهر:</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      topItems.forEach((item, idx) => {
        const medal = medals[idx] || '🔹';
        const variantDesc = [item.color, item.size].filter(Boolean).join(' • ');
        msg += `${medal} <b>${escapeHtml(item.productName)}</b>\n`;
        msg += `   └ بيع: <b>${item.totalQty} قطعة</b> | 💰 ${item.totalAmount.toLocaleString('en-IQ')} د.ع\n`;
        if (variantDesc) {
          msg += `   └ <i>${escapeHtml(variantDesc)}</i>\n`;
        }
      });

      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 9. Cash Drawer & Register ──────────────────────────────────────────
    if (
      slashCmd === '/cash' ||
      slashCmd === '/drawer' ||
      slashCmd === '/box' ||
      norm.includes('كاش') ||
      norm.includes('صندوق') ||
      norm.includes('درج') ||
      norm.includes('قاصه')
    ) {
      const paymentSummary = await get<{
        cashSales: number;
        cardSales: number;
        mixedSales: number;
        totalOrders: number;
      }>(
        `
        SELECT 
          IFNULL(SUM(CASE WHEN paymentMethod = 'cash' THEN totalIQD ELSE 0 END), 0) as cashSales,
          IFNULL(SUM(CASE WHEN paymentMethod = 'card' THEN totalIQD ELSE 0 END), 0) as cardSales,
          IFNULL(SUM(CASE WHEN paymentMethod = 'mixed' THEN totalIQD ELSE 0 END), 0) as mixedSales,
          COUNT(*) as totalOrders
        FROM sales
        WHERE date(saleDate) = date('now', 'localtime')
      `,
      );

      const refundSummary = await get<{ totalRefund: number; totalCollected: number }>(
        `SELECT 
           IFNULL(SUM(CASE WHEN paymentMethod = 'cash' OR paymentMethod IS NULL THEN refundAmountIQD ELSE 0 END), 0) as totalRefund,
           IFNULL(SUM(CASE WHEN paymentMethod = 'cash' OR paymentMethod IS NULL THEN customerPaidIQD ELSE 0 END), 0) as totalCollected
         FROM returns 
         WHERE date(createdAt) = date('now', 'localtime')`,
      );

      const expenseSummary = await get<{ totalExp: number }>(
        `SELECT IFNULL(SUM(amountIQD), 0) as totalExp FROM expenses WHERE date(expenseDate) = date('now', 'localtime')`,
      );

      const cashSales = paymentSummary?.cashSales || 0;
      const cardSales = paymentSummary?.cardSales || 0;
      const mixedSales = paymentSummary?.mixedSales || 0;
      const totalRefund = refundSummary?.totalRefund || 0;
      const totalCollected = refundSummary?.totalCollected || 0;
      const totalExp = expenseSummary?.totalExp || 0;
      const netCashInDrawer = cashSales + totalCollected - totalRefund - totalExp;

      let msg = `💵 <b>تقرير الصندوق والمقبوضات (اليوم):</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🟢 <b>مبيعات نقدي (كاش):</b> ${cashSales.toLocaleString('en-IQ')} د.ع\n`;
      msg += `💳 <b>مبيعات بطاقة (كي كارد):</b> ${cardSales.toLocaleString('en-IQ')} د.ع\n`;
      if (mixedSales > 0) {
        msg += `🔀 <b>مبيعات دفع مختلط:</b> ${mixedSales.toLocaleString('en-IQ')} د.ع\n`;
      }
      if (totalCollected > 0) {
        msg += `🛍️ <b>فروقات استبدال مقبوضة كاش:</b> +${totalCollected.toLocaleString('en-IQ')} د.ع\n`;
      }
      if (totalRefund > 0) {
        msg += `🔄 <b>مسترجعات كاش:</b> -${totalRefund.toLocaleString('en-IQ')} د.ع\n`;
      }
      if (totalExp > 0) {
        msg += `📉 <b>مصاريف كاش:</b> -${totalExp.toLocaleString('en-IQ')} د.ع\n`;
      }
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 <b>الكاش الصافي المتوقع بالدرج:</b> <b>${netCashInDrawer.toLocaleString('en-IQ')} د.ع</b>\n`;
      msg += `🧾 <b>إجمالي الفواتير:</b> ${paymentSummary?.totalOrders || 0} فاتورة`;

      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 10. Database Backup ────────────────────────────────────────────────
    if (
      slashCmd === '/backup' ||
      slashCmd === '/db' ||
      norm.includes('نسخه احتياطيه') ||
      norm.includes('احتياطيه') ||
      norm.includes('باك اب') ||
      norm.includes('باكاب')
    ) {
      await sendTelegramMessage('⏳ <i>جاري إنشاء نسخة احتياطية لقاعدة البيانات ورفعها...</i>', 'HTML', override);
      const backupInfo = await createBackup();
      const now = new Date().toLocaleString('ar-IQ');
      const caption = `📦 <b>نسخة احتياطية لقاعدة البيانات (مباشرة)</b>\n🏷️ الملف: <code>${backupInfo.filename}</code>\n📅 التاريخ: ${now}\n📊 الحجم: ${(backupInfo.size / (1024 * 1024)).toFixed(2)} MB`;
      await sendTelegramDocument(backupInfo.filepath, caption, override);
      return;
    }

    // ─── 11. System Status ──────────────────────────────────────────────────
    if (
      slashCmd === '/status' ||
      slashCmd === '/ping' ||
      slashCmd === '/check' ||
      norm.includes('فحص') ||
      norm.includes('حاله') ||
      norm.includes('اتصال') ||
      norm.includes('شغال')
    ) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const reports = await getReportsHelper({ startDate: todayStr, endDate: todayStr });
      const totalRevenue = reports?.profitAnalysis?.revenueIQD || 0;
      const netProfit = reports?.profitAnalysis?.netProfitIQD || 0;
      const totalOrders = reports?.dailySales?.reduce((acc: number, d: any) => acc + (d.orders || 0), 0) || 0;

      let statusMsg = `🟢 <b>نظام EVA POS متصل ويعمل الآن</b>\n`;
      statusMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      statusMsg += `🧾 <b>فواتير اليوم:</b> ${totalOrders} فاتورة\n`;
      statusMsg += `💰 <b>مبيعات اليوم:</b> <b>${totalRevenue.toLocaleString('en-IQ')} د.ع</b>\n`;
      statusMsg += `💵 <b>صافي الأرباح:</b> ${netProfit.toLocaleString('en-IQ')} د.ع\n`;
      statusMsg += `🕒 <b>الوقت الحالي للنظام:</b> ${now.toLocaleTimeString('ar-IQ', { hour12: true })}\n`;
      statusMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      statusMsg += `💡 أرسل /help لعرض قائمة بجميع الأوامر المتاحة.`;

      await sendTelegramMessage(statusMsg, 'HTML', override);
      return;
    }

    // ─── 12. Today's Sales Report ───────────────────────────────────────────
    if (
      slashCmd === '/report' ||
      slashCmd === '/today' ||
      slashCmd === '/sales' ||
      slashCmd === '/sales_today' ||
      norm.includes('مبيعات') ||
      norm.includes('تقرير') ||
      norm.includes('اليوم')
    ) {
      await sendTelegramMessage('⏳ <i>جاري إعداد تقرير مبيعات اليوم المباشر...</i>', 'HTML', override, REPORT_INLINE_KEYBOARD);
      await sendTelegramDailyReportAndBackup();
      return;
    }

    // ─── 13. Product & Barcode Price/Stock Lookup ───────────────────────────
    if (
      slashCmd === '/p' ||
      slashCmd === '/product' ||
      slashCmd === '/price' ||
      slashCmd === '/item' ||
      slashCmd === '/find' ||
      slashCmd === '/barcode' ||
      norm.includes('فحص منتج') ||
      norm.includes('سعر') ||
      norm.includes('باركود') ||
      norm.includes('استعلام')
    ) {
      // Extract search query if passed like "/p 123456" or "سعر قميص"
      let query = commandText.trim();
      if (slashCmd.startsWith('/')) {
        query = query.substring(slashCmd.length).trim();
      } else {
        // Strip out trigger words
        query = query
          .replace(/^(🔍\s*)?(فحص منتج\s*\/?\s*باركود|فحص منتج|فحص باركود|فحص|سعر|باركود|استعلام)\s*:?\s*/iu, '')
          .trim();
      }

      if (!query) {
        await sendTelegramMessage(
          `🔍 <b>فحص واستعلام المنتجات والباركود:</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `أرسل أي باركود أو اسم منتج أو كود SKU مباشرة وسيقوم البوت بالبحث الفوري عنه وعرض سعره وتكلفته ومخزونه.\n\n` +
          `💡 <b>طرق الاستخدام:</b>\n` +
          `  ▫️ أرسل الباركود مباشرة: <code>628100012345</code>\n` +
          `  ▫️ أو اكتب: <code>/p قميص</code>\n` +
          `  ▫️ أو اكتب: <code>سعر فستان</code>`,
          'HTML',
          override,
          MAIN_REPLY_KEYBOARD,
        );
        return;
      }

      const resultMsg = await handleProductQueryTelegram(query);
      await sendTelegramMessage(resultMsg, 'HTML', override, MAIN_REPLY_KEYBOARD);
      return;
    }

    // ─── 14. Start / Help / Menu ────────────────────────────────────────────
    if (
      slashCmd === '/start' ||
      slashCmd === '/help' ||
      slashCmd === '/menu' ||
      norm.includes('اوامر') ||
      norm.includes('قائمه') ||
      norm.includes('مساعده') ||
      norm.includes('ازرار') ||
      norm.includes('منيو')
    ) {
      let helpMsg = `🤖 <b>أزرار وقائمة بوت كاشير EVA POS الذكي:</b>\n`;
      helpMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      helpMsg += `💡 <i>تم تفعيل أزرار التحكم السريعة أسفل الشاشة للوصول المباشر!</i>\n\n`;
      helpMsg += `📊 <b>التقارير والمبيعات:</b>\n`;
      helpMsg += `  /report — تقرير مبيعات وأرباح اليوم\n`;
      helpMsg += `  /yesterday — تقرير مبيعات يوم أمس\n`;
      helpMsg += `  /week — تقرير مبيعات آخر 7 أيام\n`;
      helpMsg += `  /month — تقرير مبيعات الشهر الحالي\n`;
      helpMsg += `\n`;
      helpMsg += `📋 <b>سجلات النشاط والرقابة:</b>\n`;
      helpMsg += `  /activity — سجلات عمليات ونشاط اليوم\n`;
      helpMsg += `  /activity_yesterday — سجلات نشاط يوم أمس\n`;
      helpMsg += `  /activity_week — سجلات نشاط آخر 7 أيام\n`;
      helpMsg += `  /activity_month — سجلات نشاط الشهر الحالي\n`;
      helpMsg += `  /activity_all — أحدث العمليات المسجلة\n`;
      helpMsg += `\n`;
      helpMsg += `📦 <b>المخزون والمنتجات:</b>\n`;
      helpMsg += `  /p [اسم/باركود] — فحص سعر وتكلفة ومخزون أي منتج\n`;
      helpMsg += `  /stock — تنبيه بالنواقص والمنتجات المنتهية\n`;
      helpMsg += `  /top — أعلى 10 منتجات مبيعاً هذا الشهر\n`;
      helpMsg += `\n`;
      helpMsg += `💰 <b>المالية والمصروفات والموظفين:</b>\n`;
      helpMsg += `  /cash — فحص الصندوق وحساب الكاش بالدرج\n`;
      helpMsg += `  /expenses — تقرير بمصروفات اليوم\n`;
      helpMsg += `  /expenses_yesterday — تقرير مصروفات يوم أمس\n`;
      helpMsg += `  /expenses_week — تقرير مصروفات آخر 7 أيام\n`;
      helpMsg += `  /expenses_month — تقرير مصروفات الشهر الحالي\n`;
      helpMsg += `  /employees — مبيعات الكادر والموظفين اليوم\n`;
      helpMsg += `  /employees_yesterday — مبيعات الكادر يوم أمس\n`;
      helpMsg += `  /employees_week — مبيعات الكادر آخر 7 أيام\n`;
      helpMsg += `  /employees_month — مبيعات الكادر الشهر الحالي\n`;
      helpMsg += `\n`;
      helpMsg += `⚙️ <b>النظام والأمان والموافقات:</b>\n`;
      helpMsg += `  /status — فحص اتصال النظام وحالته\n`;
      helpMsg += `  /backup — طلب نسخة احتياطية فورية (.db)\n`;
      helpMsg += `  /help — عرض قائمة الأوامر هذه\n`;
      helpMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      helpMsg += `✨ <i>يمكنك الضغط على الأزرار السريعة أو كتابة الكلمات بالعربي مباشرة.</i>`;

      await sendTelegramMessage(helpMsg, 'HTML', override, MAIN_REPLY_KEYBOARD);
      return;
    }

    // ─── Auto-search Fallback: Check if message is a product name or barcode ──
    const trimmedInput = commandText.trim();
    if (trimmedInput && !trimmedInput.startsWith('/')) {
      const searchResult = await handleProductQueryTelegram(trimmedInput);
      if (!searchResult.startsWith('❌ لم يتم العثور')) {
        await sendTelegramMessage(searchResult, 'HTML', override, MAIN_REPLY_KEYBOARD);
        return;
      }
    }

    // Default response for unhandled text
    await sendTelegramMessage(
      `❓ أمر غير معروف: "<b>${escapeHtml(commandText)}</b>".\n` +
      `اضغط على الأزرار أسفل الشاشة أو أرسل <b>/help</b>، أو أرسل أي باركود لفحصه مباشرة.`,
      'HTML',
      override,
      MAIN_REPLY_KEYBOARD,
    );
  } catch (cmdErr) {
    log.error('[telegram-bot] Command execution error:', cmdErr);
    await sendTelegramMessage(`❌ حدث خطأ أثناء معالجة الأمر: ${cmdErr instanceof Error ? cmdErr.message : String(cmdErr)}`, 'HTML', override);
  }
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

// ─── Activity Log Formatter for Telegram Commands ─────────────────────────────

/**
 * Format activity logs history into a clean, comprehensive Telegram report
 */
export async function formatActivityLogsTelegramMessage(
  filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'today',
): Promise<string> {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let whereClause = `date(a.createdAt, 'localtime') = ?`;
    let params: any[] = [todayStr];
    let titleStr = `سجلات نشاط اليوم (${todayStr})`;

    if (filter === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      whereClause = `date(a.createdAt, 'localtime') = ?`;
      params = [yestStr];
      titleStr = `سجلات نشاط يوم أمس (${yestStr})`;
    } else if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const weekStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
      whereClause = `date(a.createdAt, 'localtime') BETWEEN ? AND ?`;
      params = [weekStr, todayStr];
      titleStr = `سجلات نشاط آخر 7 أيام (${weekStr} ⬅️ ${todayStr})`;
    } else if (filter === 'month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      whereClause = `date(a.createdAt, 'localtime') BETWEEN ? AND ?`;
      params = [monthStart, todayStr];
      titleStr = `سجلات نشاط شهر (${now.getMonth() + 1}/${now.getFullYear()})`;
    } else if (filter === 'all') {
      whereClause = `1=1`;
      params = [];
      titleStr = `أحدث سجلات النشاط والرقابة`;
    }

    const rows = await all<{
      id: number;
      userId: number;
      action: string;
      entity: string | null;
      entityId: number | null;
      metadata: string | null;
      createdAt: string;
      userName?: string;
      username?: string;
      userRole?: string;
    }>(
      `
      SELECT a.id, a.userId, a.action, a.entity, a.entityId, a.metadata, a.createdAt,
             u.username as userName, u.username, u.role as userRole
      FROM activity_logs a
      LEFT JOIN users u ON u.id = a.userId
      WHERE ${whereClause}
      ORDER BY datetime(a.createdAt) DESC
      LIMIT 25
      `,
      params,
    );

    if (!rows || rows.length === 0) {
      return `📋 <b>${escapeHtml(titleStr)}</b>\n━━━━━━━━━━━━━━━━━━━━\nℹ️ لا توجد أي سجلات نشاط مسجلة لهذه الفترة.`;
    }

    const actionIcons: Record<string, string> = {
      delete: '🗑️ عملية حذف',
      update: '✏️ تعديل بيانات / سعر',
      create: '➕ إضافة عنصر جديد',
      bulk_update: '📦 تعديل جماعي',
      reset: '🔥 تصفير النظام',
      password_change: '🔑 تغيير كلمة المرور',
      return: '🔄 إرجاع / استرداد',
      deactivate: '⛔ تعطيل حساب',
      inventory_adjust: '📊 تعديل كمية المخزون',
      reject: '❌ إلغاء / رفض طلب',
      login: '🔓 تسجيل دخول',
      logout: '🔒 تسجيل خروج',
      pos_lock: '🔒 قفل الشاشة',
      pos_unlock: '🔓 فك قفل الشاشة',
    };

    let msg = `📋 <b>${escapeHtml(titleStr)}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 إجمالي العمليات المسجلة: <b>${rows.length} عملية</b>\n\n`;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const icon = actionIcons[row.action.toLowerCase()] || `⚡ ${escapeHtml(row.action)}`;
      const who = row.userName || row.username || (row.userId ? `مستخدم #${row.userId}` : 'مدير النظام');
      const role = row.userRole ? `(${row.userRole})` : '';

      let metaParsed: Record<string, unknown> = {};
      if (row.metadata) {
        try {
          metaParsed = JSON.parse(row.metadata);
        } catch {}
      }

      let itemDesc = row.entity ? `${row.entity} #${row.entityId ?? ''}` : '';
      if (row.entity === 'variant' && metaParsed['المنتج']) {
        itemDesc = String(metaParsed['المنتج']);
      } else if (row.entity === 'product' && metaParsed['الاسم']) {
        itemDesc = String(metaParsed['الاسم']);
      } else if (row.entity === 'sale') {
        itemDesc = `فاتورة بيع #${row.entityId}`;
      }

      const timeStr = new Date(row.createdAt.endsWith('Z') ? row.createdAt : row.createdAt + 'Z').toLocaleTimeString('ar-IQ', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      msg += `<b>${i + 1}. ${icon}</b>\n`;
      msg += `   👤 <b>${escapeHtml(who)}</b> ${role}\n`;
      if (itemDesc) {
        msg += `   🏷️ ${escapeHtml(itemDesc)}\n`;
      }

      // Format metadata details
      if (Object.keys(metaParsed).length > 0) {
        for (const [k, v] of Object.entries(metaParsed)) {
          if (k !== 'المنتج' && k !== 'الاسم') {
            msg += `   • ${escapeHtml(k)}: <code>${escapeHtml(String(v))}</code>\n`;
          }
        }
      }

      msg += `   🕒 <code>${timeStr}</code>\n\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 <b>أوامر السجلات الأخرى:</b>\n`;
    msg += `• /activity — سجلات نشاط اليوم\n`;
    msg += `• /activity_yesterday — سجلات نشاط الأمس\n`;
    msg += `• /activity_week — سجلات آخر 7 أيام\n`;
    msg += `• /activity_month — سجلات هذا الشهر\n`;
    msg += `• /activity_all — أحدث العمليات\n`;

    return msg;
  } catch (err) {
    log.error('[telegram] Failed to format activity logs:', err);
    return `❌ حدث خطأ أثناء جلب سجلات النشاط: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Expenses Formatter for Telegram Commands ─────────────────────────────────

/**
 * Format expenses history into a clean, comprehensive Telegram report
 */
export async function formatExpensesTelegramMessage(
  filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'today',
): Promise<string> {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let whereClause = `date(e.expenseDate) = ?`;
    let params: any[] = [todayStr];
    let titleStr = `مصروفات اليوم (${todayStr})`;

    if (filter === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      whereClause = `date(e.expenseDate) = ?`;
      params = [yestStr];
      titleStr = `مصروفات يوم أمس (${yestStr})`;
    } else if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const weekStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
      whereClause = `date(e.expenseDate) BETWEEN ? AND ?`;
      params = [weekStr, todayStr];
      titleStr = `مصروفات آخر 7 أيام (${weekStr} ⬅️ ${todayStr})`;
    } else if (filter === 'month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      whereClause = `date(e.expenseDate) BETWEEN ? AND ?`;
      params = [monthStart, todayStr];
      titleStr = `مصروفات شهر (${now.getMonth() + 1}/${now.getFullYear()})`;
    } else if (filter === 'all') {
      whereClause = `1=1`;
      params = [];
      titleStr = `أحدث المصروفات المسجلة`;
    }

    const rows = await all<{
      id: number;
      category: string;
      amountIQD: number;
      note?: string | null;
      expenseDate: string;
      enteredByName?: string;
    }>(
      `
      SELECT e.id, e.category, e.amountIQD, e.note, e.expenseDate,
             COALESCE(u.username, 'مستخدم #' || e.enteredBy) as enteredByName
      FROM expenses e
      LEFT JOIN users u ON u.id = e.enteredBy
      WHERE ${whereClause}
      ORDER BY datetime(e.expenseDate) DESC
      LIMIT 30
      `,
      params,
    );

    const totalExp = rows.reduce((acc, row) => acc + (row.amountIQD || 0), 0);

    let msg = `📉 <b>${escapeHtml(titleStr)}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (!rows || rows.length === 0) {
      msg += `ℹ️ لم يتم تسجيل أي مصروفات لهذه الفترة.\n`;
    } else {
      msg += `📊 عدد القيود: <b>${rows.length} قيد</b>\n\n`;
      rows.forEach((exp, idx) => {
        const cat = exp.category || 'عام';
        const amount = (exp.amountIQD || 0).toLocaleString('en-IQ');
        const user = exp.enteredByName ? ` <i>[${escapeHtml(exp.enteredByName)}]</i>` : '';
        const note = exp.note ? ` — (${escapeHtml(exp.note)})` : '';
        msg += `${idx + 1}. <b>${escapeHtml(cat)}:</b> <code>${amount} د.ع</code>${user}${note}\n`;
      });
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 <b>الإجمالي:</b> <b>${totalExp.toLocaleString('en-IQ')} د.ع</b>\n\n`;
    msg += `💡 <b>أوامر المصروفات المتاحة:</b>\n`;
    msg += `• /expenses — مصروفات اليوم\n`;
    msg += `• /expenses_yesterday — مصروفات الأمس\n`;
    msg += `• /expenses_week — مصروفات آخر 7 أيام\n`;
    msg += `• /expenses_month — مصروفات هذا الشهر\n`;
    msg += `• /expenses_all — أحدث المصروفات\n`;

    return msg;
  } catch (err) {
    log.error('[telegram] Failed to format expenses:', err);
    return `❌ حدث خطأ أثناء جلب المصروفات: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Employee Sales Formatter for Telegram Commands ───────────────────────────

/**
 * Format employee sales history into a clean, comprehensive Telegram report
 */
export async function formatEmployeeSalesTelegramMessage(
  filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'today',
): Promise<string> {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let whereClause = `date(s.saleDate, 'localtime') = ?`;
    let params: any[] = [todayStr];
    let titleStr = `مبيعات الكادر والموظفين — اليوم (${todayStr})`;

    if (filter === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      whereClause = `date(s.saleDate, 'localtime') = ?`;
      params = [yestStr];
      titleStr = `مبيعات الكادر والموظفين — يوم أمس (${yestStr})`;
    } else if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const weekStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
      whereClause = `date(s.saleDate, 'localtime') BETWEEN ? AND ?`;
      params = [weekStr, todayStr];
      titleStr = `مبيعات الكادر والموظفين — آخر 7 أيام (${weekStr} ⬅️ ${todayStr})`;
    } else if (filter === 'month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      whereClause = `date(s.saleDate, 'localtime') BETWEEN ? AND ?`;
      params = [monthStart, todayStr];
      titleStr = `مبيعات الكادر والموظفين — شهر (${now.getMonth() + 1}/${now.getFullYear()})`;
    } else if (filter === 'all') {
      whereClause = `1=1`;
      params = [];
      titleStr = `إجمالي مبيعات الكادر والموظفين (الكل)`;
    }

    const empSales = await all<{
      employeeName: string | null;
      ordersCount: number;
      totalSold: number;
      totalProfit: number;
    }>(
      `
      SELECT 
        IFNULL(e.name, 'كاشير عام / مباشر') as employeeName,
        COUNT(s.id) as ordersCount,
        IFNULL(SUM(s.totalIQD), 0) as totalSold,
        IFNULL(SUM(s.profitIQD), 0) as totalProfit
      FROM sales s
      LEFT JOIN employees e ON e.id = s.employeeId
      WHERE ${whereClause}
      GROUP BY s.employeeId
      ORDER BY totalSold DESC
      `,
      params,
    );

    const grandTotalSold = empSales.reduce((acc, row) => acc + (row.totalSold || 0), 0);
    const grandTotalOrders = empSales.reduce((acc, row) => acc + (row.ordersCount || 0), 0);

    let msg = `👥 <b>${escapeHtml(titleStr)}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (!empSales || empSales.length === 0) {
      msg += `ℹ️ لا توجد مبيعات مسجلة للموظفين في هذه الفترة.\n`;
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      empSales.forEach((emp, idx) => {
        const icon = medals[idx] || '👤';
        msg += `${icon} <b>${escapeHtml(emp.employeeName || 'كاشير')}:</b>\n`;
        msg += `   • المبيعات: <b>${emp.totalSold.toLocaleString('en-IQ')} د.ع</b> (${emp.ordersCount} فاتورة)\n`;
        if (emp.totalProfit > 0) {
          msg += `   • الأرباح: <code>${Math.round(emp.totalProfit).toLocaleString('en-IQ')} د.ع</code>\n`;
        }
      });
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 <b>إجمالي مبيعات الفترة:</b> <b>${grandTotalSold.toLocaleString('en-IQ')} د.ع</b> (${grandTotalOrders} فاتورة)\n\n`;
    msg += `💡 <b>أوامر مبيعات الكادر المتاحة:</b>\n`;
    msg += `• /employees — مبيعات الكادر اليوم\n`;
    msg += `• /employees_yesterday — مبيعات الكادر أمس\n`;
    msg += `• /employees_week — مبيعات الكادر آخر 7 أيام\n`;
    msg += `• /employees_month — مبيعات الكادر هذا الشهر\n`;
    msg += `• /employees_all — إجمالي الكادر\n`;

    return msg;
  } catch (err) {
    log.error('[telegram] Failed to format employee sales:', err);
    return `❌ حدث خطأ أثناء جلب مبيعات الموظفين: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Product & Stock Lookup for Telegram Commands ─────────────────────────────

/**
 * Query products and stock for Telegram bot
 */
export async function handleProductQueryTelegram(queryText: string): Promise<string> {
  const q = (queryText || '').trim();
  if (!q) {
    return '🔍 <b>فحص واستعلام المنتجات:</b>\nأرسل الباركود أو اسم المنتج مباشرة لمعرفة سعره وتكلفته ومخزونه.';
  }

  try {
    const rateSetting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['exchangeRate']);
    const exchangeRate = rateSetting ? parseFloat(rateSetting.value) || 1520 : 1520;

    // Generate candidates for barcode / SKU
    const candidates = new Set<string>();
    candidates.add(q);
    const stripped = q.replace(/^0+/, '');
    if (stripped) {
      candidates.add(stripped);
      candidates.add('0' + stripped);
      candidates.add('00' + stripped);
      candidates.add('000' + stripped);
    }
    if (q.startsWith('0')) {
      const s1 = q.substring(1);
      if (s1) candidates.add(s1);
    } else {
      candidates.add('0' + q);
    }
    if (q.length === 12) {
      candidates.add('0' + q);
    } else if (q.length === 13 && q.startsWith('0')) {
      candidates.add(q.substring(1));
    }
    const candidateList = Array.from(candidates).filter(Boolean);
    const placeholders = candidateList.map(() => '?').join(', ');
    const lowerPlaceholders = candidateList.map(() => '?').join(', ');

    const likeParam = `%${q.toLowerCase()}%`;

    // 1. First try candidate / exact barcode & SKU matching
    let rows = await all<{
      productId: number;
      productName: string;
      category?: string | null;
      variantId: number;
      size?: string | null;
      color?: string | null;
      sku: string;
      barcode?: string | null;
      defaultPriceIQD: number;
      avgCostUSD: number;
      purchaseCostUSD: number;
      lastPurchaseCostUSD: number;
      stockOnHand: number;
    }>(
      `
      SELECT
        p.id AS productId,
        p.name AS productName,
        p.category,
        pv.id AS variantId,
        pv.size,
        pv.color,
        pv.sku,
        pv.barcode,
        pv.defaultPriceIQD,
        pv.avgCostUSD,
        pv.purchaseCostUSD,
        pv.lastPurchaseCostUSD,
        IFNULL(SUM(vs.quantity), 0) AS stockOnHand
      FROM product_variants pv
      JOIN products p ON p.id = pv.productId
      LEFT JOIN variant_stock vs ON vs.variantId = pv.id
      WHERE pv.isActive = 1 AND p.isActive = 1
        AND (
          pv.barcode IN (${placeholders}) OR
          pv.sku IN (${placeholders}) OR
          LOWER(pv.barcode) IN (${lowerPlaceholders}) OR
          LOWER(pv.sku) IN (${lowerPlaceholders})
        )
      GROUP BY pv.id
      ORDER BY
        CASE
          WHEN pv.barcode = ? THEN 1
          WHEN pv.sku = ? THEN 2
          WHEN pv.barcode = ? THEN 3
          WHEN pv.sku = ? THEN 4
          ELSE 5
        END
      LIMIT 10
      `,
      [
        ...candidateList,
        ...candidateList,
        ...candidateList.map((c) => c.toLowerCase()),
        ...candidateList.map((c) => c.toLowerCase()),
        q,
        q,
        stripped || q,
        stripped || q,
      ],
    );

    // 2. If no exact barcode match, search by product name / category
    if (!rows || rows.length === 0) {
      rows = await all<{
        productId: number;
        productName: string;
        category?: string | null;
        variantId: number;
        size?: string | null;
        color?: string | null;
        sku: string;
        barcode?: string | null;
        defaultPriceIQD: number;
        avgCostUSD: number;
        purchaseCostUSD: number;
        lastPurchaseCostUSD: number;
        stockOnHand: number;
      }>(
        `
        SELECT
          p.id AS productId,
          p.name AS productName,
          p.category,
          pv.id AS variantId,
          pv.size,
          pv.color,
          pv.sku,
          pv.barcode,
          pv.defaultPriceIQD,
          pv.avgCostUSD,
          pv.purchaseCostUSD,
          pv.lastPurchaseCostUSD,
          IFNULL(SUM(vs.quantity), 0) AS stockOnHand
        FROM product_variants pv
        JOIN products p ON p.id = pv.productId
        LEFT JOIN variant_stock vs ON vs.variantId = pv.id
        WHERE pv.isActive = 1 AND p.isActive = 1
          AND (
            LOWER(p.name) LIKE ? OR
            LOWER(p.category) LIKE ? OR
            LOWER(pv.sku) LIKE ? OR
            LOWER(pv.barcode) LIKE ?
          )
        GROUP BY pv.id
        ORDER BY
          CASE
            WHEN LOWER(p.name) = LOWER(?) THEN 1
            WHEN LOWER(p.name) LIKE ? THEN 2
            ELSE 3
          END
        LIMIT 25
        `,
        [likeParam, likeParam, likeParam, likeParam, q, `${q.toLowerCase()}%`],
      );
    }

    if (!rows || rows.length === 0) {
      return `❌ لم يتم العثور على أي منتج يطابق: "<b>${escapeHtml(q)}</b>"\n\n💡 <i>تأكد من كتابة الاسم أو الباركود بشكل صحيح، أو ابحث بجزء من الاسم.</i>`;
    }

    // Group rows by productId
    const productsMap = new Map<
      number,
      {
        productId: number;
        productName: string;
        category?: string | null;
        variants: typeof rows;
      }
    >();

    for (const r of rows) {
      if (!productsMap.has(r.productId)) {
        productsMap.set(r.productId, {
          productId: r.productId,
          productName: r.productName,
          category: r.category,
          variants: [],
        });
      }
      productsMap.get(r.productId)!.variants.push(r);
    }

    const uniqueProducts = Array.from(productsMap.values());

    // If multiple distinct products matched (e.g. searching "قميص" matched 3 different models)
    if (uniqueProducts.length > 1) {
      let listMsg = `🔍 <b>نتائج البحث عن "<code>${escapeHtml(q)}</code>" (${uniqueProducts.length} منتجات):</b>\n`;
      listMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      uniqueProducts.slice(0, 6).forEach((prod, idx) => {
        const totalStock = prod.variants.reduce((acc, v) => acc + (v.stockOnHand || 0), 0);
        const minPrice = Math.min(...prod.variants.map((v) => v.defaultPriceIQD || 0));
        const maxPrice = Math.max(...prod.variants.map((v) => v.defaultPriceIQD || 0));
        const priceStr =
          minPrice === maxPrice
            ? `${minPrice.toLocaleString('en-IQ')} د.ع`
            : `${minPrice.toLocaleString('en-IQ')} - ${maxPrice.toLocaleString('en-IQ')} د.ع`;
        const code = prod.variants[0]?.barcode || prod.variants[0]?.sku || '';

        const stockBadge =
          totalStock <= 0 ? '❌ نفد' : totalStock <= 3 ? `⚠️ ${totalStock} قطع` : `✅ ${totalStock} قطعة`;

        listMsg += `<b>${idx + 1}. 🛍️ ${escapeHtml(prod.productName)}</b>\n`;
        listMsg += `   💰 السعر: <b>${priceStr}</b> | المخزون: ${stockBadge}\n`;
        if (code) {
          listMsg += `   🏷️ الباركود / الكود: <code>${escapeHtml(code)}</code>\n`;
        }
        listMsg += `\n`;
      });

      listMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      listMsg += `💡 <i>لعرض تفاصيل التكلفة والأرباح والمقاسات بالكامل لأي صنف، أرسل اسمه أو الباركود الخاص به مباشرة.</i>`;
      return listMsg;
    }

    // Exactly ONE product matched -> Render Full Financial & Stock Card!
    const prod = uniqueProducts[0];
    const firstVar = prod.variants[0];
    const totalStock = prod.variants.reduce((acc, v) => acc + (v.stockOnHand || 0), 0);

    const basePrice = firstVar.defaultPriceIQD || 0;
    const costUSD =
      firstVar.avgCostUSD > 0
        ? firstVar.avgCostUSD
        : firstVar.purchaseCostUSD > 0
        ? firstVar.purchaseCostUSD
        : firstVar.lastPurchaseCostUSD || 0;
    const costIQD = Math.round(costUSD * exchangeRate);
    const profitIQD = basePrice - costIQD;
    const profitMarginPct = basePrice > 0 ? Math.round((profitIQD / basePrice) * 100) : 0;

    const stockStatus =
      totalStock <= 0
        ? '❌ نفد من المخزن (0 قطعة)'
        : totalStock <= 3
        ? `⚠️ كمية قليلة حرجة (${totalStock} قطعة متبقية)`
        : `✅ متوفر بالمخزن (${totalStock} قطعة)`;

    let card = `🛍️ <b>${escapeHtml(prod.productName)}</b>`;
    if (prod.category) card += ` • <i>${escapeHtml(prod.category)}</i>`;
    card += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    card += `💰 <b>سعر البيع:</b> <b>${basePrice.toLocaleString('en-IQ')} د.ع</b>\n`;
    card += `📉 <b>سعر التكلفة:</b> <code>${costIQD.toLocaleString('en-IQ')} د.ع</code> ($${costUSD.toFixed(2)})\n`;
    card += `📈 <b>صافي الربح:</b> <b>+${profitIQD.toLocaleString('en-IQ')} د.ع</b> (${profitMarginPct}%)\n`;
    card += `📦 <b>المخزون الإجمالي:</b> ${stockStatus}\n`;

    // Sizes & Colors Breakdown
    if (prod.variants.length > 1 || prod.variants[0]?.size || prod.variants[0]?.color) {
      card += `━━━━━━━━━━━━━━━━━━━━\n`;
      card += `🎨 <b>المقاسات والألوان المتوفرة:</b>\n`;
      prod.variants.forEach((v) => {
        const desc = [v.size, v.color].filter(Boolean).join(' / ') || 'افتراضي';
        const vStock =
          v.stockOnHand <= 0 ? '❌ 0' : v.stockOnHand <= 2 ? `⚠️ ${v.stockOnHand}` : `✅ ${v.stockOnHand}`;
        card += `  ▫️ <b>${escapeHtml(desc)}:</b> ${vStock} قطعة (كود: <code>${escapeHtml(v.sku)}</code>)\n`;
      });
    }

    card += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (firstVar.barcode) {
      card += `🏷️ <b>الباركود:</b> <code>${escapeHtml(firstVar.barcode)}</code>\n`;
    }
    card += `🔖 <b>رمز SKU:</b> <code>${escapeHtml(firstVar.sku)}</code>`;

    return card;
  } catch (err: any) {
    log.error('[telegram] Error looking up product for Telegram:', err);
    return `❌ حدث خطأ أثناء فحص المنتج: ${err?.message || String(err)}`;
  }
}

// ─── 2FA OTP Unlock System for Telegram & Email Settings ───────────────────────

let activeUnlockOtp: { code: string; expiresAt: number } | null = null;
let unlockSessionExpiresAt = 0;

export async function requestTelegramUnlockOtp(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled || !settings.botToken || !settings.chatId) {
      // If Telegram is not yet configured, allow editing directly to perform initial setup
      unlockSessionExpiresAt = Date.now() + 15 * 60 * 1000;
      return { success: true };
    }

    // Generate secure 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    activeUnlockOtp = {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // Valid for 5 minutes
    };

    const now = new Date().toLocaleTimeString('ar-IQ', { hour12: true });

    const msg =
      `🔐 <b>رمز الأمان لفك قفل الإعدادات</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `طلب شخص ما فك قفل وتعديل إعدادات التيليجرام والبريد في نظام EVA POS.\n\n` +
      `🔢 <b>رمز التحقق السري:</b> <code>${code}</code>\n` +
      `⏱️ <b>الصلاحية:</b> 5 دقائق\n` +
      `🕒 <b>الوقت:</b> ${now}\n\n` +
      `⚠️ <i>إذا لم تكن أنت من طلب هذا الرمز، فلا تشاركه مع أي شخص لمنع التلاعب بالإشعارات!</i>`;

    const sendResult = await sendTelegramMessage(msg, 'HTML');
    if (!sendResult.success) {
      return { success: false, error: sendResult.error || 'فشل إرسال رمز التحقق إلى تيليجرام' };
    }
    return { success: true };
  } catch (err) {
    log.error('[telegram] Error requesting unlock OTP:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyTelegramUnlockOtp(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!activeUnlockOtp) {
      return { success: false, error: 'لم يتم طلب رمز تحقق أو انتهت صلاحيته' };
    }

    if (Date.now() > activeUnlockOtp.expiresAt) {
      activeUnlockOtp = null;
      return { success: false, error: 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد' };
    }

    if (activeUnlockOtp.code.trim() !== String(code).trim()) {
      // Alert owner of unauthorized attempt with wrong code
      const now = new Date().toLocaleTimeString('ar-IQ', { hour12: true });
      sendTelegramMessage(
        `🚨 <b>تحذير أمان: محاولة فك قفل برمز خاطئ!</b>\n━━━━━━━━━━━━━━━━━━━━\nتمت محاولة إدخال رمز خاطئ (<code>${escapeHtml(code)}</code>) لفك قفل الإعدادات من جهاز الكاشير!\n🕒 <b>الوقت:</b> ${now}`,
        'HTML',
      ).catch(() => {});

      return { success: false, error: 'رمز التحقق غير صحيح' };
    }

    // Verified successfully! Unlock session for 15 minutes
    activeUnlockOtp = null;
    unlockSessionExpiresAt = Date.now() + 15 * 60 * 1000;

    sendTelegramMessage(
      `✅ <b>تم فك قفل الإعدادات بنجاح</b>\n━━━━━━━━━━━━━━━━━━━━\nتم تأكيد رمز الأمان وفك قفل إعدادات التيليجرام والبريد من جهاز الكاشير. الجلسة صالحة لمدة 15 دقيقة.`,
      'HTML',
    ).catch(() => {});

    return { success: true };
  } catch (err) {
    log.error('[telegram] Error verifying unlock OTP:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isTelegramSettingsUnlocked(): boolean {
  return Date.now() < unlockSessionExpiresAt;
}

export function lockTelegramSettings(): void {
  unlockSessionExpiresAt = 0;
  activeUnlockOtp = null;
}
