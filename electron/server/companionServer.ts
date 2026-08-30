import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { BrowserWindow, app } from 'electron';
import log from 'electron-log';
import QRCode from 'qrcode';
import selfsigned from 'selfsigned';
import { get } from '../db/core';

interface ProductLookupResult {
  found: boolean;
  product?: {
    variantId: number;
    productId: number;
    name: string;
    category?: string | null;
    color?: string | null;
    size?: string | null;
    sku: string;
    barcode?: string | null;
    priceIQD: number;
    priceUSD: number;
    costIQD: number;
    costUSD: number;
    profitIQD: number;
    profitMarginPct: number;
    currentMultiplier: number;
    stockOnHand: number;
  };
  multiplierTiers?: Array<{
    multiplier: number;
    label: string;
    priceIQD: number;
    profitIQD: number;
    profitMarginPct: number;
    discountPct: number;
  }>;
  multiBuyTiers?: Array<{
    qty: number;
    title: string;
    totalIQD: number;
    unitPriceIQD: number;
    discountPercent: number;
    savingsIQD: number;
  }>;
  commonPromos?: Array<{
    title: string;
    percent: number;
    price1xIQD: number;
    price2xIQD: number;
    price3xIQD: number;
    savings3xIQD: number;
  }>;
}

let httpsServer: https.Server | null = null;
let httpServer: http.Server | null = null;
let currentPort = 8989; // HTTPS Port
let httpRedirectPort = 8988; // HTTP Port
let mainWindowRef: BrowserWindow | null = null;
let cachedHtml5QrcodeJs: string | null = null;

/**
 * Find the local LAN IP address of this machine
 */
export function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Get or read the html5-qrcode.min.js script from node_modules
 */
function getHtml5QrcodeScript(): string {
  if (cachedHtml5QrcodeJs) {
    return cachedHtml5QrcodeJs;
  }
  const searchPaths = [
    path.join(__dirname, '../../node_modules/html5-qrcode/html5-qrcode.min.js'),
    path.join(__dirname, '../node_modules/html5-qrcode/html5-qrcode.min.js'),
    path.join(process.cwd(), 'node_modules/html5-qrcode/html5-qrcode.min.js'),
  ];

  if (app && app.getAppPath) {
    searchPaths.unshift(path.join(app.getAppPath(), 'node_modules/html5-qrcode/html5-qrcode.min.js'));
  }

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        cachedHtml5QrcodeJs = fs.readFileSync(p, 'utf8');
        return cachedHtml5QrcodeJs;
      }
    } catch {}
  }
  return '/* html5-qrcode fallback */';
}

/**
 * Get companion connection info (URL & QR Code)
 */
export async function getCompanionServerInfo(): Promise<{
  url: string;
  qrDataUrl: string;
  ip: string;
  port: number;
  active: boolean;
}> {
  const ip = getLocalIpAddress();
  const url = `https://${ip}:${currentPort}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0b0f19',
        light: '#ffffff',
      },
    });
  } catch (err) {
    log.error('[companion-server] Failed to generate QR code:', err);
  }

  return {
    url,
    qrDataUrl,
    ip,
    port: currentPort,
    active: httpsServer !== null && httpsServer.listening,
  };
}

/**
 * Lookup product info and calculate cost, multipliers, profits, and promotions
 */
export async function lookupProductDetails(queryStr: string): Promise<ProductLookupResult> {
  const q = (queryStr || '').trim();
  if (!q) {
    return { found: false };
  }

  try {
    const rateSetting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['exchangeRate']);
    const exchangeRate = rateSetting ? parseFloat(rateSetting.value) || 1520 : 1520;

    const row = await get<{
      variantId: number;
      productId: number;
      productName: string;
      category?: string | null;
      color?: string | null;
      size?: string | null;
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
        pv.id AS variantId,
        pv.productId,
        p.name AS productName,
        p.category,
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
      WHERE (pv.barcode = ? OR pv.sku = ? OR LOWER(pv.barcode) = LOWER(?) OR LOWER(pv.sku) = LOWER(?))
        AND pv.isActive = 1 AND p.isActive = 1
      GROUP BY pv.id
      LIMIT 1
    `,
      [q, q, q, q],
    );

    if (!row) {
      return { found: false };
    }

    const basePrice = row.defaultPriceIQD || 0;
    const priceUSD = exchangeRate > 0 ? parseFloat((basePrice / exchangeRate).toFixed(2)) : 0;

    // Wholesale / Purchase Cost calculations
    const costUSD = row.avgCostUSD || row.purchaseCostUSD || row.lastPurchaseCostUSD || 0;
    const costIQD = costUSD > 0 ? Math.round(costUSD * exchangeRate) : Math.round(basePrice / 3);
    const profitIQD = basePrice - costIQD;
    const profitMarginPct = basePrice > 0 ? Math.round((profitIQD / basePrice) * 1000) / 10 : 0;
    const currentMultiplier = costIQD > 0 ? Math.round((basePrice / costIQD) * 100) / 100 : 3.0;

    // Cost Multiplier Tiers (1x, 1.5x, 1.8x, 2x, 2.5x, 3x)
    const multiplierTiers = [
      {
        multiplier: 1.0,
        label: '1.0x (رأس المال)',
        priceIQD: costIQD,
        profitIQD: 0,
        profitMarginPct: 0,
        discountPct: basePrice > 0 ? Math.round(((basePrice - costIQD) / basePrice) * 1000) / 10 : 0,
      },
      {
        multiplier: 1.5,
        label: '1.5x',
        priceIQD: Math.round(costIQD * 1.5),
        profitIQD: Math.round(costIQD * 0.5),
        profitMarginPct: 33.3,
        discountPct: basePrice > 0 ? Math.round(((basePrice - Math.round(costIQD * 1.5)) / basePrice) * 1000) / 10 : 0,
      },
      {
        multiplier: 1.8,
        label: '1.8x',
        priceIQD: Math.round(costIQD * 1.8),
        profitIQD: Math.round(costIQD * 0.8),
        profitMarginPct: 44.4,
        discountPct: basePrice > 0 ? Math.round(((basePrice - Math.round(costIQD * 1.8)) / basePrice) * 1000) / 10 : 0,
      },
      {
        multiplier: 2.0,
        label: '2.0x (المطلوب)',
        priceIQD: Math.round(costIQD * 2.0),
        profitIQD: costIQD,
        profitMarginPct: 50.0,
        discountPct: basePrice > 0 ? Math.round(((basePrice - Math.round(costIQD * 2.0)) / basePrice) * 1000) / 10 : 0,
      },
      {
        multiplier: 2.5,
        label: '2.5x',
        priceIQD: Math.round(costIQD * 2.5),
        profitIQD: Math.round(costIQD * 1.5),
        profitMarginPct: 60.0,
        discountPct: basePrice > 0 ? Math.round(((basePrice - Math.round(costIQD * 2.5)) / basePrice) * 1000) / 10 : 0,
      },
      {
        multiplier: 3.0,
        label: '3.0x (الأساسي)',
        priceIQD: basePrice,
        profitIQD,
        profitMarginPct,
        discountPct: 0,
      },
    ];

    // Multi-buy standard quantities (1x, 2x, 3x)
    const multiBuyTiers = [
      {
        qty: 1,
        title: '1x (قطعة واحدة)',
        totalIQD: basePrice,
        unitPriceIQD: basePrice,
        discountPercent: 0,
        savingsIQD: 0,
      },
      {
        qty: 2,
        title: '2x (قطعتين)',
        totalIQD: basePrice * 2,
        unitPriceIQD: basePrice,
        discountPercent: 0,
        savingsIQD: 0,
      },
      {
        qty: 3,
        title: '3x (3 قطع)',
        totalIQD: basePrice * 3,
        unitPriceIQD: basePrice,
        discountPercent: 0,
        savingsIQD: 0,
      },
    ];

    // Popular Store Promos breakdown for quick answering
    const promoPercents = [10, 15, 20, 25, 30, 50];
    const commonPromos = promoPercents.map((pct) => {
      const p1 = Math.round(basePrice * (1 - pct / 100));
      const p2 = Math.round(basePrice * 2 * (1 - pct / 100));
      const p3 = Math.round(basePrice * 3 * (1 - pct / 100));
      const savings3 = (basePrice * 3) - p3;
      return {
        title: `خصم ${pct}%`,
        percent: pct,
        price1xIQD: p1,
        price2xIQD: p2,
        price3xIQD: p3,
        savings3xIQD: savings3,
      };
    });

    return {
      found: true,
      product: {
        variantId: row.variantId,
        productId: row.productId,
        name: row.productName,
        category: row.category,
        color: row.color,
        size: row.size,
        sku: row.sku,
        barcode: row.barcode,
        priceIQD: basePrice,
        priceUSD,
        costIQD,
        costUSD,
        profitIQD,
        profitMarginPct,
        currentMultiplier,
        stockOnHand: row.stockOnHand,
      },
      multiplierTiers,
      multiBuyTiers,
      commonPromos,
    };
  } catch (err) {
    log.error('[companion-server] Error in lookupProductDetails:', err);
    return { found: false };
  }
}

/**
 * Mobile Companion Web App — light-mode, matches the desktop EVA POS design system
 */
function getCompanionHtml(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="theme-color" content="#f1f5f9">
  <title>EVA POS — الماسح الميداني</title>
  <script src="/vendor/html5-qrcode.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #f1f5f9;
      --bg-card:     #fafbfc;
      --bg-input:    #fafbfc;
      --text:        #1e293b;
      --text-muted:  rgba(30, 41, 59, 0.55);
      --border:      rgba(30, 41, 59, 0.14);
      --accent:      #3b82f6;
      --accent-dim:  rgba(59, 130, 246, 0.12);
      --accent-ring: rgba(59, 130, 246, 0.25);
      --success:     #10b981;
      --success-dim: rgba(16, 185, 129, 0.1);
      --warning:     #f59e0b;
      --warning-dim: rgba(245, 158, 11, 0.1);
      --danger:      #ef4444;
      --danger-dim:  rgba(239, 68, 68, 0.1);
      --radius-sm:   0.5rem;
      --radius:      0.75rem;
      --radius-lg:   1rem;
      --radius-xl:   1.25rem;
      --shadow-sm:   0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05);
      --shadow:      0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Cairo', 'Tajawal', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: env(safe-area-inset-top, 0) 0 env(safe-area-inset-bottom, 0) 0;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Header ─────────────────────────────────────────────── */
    .app-header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .app-logo {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.3px;
    }
    .app-logo b { color: var(--accent); font-weight: 900; }

    .conn-dot {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--success);
    }
    .conn-dot::before {
      content: '';
      width: 7px; height: 7px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    /* ── Content wrapper ────────────────────────────────────── */
    .content { padding: 14px 14px 24px; flex: 1; display: flex; flex-direction: column; gap: 12px; }

    /* ── Mode Tabs ──────────────────────────────────────────── */
    .mode-bar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 3px;
      box-shadow: var(--shadow-sm);
    }
    .mode-btn {
      border: none;
      background: transparent;
      color: var(--text-muted);
      padding: 8px 10px;
      border-radius: calc(var(--radius) - 3px);
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .mode-btn.active {
      background: var(--accent);
      color: #fff;
      box-shadow: var(--shadow-sm);
    }
    .mode-btn:not(.active):active { background: rgba(30,41,59,0.06); }

    /* ── Toast ──────────────────────────────────────────────── */
    #toast {
      display: none;
      background: var(--success);
      color: #fff;
      padding: 10px 14px;
      border-radius: var(--radius);
      font-size: 0.84rem;
      font-weight: 700;
      text-align: center;
      box-shadow: var(--shadow);
      animation: slideIn 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    #toast.err { background: var(--danger); }
    @keyframes slideIn {
      from { transform: translateY(-6px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* ── Scanner Card ───────────────────────────────────────── */
    .scanner-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      box-shadow: var(--shadow);
    }
    .scanner-viewport {
      width: 100%;
      height: 260px;
      background: #0a0e17;
      position: relative;
      overflow: hidden;
    }
    /* Strip all html5-qrcode default chrome — we handle UI ourselves */
    #reader { width: 100%; height: 100%; }
    #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
    #reader img, #reader select, #reader button,
    #reader > div:not([id='reader__scan_region']),
    #reader__dashboard, #reader__header_message,
    #reader__status_span, #reader__filescan_input { display: none !important; }
    #reader__scan_region { width: 100% !important; height: 100% !important; position: absolute !important; inset: 0 !important; }

    /* Reticle overlay */
    .reticle {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Frame matches the actual qrbox decode area */
    .reticle-frame {
      width: 78%; height: 52%;
      border: 2px solid rgba(59,130,246,0.95);
      border-radius: 10px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.50);
      position: relative;
      overflow: hidden;
    }
    .reticle-beam {
      position: absolute;
      left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      animation: sweep 1.6s ease-in-out infinite alternate;
    }
    @keyframes sweep {
      from { top: 6%; }
      to   { top: 94%; }
    }

    .scanner-controls {
      display: flex;
      gap: 6px;
      padding: 10px;
      background: var(--bg-card);
      border-top: 1px solid var(--border);
    }
    .ctrl-btn {
      flex: 1;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 7px 6px;
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }
    .ctrl-btn:active { transform: scale(0.96); background: rgba(30,41,59,0.06); }
    .ctrl-btn.on { background: #fef3c7; border-color: #f59e0b; color: #92400e; }

    /* ── Manual search ──────────────────────────────────────── */
    .search-bar {
      display: flex;
      gap: 8px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 4px 4px 4px 12px;
      box-shadow: var(--shadow-sm);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-bar:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    .search-bar input {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 0.9rem;
      font-weight: 600;
      outline: none;
      padding: 7px 0;
    }
    .search-bar input::placeholder { color: var(--text-muted); font-weight: 400; }
    .search-bar button {
      background: var(--accent);
      border: none;
      color: #fff;
      padding: 7px 16px;
      border-radius: calc(var(--radius) - 3px);
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .search-bar button:active { transform: scale(0.97); background: #2563eb; }

    /* ── Card base ──────────────────────────────────────────── */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow);
      padding: 14px;
    }

    /* ── Product header ─────────────────────────────────────── */
    .prod-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .prod-name { font-size: 1.1rem; font-weight: 800; color: var(--text); line-height: 1.3; }
    .stock-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .stock-pill.ok  { background: var(--success-dim); color: #065f46; border: 1px solid rgba(16,185,129,0.25); }
    .stock-pill.low { background: var(--warning-dim); color: #92400e; border: 1px solid rgba(245,158,11,0.25); }
    .stock-pill.out { background: var(--danger-dim);  color: #991b1b; border: 1px solid rgba(239,68,68,0.25); }

    .meta-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .meta-tag {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.73rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: var(--radius-sm);
    }

    /* ── Dual price panel ───────────────────────────────────── */
    .price-panel {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }
    .price-box {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
    }
    .price-box-lbl { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); margin-bottom: 3px; }
    .price-box-num { font-size: 1.28rem; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1.1; }
    .price-box-sub { font-size: 0.72rem; font-weight: 600; margin-top: 2px; }

    /* ── Section label ──────────────────────────────────────── */
    .section-lbl {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-lbl span {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.7rem;
      padding: 2px 7px;
      border-radius: 999px;
    }

    /* ── Multiplier grid ────────────────────────────────────── */
    .mult-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 5px;
      margin-bottom: 14px;
    }
    .mult-cell {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 7px 2px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
    }
    .mult-cell:active { transform: scale(0.95); }
    .mult-cell.sel {
      background: var(--accent-dim);
      border-color: rgba(59,130,246,0.4);
      box-shadow: 0 0 0 2px var(--accent-ring);
    }
    .mc-x  { font-size: 0.74rem; font-weight: 800; color: var(--accent); margin-bottom: 1px; }
    .mc-p  { font-size: 0.76rem; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
    .mc-d  { font-size: 0.63rem; font-weight: 700; color: var(--success); }
    .mult-cell.sel .mc-x, .mult-cell.sel .mc-p, .mult-cell.sel .mc-d { color: var(--accent); }
    .mult-cell.sel .mc-p { color: var(--text); }

    /* ── Custom multiplier slider ───────────────────────────── */
    .slider-panel {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 11px 13px;
      margin-bottom: 10px;
    }
    .slider-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 9px;
    }
    .slider-val {
      background: var(--accent);
      color: #fff;
      font-size: 0.82rem;
      font-weight: 800;
      padding: 2px 10px;
      border-radius: 999px;
    }
    input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* ── Direct Custom Price Input ───────────────────────────── */
    .custom-price-panel {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      margin-bottom: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .custom-price-panel:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    .custom-price-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .custom-price-input-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-card);
      border: 1.5px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
    }
    .custom-price-input-box:focus-within {
      border-color: var(--accent);
    }
    .custom-price-input-box input {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 1.22rem;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      outline: none;
      width: 100%;
    }
    .custom-price-input-box input::placeholder {
      color: var(--text-muted);
      font-size: 0.85rem;
      font-weight: 500;
    }
    .custom-price-input-box span {
      font-size: 0.82rem;
      font-weight: 800;
      color: var(--accent);
      white-space: nowrap;
    }

    /* ── Results breakdown ──────────────────────────────────── */
    .result-panel {
      background: var(--accent-dim);
      border: 1px solid rgba(59,130,246,0.2);
      border-radius: var(--radius);
      padding: 12px;
      margin-bottom: 14px;
    }
    .res-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 0.84rem;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .res-row:last-child {
      margin-bottom: 0;
      padding-top: 8px;
      border-top: 1px solid rgba(59,130,246,0.15);
      margin-top: 2px;
    }
    .res-row b { color: var(--text); font-weight: 800; font-variant-numeric: tabular-nums; }
    .res-row .hl { color: var(--accent); font-weight: 800; }
    .res-row .profit { color: var(--success); font-weight: 800; }

    /* ── Quick promo chips ──────────────────────────────────── */
    .deals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }
    .deal-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 7px 4px;
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .deal-btn:active { transform: scale(0.96); background: var(--accent-dim); border-color: rgba(59,130,246,0.3); }
    .deal-btn.sel { background: var(--warning-dim); border-color: rgba(245,158,11,0.3); color: #92400e; }

    /* ── Primary CTA button ─────────────────────────────────── */
    .btn-primary {
      width: 100%;
      background: var(--accent);
      border: none;
      color: #fff;
      padding: 13px;
      border-radius: var(--radius);
      font-size: 0.95rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(59,130,246,0.3);
      transition: background 0.15s, transform 0.1s;
    }
    .btn-primary:active { transform: scale(0.98); background: #2563eb; }

    /* ── History list ───────────────────────────────────────── */
    .history-empty {
      font-size: 0.82rem;
      color: var(--text-muted);
      text-align: center;
      padding: 10px 0;
    }
    .history-lbl {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .hist-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.84rem;
    }
    .hist-item:last-child { border-bottom: none; }
    .hist-code { font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .hist-time { font-size: 0.72rem; color: var(--text-muted); }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="app-header">
    <div class="app-logo">EVA <b>POS</b></div>
    <div class="conn-dot">متصل بالكاشير</div>
  </header>

  <div class="content">

    <!-- Mode Switcher -->
    <div class="mode-bar">
      <button class="mode-btn active" id="tabPos" onclick="setMode('pos')">ماسح الكاشير</button>
      <button class="mode-btn" id="tabChecker" onclick="setMode('checker')">فاحص الأسعار والمضاعفات</button>
    </div>

    <!-- Toast -->
    <div id="toast"></div>

    <!-- Camera Scanner -->
    <div class="scanner-card">
      <div class="scanner-viewport">
        <div id="reader"></div>
        <div class="reticle">
          <div class="reticle-frame">
            <div class="reticle-beam"></div>
          </div>
        </div>
      </div>
      <div class="scanner-controls">
        <button class="ctrl-btn" id="btnTorch" onclick="toggleTorch()">الكشاف</button>
        <button class="ctrl-btn" onclick="flipCamera()">تبديل الكاميرا</button>
        <button class="ctrl-btn" id="btnPause" onclick="togglePause()">إيقاف مؤقت</button>
      </div>
    </div>

    <!-- Manual Barcode Input -->
    <form class="search-bar" onsubmit="handleManual(event)">
      <input type="text" id="manualBarcode" placeholder="باركود أو رمز SKU يدوياً..." inputmode="numeric" autocomplete="off" />
      <button type="submit">بحث</button>
    </form>

    <!-- Product Card (Mode 2) -->
    <div class="card" id="productCard" style="display:none;">

      <div class="prod-row">
        <div class="prod-name" id="pName">—</div>
        <div class="stock-pill ok" id="pStock">0 قطعة</div>
      </div>

      <div class="meta-row">
        <span class="meta-tag" id="pSku">SKU: —</span>
        <span class="meta-tag" id="pVariant">—</span>
        <span class="meta-tag" id="pBarcode">—</span>
      </div>

      <!-- Retail vs Wholesale -->
      <div class="price-panel">
        <div class="price-box">
          <div class="price-box-lbl">سعر البيع</div>
          <div class="price-box-num" style="color:var(--accent);" id="pRetail">0 د.ع</div>
          <div class="price-box-sub" style="color:var(--text-muted);" id="pMultLabel">مضاعف: 3.0x</div>
        </div>
        <div class="price-box">
          <div class="price-box-lbl">سعر الجملة (التكلفة)</div>
          <div class="price-box-num" style="color:var(--warning);" id="pCost">0 د.ع</div>
          <div class="price-box-sub" style="color:var(--success);" id="pBaseProfit">+0 د.ع</div>
        </div>
      </div>

      <!-- Multiplier Matrix -->
      <div class="section-lbl">
        <span style="background:none;border:none;padding:0;font-size:inherit;color:inherit;">مضاعفات التكلفة</span>
        <span>خصم الزبون / ربحك</span>
      </div>
      <div class="mult-grid" id="multGrid"></div>

      <!-- Custom Slider -->
      <div class="slider-panel">
        <div class="slider-head">
          <span>مضاعف مخصص</span>
          <span class="slider-val" id="sliderLbl">2.0×</span>
        </div>
        <input type="range" id="multRange" min="1.0" max="3.5" step="0.1" value="2.0" oninput="onSlider(this.value)">
      </div>

      <!-- Direct Custom Price Input -->
      <div class="custom-price-panel">
        <div class="custom-price-head">
          <span>سعر البيع المخصص (كتابة يدوية)</span>
          <span style="font-size:0.72rem; color:var(--accent); font-weight:700;">دقة بدون تقريب</span>
        </div>
        <div class="custom-price-input-box">
          <input
            type="number"
            id="customPriceInput"
            placeholder="اكتب السعر هنا (مثلاً: 30000)..."
            inputmode="numeric"
            oninput="onCustomPriceDirect(this.value)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();dispatchToPos();}"
          />
          <span>د.ع</span>
        </div>
      </div>

      <!-- Live Calculation -->
      <div class="result-panel" id="calcPanel">
        <div class="res-row">
          <span>سعر البيع (<strong id="calcX" style="color:var(--accent);">2.0×</strong>)</span>
          <b id="calcPrice">0 د.ع</b>
        </div>
        <div class="res-row">
          <span>خصم الزبون من السعر الأساسي</span>
          <span class="hl" id="calcDisc">0%</span>
        </div>
        <div class="res-row">
          <span>صافي الربح للقطعة</span>
          <span class="profit" id="calcProfit">+0 د.ع (0%)</span>
        </div>
        <div class="res-row">
          <span>إجمالي 3 قطع</span>
          <b id="calcTriple">0 د.ع</b>
        </div>
      </div>

      <!-- Quick Promos -->
      <div class="section-lbl" style="margin-bottom:8px;">عروض سريعة</div>
      <div class="deals-grid">
        <button class="deal-btn" onclick="promo(10)">-10%</button>
        <button class="deal-btn" onclick="promo(15)">-15%</button>
        <button class="deal-btn" onclick="promo(20)">-20%</button>
        <button class="deal-btn" onclick="promo(25)">-25%</button>
        <button class="deal-btn" onclick="promo(30)">-30%</button>
        <button class="deal-btn" onclick="promo(50)">-50%</button>
        <button class="deal-btn" onclick="buy2get1()">3 بسعر 2</button>
        <button class="deal-btn" onclick="bogoHalf()">الثانية بـ 50%</button>
      </div>

      <button class="btn-primary" id="btnDispatch" onclick="dispatchToPos()">إضافة إلى سلة الكاشير</button>
    </div>

    <!-- History (Mode 1) -->
    <div class="card" id="histCard">
      <div class="history-lbl">آخر الأصناف الممسوحة</div>
      <div id="histList">
        <div class="history-empty">وجه الكاميرا نحو أي باركود للبدء...</div>
      </div>
    </div>

  </div><!-- /content -->

  <script>
    let mode = 'pos';
    let scanner = null;
    let facing = 'environment';
    let torchOn = false;
    let paused = false;
    let lastCode = '';
    let lastTime = 0;
    let product = null;
    let multiplier = 2.0;
    let currentPrice = 0;
    const history = [];

    function toast(msg, err = false, ms = 3000) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = err ? 'err' : '';
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.style.display = 'none'; }, ms);
    }

    function setMode(m) {
      mode = m;
      document.getElementById('tabPos').className     = 'mode-btn' + (m === 'pos'     ? ' active' : '');
      document.getElementById('tabChecker').className = 'mode-btn' + (m === 'checker' ? ' active' : '');
      document.getElementById('productCard').style.display = m === 'checker' && product ? 'block' : 'none';
      document.getElementById('histCard').style.display    = m === 'pos' ? 'block' : 'none';
      toast(m === 'pos' ? 'وضع الكاشير: كل مسح يُرسل للكاشير مباشرة.' : 'وضع الفحص: امسح منتجاً لرؤية التكلفة والمضاعفات.');
    }

    function chime() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1400, t);
        o.frequency.exponentialRampToValueAtTime(1800, t + 0.07);
        g.gain.setValueAtTime(0.25, t);
        g.gain.linearRampToValueAtTime(0, t + 0.08);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.09);
      } catch(_) {}
      if (navigator.vibrate) navigator.vibrate([28, 18, 38]);
    }

    function startScanner() {
      if (typeof Html5Qrcode === 'undefined') { setTimeout(startScanner, 300); return; }
      if (scanner) { scanner.stop().catch(() => {}).finally(run); } else { run(); }
    }

    function run() {
      scanner = new Html5Qrcode('reader', { verbose: false });
      // Camera constraints: request HD resolution + continuous autofocus for best barcode reads
      const camConstraints = {
        facingMode: facing,
        width:  { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }],
      };
      // qrbox as a function so it tracks viewport size dynamically
      const qrbox = (vw, vh) => ({
        width:  Math.round(vw * 0.82),
        height: Math.round(vh * 0.55),
      });
      scanner.start(
        camConstraints,
        {
          fps: 30,
          qrbox,
          // Do NOT set aspectRatio — let the camera run at its native ratio
          disableFlip: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.CODE_39,
          ]
        },
        onScan, () => {}
      ).catch(err => {
        // Retry without advanced constraints if browser rejects them
        scanner = new Html5Qrcode('reader', { verbose: false });
        scanner.start(
          { facingMode: facing },
          { fps: 30, qrbox: { width: 260, height: 140 }, disableFlip: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.CODE_39,
            ]
          },
          onScan, () => {}
        ).catch(() => toast('يرجى منح إذن الكاميرا ثم أعد تحميل الصفحة.', true, 8000));
      });
    }

    function flipCamera()  { facing = facing === 'environment' ? 'user' : 'environment'; startScanner(); }
    function toggleTorch() {
      if (!scanner) return;
      torchOn = !torchOn;
      document.getElementById('btnTorch').className = 'ctrl-btn' + (torchOn ? ' on' : '');
      scanner.applyVideoConstraints({ advanced: [{ torch: torchOn }] }).catch(() => {});
    }
    function togglePause() {
      if (!scanner) return;
      paused = !paused;
      paused ? scanner.pause() : scanner.resume();
      document.getElementById('btnPause').textContent = paused ? 'استئناف' : 'إيقاف مؤقت';
    }

    async function onScan(code) {
      const now = Date.now();
      // Only debounce the exact same barcode; different codes fire immediately
      if (code === lastCode && now - lastTime < 1800) return;
      lastCode = code; lastTime = now;
      chime();
      if (mode === 'pos') {
        try {
          const r = await fetch('/api/scan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ barcode: code, source: 'mobile' }) });
          const d = await r.json();
          d.success ? (toast('تم إرسال (' + code + ') للكاشير'), addHistory(code)) : toast('صنف غير معروف: ' + code, true);
        } catch { toast('تعذر الاتصال بالكاشير', true); }
      } else {
        await lookup(code);
      }
    }

    async function lookup(code) {
      try {
        const r = await fetch('/api/product?query=' + encodeURIComponent(code));
        const d = await r.json();
        if (!d.found) { toast('لا يوجد منتج بهذا الباركود: ' + code, true); document.getElementById('productCard').style.display = 'none'; return; }
        product = d.product;
        renderProduct(d);
      } catch { toast('خطأ في جلب بيانات المنتج', true); }
    }

    function fmt(n) { return Number(n).toLocaleString('en-IQ'); }

    function renderProduct(d) {
      const p = d.product;
      document.getElementById('pName').textContent = p.name;
      const sp = document.getElementById('pStock');
      sp.textContent = p.stockOnHand + ' قطعة';
      sp.className = 'stock-pill ' + (p.stockOnHand <= 0 ? 'out' : p.stockOnHand <= 3 ? 'low' : 'ok');
      document.getElementById('pSku').textContent    = 'SKU: ' + p.sku;
      document.getElementById('pVariant').textContent = [p.color, p.size].filter(Boolean).join(' / ') || 'افتراضي';
      document.getElementById('pBarcode').textContent = p.barcode || p.sku;
      document.getElementById('pRetail').textContent  = fmt(p.priceIQD) + ' د.ع';
      document.getElementById('pMultLabel').textContent = 'مضاعف: ' + p.currentMultiplier + 'x';
      document.getElementById('pCost').textContent    = fmt(p.costIQD) + ' د.ع';
      document.getElementById('pBaseProfit').textContent = '+' + fmt(p.profitIQD) + ' د.ع (' + p.profitMarginPct + '%)';

      const grid = document.getElementById('multGrid');
      grid.innerHTML = '';
      const tiers = d.multiplierTiers || buildTiers(p);
      tiers.forEach(t => {
        const el = document.createElement('div');
        el.className = 'mult-cell' + (t.multiplier === 2.0 ? ' sel' : '');
        el.onclick = () => selectMult(t.multiplier);
        el.innerHTML = \`<div class="mc-x">\${t.multiplier}x</div><div class="mc-p">\${fmt(t.priceIQD)}</div><div class="mc-d">-\${t.discountPct}%</div>\`;
        grid.appendChild(el);
      });

      document.getElementById('productCard').style.display = 'block';
      selectMult(2.0);
      document.getElementById('productCard').scrollIntoView({ behavior: 'smooth' });
    }

    function buildTiers(p) {
      const c = p.costIQD, b = p.priceIQD;
      return [1.0, 1.5, 1.8, 2.0, 2.5, 3.0].map(m => ({
        multiplier: m,
        priceIQD: m === 3.0 ? b : Math.round(c * m),
        discountPct: b > 0 ? Math.max(0, Math.round(((b - Math.round(c * m)) / b) * 100)) : 0,
      }));
    }

    function selectMult(m) {
      multiplier = m;
      document.getElementById('multRange').value = m;
      document.getElementById('sliderLbl').textContent = m.toFixed(1) + '×';
      document.querySelectorAll('.mult-cell').forEach(el => {
        const x = el.querySelector('.mc-x');
        el.className = 'mult-cell' + (x && x.textContent === m + 'x' ? ' sel' : '');
      });
      calc(m);
    }

    function onSlider(v) {
      multiplier = parseFloat(v);
      document.getElementById('sliderLbl').textContent = multiplier.toFixed(1) + '×';
      calc(multiplier);
    }

    function onCustomPriceDirect(val) {
      if (!product) return;
      const parsed = parseFloat(val);
      if (isNaN(parsed) || parsed < 0) {
        currentPrice = 0;
        return;
      }
      currentPrice = Math.round(parsed);
      const cost = product.costIQD, base = product.priceIQD;
      const m = cost > 0 ? Math.round((currentPrice / cost) * 100) / 100 : 0;
      multiplier = m;

      // Update slider value
      const rangeEl = document.getElementById('multRange');
      if (rangeEl) rangeEl.value = Math.max(1.0, Math.min(3.5, m));
      const sliderLbl = document.getElementById('sliderLbl');
      if (sliderLbl) sliderLbl.textContent = (m > 0 ? m.toFixed(2) : '—') + '×';

      // Unselect predefined grid cells unless match
      document.querySelectorAll('.mult-cell').forEach(el => {
        const x = el.querySelector('.mc-x');
        el.className = 'mult-cell' + (x && x.textContent === m.toFixed(1) + 'x' ? ' sel' : '');
      });

      // Update calculations
      const disc = base > 0 ? Math.max(0, Math.round(((base - currentPrice) / base) * 1000) / 10) : 0;
      const prof = currentPrice - cost;
      const marg = currentPrice > 0 ? Math.round((prof / currentPrice) * 1000) / 10 : 0;

      document.getElementById('calcX').textContent      = (m > 0 ? m.toFixed(2) : '—') + '×';
      document.getElementById('calcPrice').textContent  = fmt(currentPrice) + ' د.ع';
      document.getElementById('calcDisc').textContent   = disc + '% من السعر الأساسي';
      document.getElementById('calcProfit').textContent = (prof >= 0 ? '+' : '') + fmt(prof) + ' د.ع (هامش ' + marg + '%)';
      document.getElementById('calcTriple').textContent = fmt(currentPrice * 3) + ' د.ع  (ربح +' + fmt(prof * 3) + ' د.ع)';

      const btn = document.getElementById('btnDispatch');
      if (btn) {
        btn.textContent = 'إرسال للكاشير بسعر (' + fmt(currentPrice) + ' د.ع)';
      }
    }

    function calc(m) {
      if (!product) return;
      const cost = product.costIQD, base = product.priceIQD;
      const price = Math.round(cost * m);
      currentPrice = price;

      const customInp = document.getElementById('customPriceInput');
      if (customInp && document.activeElement !== customInp) {
        customInp.value = price;
      }

      const disc  = base > 0 ? Math.max(0, Math.round(((base - price) / base) * 1000) / 10) : 0;
      const prof  = price - cost;
      const marg  = price > 0 ? Math.round((prof / price) * 1000) / 10 : 0;
      document.getElementById('calcX').textContent      = m.toFixed(1) + '×';
      document.getElementById('calcPrice').textContent  = fmt(price) + ' د.ع';
      document.getElementById('calcDisc').textContent   = disc + '% من السعر الأساسي';
      document.getElementById('calcProfit').textContent = (prof >= 0 ? '+' : '') + fmt(prof) + ' د.ع (هامش ' + marg + '%)';
      document.getElementById('calcTriple').textContent = fmt(price * 3) + ' د.ع  (ربح +' + fmt(prof * 3) + ' د.ع)';
      const btn = document.getElementById('btnDispatch');
      if (btn) {
        btn.textContent = 'إرسال للكاشير بسعر (' + fmt(price) + ' د.ع)';
      }
    }

    function promo(pct) {
      if (!product) return;
      const targetPrice = Math.round(product.priceIQD * (1 - pct / 100));
      const customInp = document.getElementById('customPriceInput');
      if (customInp) customInp.value = targetPrice;
      onCustomPriceDirect(targetPrice);
    }
    function buy2get1() {
      if (!product) return;
      const targetPrice = Math.round((product.priceIQD * 2) / 3);
      const customInp = document.getElementById('customPriceInput');
      if (customInp) customInp.value = targetPrice;
      onCustomPriceDirect(targetPrice);
    }
    function bogoHalf() {
      if (!product) return;
      const targetPrice = Math.round((product.priceIQD * 1.5) / 2);
      const customInp = document.getElementById('customPriceInput');
      if (customInp) customInp.value = targetPrice;
      onCustomPriceDirect(targetPrice);
    }

    async function dispatchToPos() {
      if (!product) return;
      const code = product.barcode || product.sku;
      const priceToSend = currentPrice > 0 ? currentPrice : Math.round(product.costIQD * multiplier);
      try {
        const r = await fetch('/api/scan', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            barcode: code,
            source: 'mobile',
            overridePrice: priceToSend
          })
        });
        const d = await r.json();
        d.success
          ? (toast('تمت إضافة المنتج بسعر (' + fmt(priceToSend) + ' د.ع) إلى الكاشير'), addHistory(code + ' (' + fmt(priceToSend) + ' د.ع)'))
          : toast('تعذر إرسال الصنف', true);
      } catch { toast('تعذر الاتصال بالشبكة', true); }
    }

    function addHistory(code) {
      history.unshift({ code, t: new Date().toLocaleTimeString('ar-IQ') });
      if (history.length > 6) history.pop();
      const el = document.getElementById('histList');
      el.innerHTML = history.map(h => \`
        <div class="hist-item">
          <span class="hist-code">\${h.code}</span>
          <span class="hist-time">\${h.t}</span>
        </div>\`).join('');
    }

    function handleManual(e) {
      e.preventDefault();
      const inp = document.getElementById('manualBarcode');
      const v = inp.value.trim();
      if (!v) return;
      onScan(v);
      inp.value = ''; inp.blur();
    }

    window.addEventListener('DOMContentLoaded', startScanner);
  </script>
</body>
</html>`;
}

/**
 * Handle HTTP & HTTPS requests
 */
async function handleCompanionRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ─── 1. Serve Offline html5-qrcode.min.js ─────────────────────────────────
  if (pathname === '/vendor/html5-qrcode.min.js') {
    const script = getHtml5QrcodeScript();
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(script);
    return;
  }

  // ─── 2. Serve Companion Web App HTML ─────────────────────────────────────
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getCompanionHtml());
    return;
  }

  // ─── 3. Product Lookup Endpoint (/api/product?query=...) ─────────────────
  if (pathname === '/api/product') {
    const query = parsedUrl.searchParams.get('query') || '';
    const result = await lookupProductDetails(query);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
    return;
  }

  // ─── 4. Scan Dispatch Endpoint (/api/scan) ───────────────────────────────
  if (pathname === '/api/scan' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const barcode = String(payload.barcode || '').trim();
        const overridePrice = payload.overridePrice ? Number(payload.overridePrice) : undefined;

        if (!barcode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Barcode is required' }));
          return;
        }

        log.info(`[companion-server] Received barcode scan from mobile: "${barcode}"`);

        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('companion:barcode-scanned', {
            barcode,
            source: 'mobile',
            overridePrice,
            timestamp: Date.now(),
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, barcode }));
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // ─── 5. Server Info Endpoint (/api/info) ──────────────────────────────────
  if (pathname === '/api/info') {
    const info = await getCompanionServerInfo();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(info));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

/**
 * Start the Companion HTTPS & HTTP server
 */
export async function startCompanionServer(mainWindow: BrowserWindow, port = 8989): Promise<void> {
  mainWindowRef = mainWindow;
  currentPort = port;
  httpRedirectPort = port - 1;

  stopCompanionServer();

  const ip = getLocalIpAddress();

  // Generate self-signed certificate for local HTTPS camera access
  let pems: { private: string; cert: string } = { private: '', cert: '' };
  try {
    const attrs = [{ name: 'commonName', value: ip }];
    const generated = await (selfsigned as any).generate(attrs, { keySize: 2048, algorithm: 'sha256' });
    pems = {
      private: generated.private || generated.key || '',
      cert: generated.cert || '',
    };
  } catch (certErr) {
    log.error('[companion-server] Error generating TLS cert, falling back to HTTP:', certErr);
  }

  // 1. Primary HTTPS Server (allows live video stream on iOS and Android)
  if (pems.private && pems.cert) {
    try {
      httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
        handleCompanionRequest(req, res);
      });

      httpsServer.listen(currentPort, '0.0.0.0', () => {
        log.info(`[companion-server] Mobile HTTPS companion running at https://${ip}:${currentPort}`);
      });
    } catch (httpsErr) {
      log.error('[companion-server] HTTPS start error:', httpsErr);
    }
  }

  // 2. Secondary HTTP Server on 8988 for plain HTTP fallback
  try {
    httpServer = http.createServer((req, res) => {
      handleCompanionRequest(req, res);
    });

    httpServer.listen(httpRedirectPort, '0.0.0.0', () => {
      log.info(`[companion-server] Mobile HTTP companion running at http://${ip}:${httpRedirectPort}`);
    });
  } catch (httpErr) {
    log.error('[companion-server] HTTP start error:', httpErr);
  }
}

/**
 * Stop Companion Servers
 */
export function stopCompanionServer(): void {
  if (httpsServer) {
    try {
      httpsServer.close();
      httpsServer = null;
    } catch {}
  }
  if (httpServer) {
    try {
      httpServer.close();
      httpServer = null;
    } catch {}
  }
  log.info('[companion-server] Stopped.');
}
