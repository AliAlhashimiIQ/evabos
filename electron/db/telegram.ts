import fs from 'fs/promises';
import path from 'path';
import log from 'electron-log';
import { getSetting, setSetting, getAdvancedReports, listSaleItems } from './database';
import { get, all } from './core';
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
export async function sendTelegramDailyReportAndBackup(customDateStr?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Telegram Bot is disabled in settings.' };
    }

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
    const reports = await getAdvancedReports(range);
    const itemsSold = await listSaleItems(todayStr);

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
    if (lastSentDate && lastSentDate !== todayLocalStr && lastSentDate !== yesterdayStr) {
      const yesterdaySales = await getAdvancedReports({ startDate: yesterdayStr, endDate: yesterdayStr });
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

        const url = `https://api.telegram.org/bot${currentSettings.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=20&allowed_updates=["message"]`;
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
          }>;
        };

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);

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
 * Handle incoming Telegram command from owner
 */
async function handleTelegramBotCommand(commandText: string, chatId: string, botToken: string): Promise<void> {
  const cleanCmd = commandText.toLowerCase().split('@')[0].trim();
  const override = { botToken, chatId };

  log.info(`[telegram-bot] Received command: "${commandText}" from chat ${chatId}`);

  try {
    // ─── 1. /report or /today ────────────────────────────────────────────────
    if (cleanCmd === '/report' || cleanCmd === '/today' || cleanCmd === '/sales' || cleanCmd === 'تقرير' || cleanCmd === 'تقرير اليوم' || cleanCmd === 'المبيعات' || cleanCmd === 'اليوم') {
      await sendTelegramMessage('⏳ <i>جاري إعداد تقرير مبيعات اليوم المباشر...</i>', 'HTML', override);
      await sendTelegramDailyReportAndBackup();
      return;
    }

    // ─── 2. /yesterday ──────────────────────────────────────────────────────
    if (cleanCmd === '/yesterday' || cleanCmd === 'تقرير الامس' || cleanCmd === 'امس' || cleanCmd === 'البارحة') {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      await sendTelegramMessage(`⏳ <i>جاري جلب تقرير يوم أمس (${yesterdayStr})...</i>`, 'HTML', override);
      await sendTelegramDailyReportAndBackup(yesterdayStr);
      return;
    }

    // ─── 3. /month ──────────────────────────────────────────────────────────
    if (cleanCmd === '/month' || cleanCmd === '/monthly' || cleanCmd === 'الشهر' || cleanCmd === 'مبيعات الشهر' || cleanCmd === 'تقرير الشهر') {
      await sendTelegramMessage('⏳ <i>جاري حساب إحصائيات الشهر الحالي...</i>', 'HTML', override);
      const now = new Date();
      const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const reports = await getAdvancedReports({ startDate: firstDayOfMonth, endDate: todayStr });
      const revenue = reports?.profitAnalysis?.revenueIQD || 0;
      const profit = reports?.profitAnalysis?.netProfitIQD || 0;
      const margin = reports?.profitAnalysis?.profitMarginPercent || 0;
      const orders = reports?.dailySales?.reduce((acc, d) => acc + (d.orders || 0), 0) || 0;
      const itemsSold = reports?.dailySales?.reduce((acc, d) => acc + (d.itemsSold || 0), 0) || 0;

      // Month Expenses
      const monthExpenses = await get<{ totalExp: number; count: number }>(
        `SELECT IFNULL(SUM(amountIQD), 0) as totalExp, COUNT(*) as count FROM expenses WHERE date(createdAt) BETWEEN date(?) AND date(?)`,
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

      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 4. /week ───────────────────────────────────────────────────────────
    if (cleanCmd === '/week' || cleanCmd === '/weekly' || cleanCmd === 'الاسبوع' || cleanCmd === 'مبيعات الاسبوع') {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startDate = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const reports = await getAdvancedReports({ startDate, endDate });
      const revenue = reports?.profitAnalysis?.revenueIQD || 0;
      const profit = reports?.profitAnalysis?.netProfitIQD || 0;
      const orders = reports?.dailySales?.reduce((acc, d) => acc + (d.orders || 0), 0) || 0;
      const itemsSold = reports?.dailySales?.reduce((acc, d) => acc + (d.itemsSold || 0), 0) || 0;

      let msg = `📅 <b>تقرير آخر 7 أيام (${startDate} ⬅️ ${endDate})</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 <b>إجمالي المبيعات:</b> <b>${revenue.toLocaleString('en-IQ')} د.ع</b>\n`;
      msg += `💵 <b>صافي الأرباح:</b> ${profit.toLocaleString('en-IQ')} د.ع\n`;
      msg += `📦 <b>القطع المباعة:</b> ${itemsSold.toLocaleString('en-IQ')} قطعة\n`;
      msg += `🧾 <b>عدد الفواتير:</b> ${orders} فاتورة\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 5. /stock or /lowstock ─────────────────────────────────────────────
    if (cleanCmd === '/stock' || cleanCmd === '/lowstock' || cleanCmd === 'المخزون' || cleanCmd === 'النواقص' || cleanCmd === 'نواقص') {
      const lowStockItems = await all<{
        productName: string;
        sku: string | null;
        color: string | null;
        size: string | null;
        stockOnHand: number;
        salePriceIQD: number;
      }>(
        `
        SELECT p.name as productName, pv.sku, pv.color, pv.size, pv.stockOnHand, pv.salePriceIQD
        FROM product_variants pv
        JOIN products p ON p.id = pv.productId
        WHERE pv.stockOnHand <= 3
        ORDER BY pv.stockOnHand ASC, p.name ASC
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

    // ─── 6. /top or /bestsellers ───────────────────────────────────────────
    if (cleanCmd === '/top' || cleanCmd === '/bestsellers' || cleanCmd === 'الاعلى مبيعا' || cleanCmd === 'الاكثر مبيعا' || cleanCmd === 'توب') {
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
        WHERE date(s.saleDate) >= date('now', 'start of month')
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

    // ─── 7. /expenses ───────────────────────────────────────────────────────
    if (cleanCmd === '/expenses' || cleanCmd === '/exp' || cleanCmd === 'المصروفات' || cleanCmd === 'المصاريف' || cleanCmd === 'مصاريف اليوم') {
      const todayExpenses = await all<{
        category: string;
        amountIQD: number;
        notes: string | null;
        createdAt: string;
      }>(
        `
        SELECT category, amountIQD, notes, createdAt
        FROM expenses
        WHERE date(createdAt) = date('now', 'localtime')
        ORDER BY createdAt DESC
      `,
      );

      const totalExp = todayExpenses.reduce((acc, row) => acc + row.amountIQD, 0);

      let msg = `📉 <b>مصروفات اليوم:</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (todayExpenses.length === 0) {
        msg += `✅ لم يتم تسجيل أي مصروفات اليوم.\n`;
      } else {
        todayExpenses.forEach((exp, idx) => {
          msg += `${idx + 1}. <b>${escapeHtml(exp.category || 'عام')}:</b> ${exp.amountIQD.toLocaleString('en-IQ')} د.ع`;
          if (exp.notes) {
            msg += ` — <i>(${escapeHtml(exp.notes)})</i>`;
          }
          msg += `\n`;
        });
      }

      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 <b>إجمالي مصروفات اليوم:</b> <b>${totalExp.toLocaleString('en-IQ')} د.ع</b>`;

      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 8. /cash or /drawer ────────────────────────────────────────────────
    if (cleanCmd === '/cash' || cleanCmd === '/drawer' || cleanCmd === 'الكاش' || cleanCmd === 'الصندوق' || cleanCmd === 'الدرج') {
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

      const refundSummary = await get<{ totalRefund: number }>(
        `SELECT IFNULL(SUM(refundAmountIQD), 0) as totalRefund FROM returns WHERE date(createdAt) = date('now', 'localtime')`,
      );

      const expenseSummary = await get<{ totalExp: number }>(
        `SELECT IFNULL(SUM(amountIQD), 0) as totalExp FROM expenses WHERE date(createdAt) = date('now', 'localtime')`,
      );

      const cashSales = paymentSummary?.cashSales || 0;
      const cardSales = paymentSummary?.cardSales || 0;
      const mixedSales = paymentSummary?.mixedSales || 0;
      const totalRefund = refundSummary?.totalRefund || 0;
      const totalExp = expenseSummary?.totalExp || 0;
      const netCashInDrawer = cashSales - totalRefund - totalExp;

      let msg = `💵 <b>تقرير الصندوق والمقبوضات (اليوم):</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🟢 <b>مبيعات نقدي (كاش):</b> ${cashSales.toLocaleString('en-IQ')} د.ع\n`;
      msg += `💳 <b>مبيعات بطاقة (كي كارد):</b> ${cardSales.toLocaleString('en-IQ')} د.ع\n`;
      if (mixedSales > 0) {
        msg += `🔀 <b>مبيعات دفع مختلط:</b> ${mixedSales.toLocaleString('en-IQ')} د.ع\n`;
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

    // ─── 9. /employees ──────────────────────────────────────────────────────
    if (cleanCmd === '/employees' || cleanCmd === '/staff' || cleanCmd === 'الموظفين' || cleanCmd === 'الكادر' || cleanCmd === 'الموظف') {
      const empSales = await all<{
        employeeName: string | null;
        ordersCount: number;
        totalSold: number;
      }>(
        `
        SELECT 
          IFNULL(e.name, 'كاشير عام / افتراضي') as employeeName,
          COUNT(s.id) as ordersCount,
          IFNULL(SUM(s.totalIQD), 0) as totalSold
        FROM sales s
        LEFT JOIN employees e ON e.id = s.employeeId
        WHERE date(s.saleDate) = date('now', 'localtime')
        GROUP BY s.employeeId
        ORDER BY totalSold DESC
      `,
      );

      let msg = `👥 <b>مبيعات الموظفين والكادر (اليوم):</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (!empSales || empSales.length === 0) {
        msg += `لا توجد مبيعات مسجلة للموظفين اليوم.\n`;
      } else {
        const medals = ['🥇', '🥈', '🥉', '👤'];
        empSales.forEach((emp, idx) => {
          const medal = medals[idx] || '👤';
          msg += `${medal} <b>${escapeHtml(emp.employeeName || 'كاشير')}:</b>\n`;
          msg += `   └ <b>${emp.totalSold.toLocaleString('en-IQ')} د.ع</b> (${emp.ordersCount} فاتورة)\n`;
        });
      }

      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      await sendTelegramMessage(msg, 'HTML', override);
      return;
    }

    // ─── 10. /backup ────────────────────────────────────────────────────────
    if (cleanCmd === '/backup' || cleanCmd === 'باك اب' || cleanCmd === 'نسخة احتياطية') {
      await sendTelegramMessage('⏳ <i>جاري إنشاء نسخة احتياطية لقاعدة البيانات ورفعها...</i>', 'HTML', override);
      const backupInfo = await createBackup();
      const now = new Date().toLocaleString('ar-IQ');
      const caption = `📦 <b>نسخة احتياطية لقاعدة البيانات (مباشرة)</b>\n🏷️ الملف: <code>${backupInfo.filename}</code>\n📅 التاريخ: ${now}\n📊 الحجم: ${(backupInfo.size / (1024 * 1024)).toFixed(2)} MB`;
      await sendTelegramDocument(backupInfo.filepath, caption, override);
      return;
    }

    // ─── 11. /status ────────────────────────────────────────────────────────
    if (cleanCmd === '/status' || cleanCmd === 'الحالة' || cleanCmd === 'فحص') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const reports = await getAdvancedReports({ startDate: todayStr, endDate: todayStr });
      const totalRevenue = reports?.profitAnalysis?.revenueIQD || 0;
      const netProfit = reports?.profitAnalysis?.netProfitIQD || 0;
      const totalOrders = reports?.dailySales?.reduce((acc, d) => acc + (d.orders || 0), 0) || 0;

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

    // ─── 12. /start or /help ────────────────────────────────────────────────
    if (cleanCmd === '/start' || cleanCmd === '/help' || cleanCmd === 'مساعدة' || cleanCmd === 'الاوامر' || cleanCmd === 'أوامر') {
      let helpMsg = `🤖 <b>أوامر بوت كاشير EVA POS الذكي:</b>\n`;
      helpMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      helpMsg += `📊 <b>التقارير والمبيعات:</b>\n`;
      helpMsg += `  /report — تقرير مبيعات وأرباح اليوم\n`;
      helpMsg += `  /yesterday — تقرير مبيعات يوم أمس\n`;
      helpMsg += `  /week — تقرير آخر 7 أيام\n`;
      helpMsg += `  /month — تقرير مبيعات الشهر الحالي\n`;
      helpMsg += `\n`;
      helpMsg += `📦 <b>المخزون والمنتجات:</b>\n`;
      helpMsg += `  /stock — تنبيه بالنواقص والمنتجات المنتهية\n`;
      helpMsg += `  /top — أعلى 10 منتجات مبيعاً هذا الشهر\n`;
      helpMsg += `\n`;
      helpMsg += `💰 <b>المالية والموظفين:</b>\n`;
      helpMsg += `  /cash — فحص الصندوق وحساب الكاش بالدرج\n`;
      helpMsg += `  /expenses — تقرير بمصروفات اليوم\n`;
      helpMsg += `  /employees — مبيعات الكادر والموظفين اليوم\n`;
      helpMsg += `\n`;
      helpMsg += `⚙️ <b>النظام والأمان:</b>\n`;
      helpMsg += `  /status — فحص اتصال النظام وحالته\n`;
      helpMsg += `  /backup — طلب نسخة احتياطية فورية (.db)\n`;
      helpMsg += `  /help — عرض قائمة الأوامر هذه\n`;
      helpMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      helpMsg += `<i>يمكنك إرسال الكلمات بالعربي أو الإنجليزي (مثل: تقرير، المخزون، الكاش، باك اب).</i>`;

      await sendTelegramMessage(helpMsg, 'HTML', override);
      return;
    }

    // Default response for unhandled text
    await sendTelegramMessage(`❓ أمر غير معروف. أرسل <b>/help</b> لعرض قائمة الأوامر المتاحة.`, 'HTML', override);
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

// ─── Instant Activity Log Alert (Tamper / Sensitive Action Alert) ─────────────

export async function notifyTelegramActivity(
  userId: number,
  action: string,
  entity?: string | null,
  entityId?: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled || !settings.botToken || !settings.chatId) {
      return;
    }

    // Filter for sensitive actions that owner needs immediate alerts for
    const sensitiveActions = [
      'delete',
      'update',
      'bulk_update',
      'reset',
      'password_change',
      'return',
      'deactivate',
      'inventory_adjust',
      'reject',
    ];
    if (!sensitiveActions.includes(action.toLowerCase())) {
      return;
    }

    // Lookup user name
    const userRow = await get<{ username: string; name?: string; role?: string }>(
      `SELECT username, name, role FROM users WHERE id = ?`,
      [userId],
    );
    const userName = userRow?.name || userRow?.username || `مستخدم #${userId}`;
    const userRole = userRow?.role ? `(${userRow.role})` : '';

    const actionIcons: Record<string, string> = {
      delete: '🗑️ <b>عملية حذف (Delete)</b>',
      update: '✏️ <b>تعديل بيانات / سعر (Edit)</b>',
      bulk_update: '📦 <b>تعديل جماعي (Bulk Edit)</b>',
      reset: '🔥 <b>إعادة ضبط النظام (System Reset)</b>',
      password_change: '🔑 <b>تغيير كلمة المرور</b>',
      return: '🔄 <b>إرجاع / استرداد (Return)</b>',
      deactivate: '⛔ <b>تعطيل حساب</b>',
      inventory_adjust: '📊 <b>تعديل كمية المخزون (Stock Adjust)</b>',
      reject: '❌ <b>إلغاء / رفض طلب</b>',
    };

    const actionLabel = actionIcons[action.toLowerCase()] || `⚡ <b>${escapeHtml(action)}</b>`;

    let entityDisplay = entity ? `${entity} #${entityId ?? ''}` : 'عنصر';
    let lookupDetails = '';

    // Smart lookup based on entity
    if (entity?.toLowerCase() === 'variant' && entityId) {
      const v = await get<{ productName: string; size?: string; color?: string; defaultPriceIQD?: number }>(
        `SELECT p.name as productName, v.size, v.color, v.defaultPriceIQD
         FROM product_variants v
         JOIN products p ON p.id = v.productId
         WHERE v.id = ?`,
        [entityId],
      );
      if (v) {
        const variantDesc = [v.size, v.color].filter(Boolean).join(' - ');
        entityDisplay = `👗 <b>${escapeHtml(v.productName)}</b> ${variantDesc ? `(${escapeHtml(variantDesc)})` : ''}`;
        if (v.defaultPriceIQD) {
          lookupDetails += `• السعر الحالي: <code>${v.defaultPriceIQD.toLocaleString()} د.ع</code>\n`;
        }
      } else {
        entityDisplay = `صنف / مقاس #${entityId}`;
      }
    } else if (entity?.toLowerCase() === 'product' && entityId) {
      const p = await get<{ name: string }>(`SELECT name FROM products WHERE id = ?`, [entityId]);
      if (p) {
        entityDisplay = `👗 <b>${escapeHtml(p.name)}</b> (#${entityId})`;
      } else {
        entityDisplay = `منتج #${entityId}`;
      }
    } else if (entity?.toLowerCase() === 'sale' && entityId) {
      const s = await get<{ totalIQD: number; paymentMethod?: string }>(
        `SELECT totalIQD, paymentMethod FROM sales WHERE id = ?`,
        [entityId],
      );
      if (s) {
        entityDisplay = `🧾 <b>فاتورة بيع #${entityId}</b>`;
        lookupDetails += `• إجمالي الفاتورة: <code>${s.totalIQD.toLocaleString()} د.ع</code>\n`;
      } else {
        entityDisplay = `فاتورة بيع #${entityId}`;
      }
    } else if (entity?.toLowerCase() === 'employee' && entityId) {
      const e = await get<{ name: string }>(`SELECT name FROM employees WHERE id = ?`, [entityId]);
      entityDisplay = e ? `👤 موظف: <b>${escapeHtml(e.name)}</b>` : `موظف #${entityId}`;
    } else if (entity?.toLowerCase() === 'user' && entityId) {
      const u = await get<{ name?: string; username: string }>(`SELECT name, username FROM users WHERE id = ?`, [entityId]);
      entityDisplay = u ? `👤 مستخدم: <b>${escapeHtml(u.name || u.username)}</b>` : `مستخدم #${entityId}`;
    }

    const now = new Date().toLocaleString('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    let text = `🚨 <b>تنبيه نشاط حساس في النظام:</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⚡ <b>العملية:</b> ${actionLabel}\n`;
    text += `👤 <b>المستخدم:</b> <b>${escapeHtml(userName)}</b> ${userRole}\n`;
    text += `🏷️ <b>العنصر:</b> ${entityDisplay}\n`;

    if (lookupDetails) {
      text += lookupDetails;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      const metaDetails = Object.entries(metadata)
        .map(([k, v]) => `• ${k}: <code>${escapeHtml(String(v))}</code>`)
        .join('\n');
      text += `📝 <b>التفاصيل:</b>\n${metaDetails}\n`;
    }

    text += `🕒 <b>الوقت:</b> ${now}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🛡️ <i>سجلات الأمان والتدقيق - EVA POS</i>`;

    await sendTelegramMessage(text, 'HTML');
  } catch (err) {
    log.error('[telegram] Failed to send activity alert:', err);
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
