export interface ElectronAPI {
  platform: string;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<boolean>;
  getLegalDocument: (type: 'eula' | 'privacy' | 'terms') => Promise<string>;
  getAllSettings: () => Promise<Array<{ key: string; value: string }>>;
  relaunch: () => Promise<void>;
  resetFocus: () => Promise<void>;

  // Auto Updater
  checkForUpdates: () => Promise<any>;
  onUpdateStatus: (callback: (status: string, info?: any) => void) => () => void;
  onDownloadProgress: (callback: (progress: any) => void) => () => void;
}

export interface Product {
  id: number;
  productId: number;
  name: string;
  productName: string;
  code?: string | null;
  baseCode?: string | null;
  barcode?: string | null;
  category?: string | null;
  color?: string | null;
  size?: string | null;
  supplierName?: string | null;
  sku: string;
  salePriceIQD: number;
  purchaseCostUSD: number;
  avgCostUSD: number;
  lastPurchaseCostUSD: number;
  stockOnHand: number;
  isActive: boolean;
}

export type ProductInput = {
  name: string;
  code?: string | null;
  barcode?: string | null;
  category?: string | null;
  description?: string | null;
  color?: string | null;
  size?: string | null;
  salePriceIQD: number;
  purchaseCostUSD: number;
  supplierId?: number | null;
};

export interface SaleItem {
  id: number;
  saleId: number;
  variantId: number;
  quantity: number;
  unitPriceIQD: number;
  unitCostIQDAtSale?: number | null;
  lineTotalIQD: number;
}

export type SaleItemInput = Omit<SaleItem, 'id' | 'saleId'>;

export interface PeakHourData {
  hour: number;
  saleCount: number;
  totalSalesIQD: number;
}

export interface PeakDayData {
  dayOfWeek: number;
  dayName: string;
  saleCount: number;
  totalSalesIQD: number;
}

export interface LeastProfitableItem {
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  totalSold: number;
  revenueIQD: number;
  costIQD: number;
  profitIQD: number;
  marginPercent: number;
}

export interface LeastProfitableSupplier {
  supplierName: string;
  totalSold: number;
  revenueIQD: number;
  costIQD: number;
  profitIQD: number;
  marginPercent: number;
}

export interface InventoryAgingItem {
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  currentStock: number;
  costUSD: number;
  totalValueUSD: number;
  daysInStock: number;
  lastSoldAt: string | null;
}

export interface Sale {
  id: number;
  branchId: number;
  cashierId: number;
  customerId?: number | null;
  saleDate: string;
  subtotalIQD: number;
  discountIQD: number;
  totalIQD: number;
  paymentMethod?: string | null;
  profitIQD?: number | null;
  isReturned?: boolean;
  items: SaleItem[];
}

export type SaleInput = Omit<Sale, 'id' | 'items'> & { items: SaleItemInput[] };

export interface Supplier {
  id: number;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface SupplierInput extends Omit<Supplier, 'id' | 'isActive'> {
  isActive?: boolean;
}

export interface InventoryAdjustment {
  id: number;
  variantId: number;
  branchId: number;
  deltaQuantity: number;
  reason: string;
  note?: string | null;
  adjustedBy?: number | null;
  adjustedAt: string;
}

export interface PurchaseOrder {
  id: number;
  supplierId: number;
  branchId: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  reference?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  subtotalUSD: number;
  shippingUSD: number;
  taxesUSD: number;
  notes?: string | null;
}

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  variantId: number;
  quantity: number;
  costUSD: number;
  costIQD: number;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  supplierName: string;
  branchName: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItemInput extends Omit<PurchaseOrderItem, 'id' | 'purchaseOrderId'> { }

export interface PurchaseOrderInput extends Omit<PurchaseOrder, 'id' | 'orderedAt' | 'receivedAt'> {
  status?: PurchaseOrder['status'];
  orderedAt?: string | null;
  items: PurchaseOrderItemInput[];
}

export interface PurchaseOrderReceiveInput {
  purchaseOrderId: number;
  receivedAt?: string;
  receivedBy?: number | null;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  notes?: string | null;
  totalVisits: number;
  totalSpentIQD: number;
  lastVisitAt?: string | null;
  loyaltyPoints: number;
  discountPercent?: number | null;
}

export type CustomerInput = Omit<Customer, 'id' | 'totalVisits' | 'totalSpentIQD' | 'lastVisitAt' | 'loyaltyPoints'>;

export interface CustomerUpdateInput extends Partial<CustomerInput> {
  id: number;
}

export interface CustomerHistoryEntry {
  saleId: number;
  saleDate: string;
  totalIQD: number;
  paymentMethod?: string | null;
  items: Array<{
    variantId: number;
    productName: string;
    color?: string | null;
    size?: string | null;
    quantity: number;
    lineTotalIQD: number;
  }>;
}

export interface ReturnItem {
  id: number;
  returnId: number;
  saleItemId?: number | null;
  variantId: number;
  quantity: number;
  amountIQD: number;
}

export interface ReturnInput {
  saleId?: number | null;
  branchId: number;
  processedBy: number;
  customerId?: number | null;
  reason?: string | null;
  refundAmountIQD?: number;
  type: 'with_receipt' | 'without_receipt' | 'exchange';
  items: Array<{
    saleItemId?: number | null;
    variantId: number;
    quantity: number;
    amountIQD: number;
    direction?: 'return' | 'exchange_out' | 'exchange_in';
  }>;
}

export interface ReturnResponse {
  id: number;
  saleId?: number | null;
  branchId: number;
  processedBy: number;
  customerId?: number | null;
  reason?: string | null;
  refundAmountIQD: number;
  type: 'with_receipt' | 'without_receipt' | 'exchange';
  createdAt: string;
  items: ReturnItem[];
}

export interface Expense {
  id: number;
  branchId: number;
  category: string;
  amountIQD: number;
  expenseDate: string;
  note?: string | null;
  enteredBy?: number | null;
}

export type ExpenseInput = Omit<Expense, 'id'>;

export interface ExpenseSummary {
  totalIQD: number;
  categories: Array<{ category: string; amountIQD: number }>;
}

export interface DailySalesEntry {
  date: string;
  totalIQD: number;
  orders: number;
  avgTicket: number;
}

export interface NamedMetric {
  name: string;
  quantity: number;
  amountIQD: number;
}

export interface ExpensesVsSalesEntry {
  date: string;
  salesIQD: number;
  expensesIQD: number;
}

export interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  createdAt: string;
}

export interface AdvancedReports {
  dailySales: DailySalesEntry[];
  bestSellingItems: NamedMetric[];
  salesBySize: NamedMetric[];
  salesByColor: NamedMetric[];
  topCustomers: NamedMetric[];
  profitAnalysis: {
    revenueIQD: number;
    costIQD: number;
    expensesIQD: number;
    netProfitIQD: number;
    profitMarginPercent: number;
  };
  inventoryValue: number;
  totalInventoryValueIncludingSoldIQD: number;
  totalItemsInStock: number;
  returnsSummary: {
    totalIQD: number;
    count: number;
  };
  inventoryBySupplier: Array<{
    supplierName: string;
    totalQuantity: number;
    totalValueUSD: number;
    soldQuantity: number;
    totalSoldValueUSD: number;
  }>;
  lowStock: Array<{ sku: string; productName: string; color?: string | null; size?: string | null; quantity: number }>;
  expensesVsSales: ExpensesVsSalesEntry[];
  activityLogs: ActivityLogEntry[];
}

export interface SaleDetail extends Sale {
  items: Array<
    SaleItem & {
      productName: string;
      color?: string | null;
      size?: string | null;
    }
  >;
}

export interface ExchangeRate {
  id: number;
  rate: number;
  effectiveDate: string;
  note?: string | null;
}

export type ExchangeRateInput = {
  rate: number;
  effectiveDate?: string;
  note?: string;
};

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Pagination types
export interface PaginationParams {
  limit?: number;
  cursor?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: number | null;
  hasMore: boolean;
  total?: number;
}

export interface ProductsListResponse {
  products: Product[];
  // For paginated responses
  items?: Product[];
  nextCursor?: number | null;
  hasMore?: boolean;
}

export interface SalesListResponse {
  sales: SaleDetail[];
}

export interface ExchangeRateResponse {
  currentRate: ExchangeRate | null;
}

export interface EvaApi {
  products: {
    list: (token: string, params?: PaginationParams) => Promise<ProductsListResponse>;
    create: (token: string, data: ProductInput) => Promise<Product>;
    update: (token: string, data: ProductUpdateInput) => Promise<Product>;
    updateVariant: (token: string, data: VariantUpdateInput) => Promise<boolean>;
    deleteVariant: (token: string, variantId: number) => Promise<boolean>;
    adjustStock: (token: string, payload: {
      variantId: number;
      branchId: number;
      deltaQuantity: number;
      reason: string;
      note?: string;
      userId?: number | null;
    }) => Promise<InventoryAdjustment>;
    importExcel: (token: string, payload: { fileBuffer: number[] | Buffer; branchId?: number }) => Promise<ExcelImportResult>;
  };
  sales: {
    create: (token: string, data: SaleInput) => Promise<Sale>;
    listByDateRange: (token: string, range: DateRange) => Promise<SalesListResponse>;
    getDetail: (token: string, saleId: number) => Promise<SaleDetail | null>;
    delete: (token: string, saleId: number) => Promise<boolean>;
  };
  exchangeRates: {
    getCurrent: () => Promise<ExchangeRateResponse>;
    update: (token: string, data: ExchangeRateInput) => Promise<ExchangeRateResponse>;
  };
  suppliers: {
    list: (token: string) => Promise<Supplier[]>;
    create: (token: string, data: SupplierInput) => Promise<Supplier>;
    update: (token: string, id: number, data: SupplierInput) => Promise<Supplier>;
    delete: (token: string, supplierId: number) => Promise<boolean>;
  };
  purchaseOrders: {
    list: (token: string) => Promise<PurchaseOrderWithItems[]>;
    create: (token: string, data: PurchaseOrderInput) => Promise<PurchaseOrderWithItems>;
    receive: (token: string, data: PurchaseOrderReceiveInput) => Promise<PurchaseOrderWithItems>;
  };
  customers: {
    list: (token: string) => Promise<Customer[]>;
    create: (token: string, data: CustomerInput) => Promise<Customer>;
    update: (token: string, data: CustomerUpdateInput) => Promise<Customer>;
    delete: (token: string, customerId: number) => Promise<boolean>;
    history: (token: string, customerId: number) => Promise<CustomerHistoryEntry[]>;
    attachSale: (token: string, payload: { saleId: number; customerId: number }) => Promise<boolean>;
  };
  returns: {
    list: (token: string) => Promise<ReturnResponse[]>;
    create: (token: string, data: ReturnInput) => Promise<ReturnResponse>;
    saleInfo: (token: string, saleId: number) => Promise<SaleDetail | null>;
  };
  expenses: {
    list: (token: string) => Promise<Expense[]>;
    create: (token: string, data: ExpenseInput) => Promise<Expense>;
    delete: (token: string, expenseId: number) => Promise<boolean>;
    summary: (token: string, range: DateRange) => Promise<ExpenseSummary>;
  };
  reports: {
    advanced: (token: string, range: DateRange) => Promise<AdvancedReports>;
    peakHours: (token: string, params: { startDate: string; endDate: string; branchId?: number }) => Promise<PeakHourData[]>;
    peakDays: (token: string, params: { startDate: string; endDate: string; branchId?: number }) => Promise<PeakDayData[]>;
    leastProfitableItems: (token: string, params: { startDate: string; endDate: string; exchangeRate?: number; limit?: number }) => Promise<LeastProfitableItem[]>;
    leastProfitableSuppliers: (token: string, params: { startDate: string; endDate: string; exchangeRate?: number }) => Promise<LeastProfitableSupplier[]>;
    inventoryAging: (token: string, params: { limit?: number }) => Promise<InventoryAgingItem[]>;
  };
  printing: {
    getPrinters: () => Promise<Array<{ name: string; description: string; status: number; isDefault: boolean }>>;
    print: (payload: { html: string; printerName?: string | null; silent?: boolean }) => Promise<boolean>;
  };
  auth: {
    login: (username: string, password: string) => Promise<LoginResponse | null>;
    logout: (token: string) => Promise<boolean>;
    getCurrentUser: (token: string) => Promise<CurrentUser | null>;
    getPosLockStatus: () => Promise<PosLockStatus>;
    lockPos: (token: string) => Promise<PosLockStatus>;
    unlockPos: (token: string) => Promise<PosLockStatus>;
    getActivityLogs: (token: string, limit?: number) => Promise<ActivityLogEntry[]>;
    changePassword: (token: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  };
  backup: {
    create: (token: string) => Promise<BackupInfo>;
    list: (token: string) => Promise<BackupInfo[]>;
    restore: (token: string, backupPath: string) => Promise<boolean>;
    delete: (token: string, backupPath: string) => Promise<boolean>;
    getDir: (token: string) => Promise<string>;
    selectFile: (token: string) => Promise<string | null>;
  };

  settings: {
    reset: (token: string) => Promise<void>;
  };
  users: {
    list: (token: string) => Promise<User[]>;
    create: (token: string, payload: UserInput) => Promise<User>;
    update: (token: string, payload: UserUpdateInput) => Promise<User>;
    delete: (token: string, userId: number) => Promise<boolean>;
  };
  branches: {
    list: (token: string) => Promise<Branch[]>;
    create: (token: string, payload: BranchInput) => Promise<Branch>;
    update: (token: string, payload: BranchUpdateInput) => Promise<Branch>;
  };
  dashboard: {
    getKPIs: (token: string, branchId?: number, dateRange?: { startDate: string; endDate: string }) => Promise<DashboardKPIs>;
  };
  licensing: {
    validate: () => Promise<{ valid: boolean; reason?: string; isUsb?: boolean; expiresAt?: string }>;
    getMachineId: () => Promise<string>;
    getUsbInfo: () => Promise<{ isUsb: boolean; serial: string | null }>;
    activate: (licenseKey: string) => Promise<{ success: boolean; error?: string }>;
  };
  email: {
    getSettings: (token: string) => Promise<{
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPassword: string;
      emailRecipient: string;
      emailEnabled: boolean;
      sendTime: string;
    }>;
    saveSettings: (token: string, settings: {
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      smtpUser: string;
      smtpPassword: string;
      emailRecipient: string;
      emailEnabled: boolean;
      sendTime?: string;
    }) => Promise<boolean>;
    sendTest: (token: string) => Promise<{ success: boolean; error?: string }>;
  };
}

export interface ExcelImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface BackupInfo {
  filename: string;
  filepath: string;
  size: number;
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId: number | null;
  branchName?: string | null;
  isLocked: boolean;
  createdAt: string;
}

export interface UserInput {
  username: string;
  password: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId?: number | null;
}

export interface UserUpdateInput {
  id: number;
  username?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'cashier';
  branchId?: number | null;
  isLocked?: boolean;
}

export interface Branch {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  currency: string;
  isActive: boolean;
}

export interface BranchInput {
  name: string;
  address?: string | null;
  phone?: string | null;
  currency?: string;
}

export interface BranchUpdateInput extends Partial<BranchInput> {
  id: number;
  isActive?: boolean;
}

export interface ProductUpdateInput {
  id: number;
  name?: string;
  baseCode?: string | null;
  category?: string | null;
  description?: string | null;
  defaultSupplierId?: number | null;
  isActive?: boolean;
}

export interface VariantUpdateInput {
  id: number;
  size?: string | null;
  color?: string | null;
  defaultPriceIQD?: number;
  purchaseCostUSD?: number;
  isActive?: boolean;
}

export interface DashboardKPIs {
  todaySales: {
    count: number;
    totalItemsSold: number;
    totalIQD: number;
    profitIQD: number;
    avgTicket: number;
  };
  todayExpenses: number;
  lowStockCount: number;
  recentSales: Sale[];
  lowStockItems: Array<{
    sku: string;
    productName: string;
    color?: string | null;
    size?: string | null;
    quantity: number;
  }>;
}

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId?: number | null;
  requiresPasswordChange: boolean;
}

export interface CurrentUser {
  userId: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId?: number | null;
}

export interface PosLockStatus {
  locked: boolean;
  lockedBy: number | null;
}

export interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  createdAt: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    evaApi: EvaApi;
  }
}

