import * as XLSX from 'xlsx';
import { createProduct, adjustVariantStock, ensureVariantStockRow } from './database';
import type { ProductInput } from './types';

export interface ExcelImportRow {
  name?: string;
  code?: string;
  category?: string;
  description?: string;
  color?: string;
  size?: string;
  'Sale Price (IQD)'?: number | string;
  'Purchase Cost (USD)'?: number | string;
  Stock?: number | string;
  Barcode?: string;
  Supplier?: string;
}

export interface ExcelImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Parse Excel file buffer and extract product data
 */
export function parseExcelFile(buffer: Buffer): ExcelImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<ExcelImportRow>(worksheet, { raw: false });

  return rows;
}

/**
 * Normalize and validate Excel row data
 */
function normalizeRow(row: ExcelImportRow): { product: ProductInput; stock: number; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!row.name || typeof row.name !== 'string' || row.name.trim().length === 0) {
    errors.push('Name is required');
  }

  // Parse numeric values
  let salePriceIQD = 0;
  if (row['Sale Price (IQD)']) {
    const parsed = parseFloat(String(row['Sale Price (IQD)']).replace(/,/g, ''));
    if (isNaN(parsed) || parsed < 0) {
      errors.push('Sale Price (IQD) must be a valid positive number');
    } else {
      salePriceIQD = parsed;
    }
  } else {
    errors.push('Sale Price (IQD) is required');
  }

  let purchaseCostUSD = 0;
  if (row['Purchase Cost (USD)']) {
    const parsed = parseFloat(String(row['Purchase Cost (USD)']).replace(/,/g, ''));
    if (isNaN(parsed) || parsed < 0) {
      errors.push('Purchase Cost (USD) must be a valid positive number');
    } else {
      purchaseCostUSD = parsed;
    }
  } else {
    errors.push('Purchase Cost (USD) is required');
  }

  let stock = 0;
  if (row.Stock !== undefined && row.Stock !== null && row.Stock !== '') {
    const parsed = parseFloat(String(row.Stock).replace(/,/g, ''));
    if (!isNaN(parsed) && parsed >= 0) {
      stock = parsed;
    }
  }

  const product: ProductInput = {
    name: row.name?.trim() ?? '',
    code: row.code?.trim() || null,
    category: row.category?.trim() || null,
    description: row.description?.trim() || null,
    color: row.color?.trim() || null,
    size: row.size?.trim() || null,
    salePriceIQD,
    purchaseCostUSD,
    barcode: row.Barcode?.trim() || null,
    supplierId: null, // Will be resolved by supplier name if needed
  };

  return { product, stock, errors };
}

/**
 * Import products from Excel file
 */
export async function importProductsFromExcel(
  buffer: Buffer,
  branchId: number = 1,
): Promise<ExcelImportResult> {
  const rows = parseExcelFile(buffer);
  const result: ExcelImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2; // +2 because Excel rows start at 1 and we skip header
    const row = rows[i];

    try {
      const { product, stock, errors } = normalizeRow(row);

      if (errors.length > 0) {
        result.failed++;
        result.errors.push({
          row: rowIndex,
          error: errors.join('; '),
        });
        continue;
      }

      // Create product
      const created = await createProduct(product);

      // Set initial stock if provided
      if (stock > 0) {
        await ensureVariantStockRow(created.id, branchId);
        await adjustVariantStock({
          variantId: created.id,
          branchId,
          deltaQuantity: stock,
          reason: 'excel_import',
          note: `Initial stock from Excel import`,
          adjustedBy: null,
        });
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

