export interface ProductCore {
  id: number;
  name: string;
  baseCode?: string | null;
  category?: string | null;
  description?: string | null;
  defaultSupplierId?: number | null;
  isActive: boolean;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size?: string | null;
  color?: string | null;
  sku: string;
  barcode?: string | null;
  defaultPriceIQD: number;
  purchaseCostUSD: number;
  avgCostUSD: number;
  lastPurchaseCostUSD: number;
  isActive: boolean;
}

export interface VariantStock {
  variantId: number;
  branchId: number;
  quantity: number;
  lowStockThreshold: number;
}

export interface Product extends ProductVariant {
  name: string;
  productName: string;
  category?: string | null;
  baseCode?: string | null;
  supplierName?: string | null;
  stockOnHand: number;
  salePriceIQD: number;
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
  items: SaleItem[];
  profitIQD?: number | null;
  isReturned?: boolean;
}

export type SaleInput = Omit<Sale, 'id' | 'items' | 'profitIQD'> & {
  items: SaleItemInput[];
};

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

export interface PurchaseOrderItemInput extends Omit<PurchaseOrderItem, 'id' | 'purchaseOrderId'> { }

export interface PurchaseOrderInput extends Omit<PurchaseOrder, 'id' | 'status' | 'orderedAt' | 'receivedAt'> {
  status?: PurchaseOrder['status'];
  orderedAt?: string | null;
  items: PurchaseOrderItemInput[];
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  supplierName: string;
  branchName: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderReceiveInput {
  purchaseOrderId: number;
  receivedAt?: string;
  receivedBy?: number | null;
}

export interface ReturnRecord {
  id: number;
  saleId?: number | null;
  branchId: number;
  processedBy: number;
  customerId?: number | null;
  reason?: string | null;
  refundAmountIQD: number;
  type: 'with_receipt' | 'without_receipt' | 'exchange';
  createdAt: string;
}

export interface ReturnItem {
  id: number;
  returnId: number;
  saleItemId?: number | null;
  variantId: number;
  quantity: number;
  amountIQD: number;
}

export interface ReturnItemInput extends Omit<ReturnItem, 'id' | 'returnId'> {
  direction?: 'return' | 'exchange_out' | 'exchange_in';
}

export interface ReturnInput extends Omit<ReturnRecord, 'id' | 'createdAt' | 'refundAmountIQD'> {
  refundAmountIQD?: number;
  items: ReturnItemInput[];
}

export interface ReturnResponse extends ReturnRecord {
  items: ReturnItem[];
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

export interface CustomerInput extends Omit<
  Customer,
  'id' | 'totalVisits' | 'totalSpentIQD' | 'lastVisitAt' | 'loyaltyPoints'
> { }

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

export interface Expense {
  id: number;
  branchId: number;
  category: string;
  amountIQD: number;
  expenseDate: string;
  note?: string | null;
  enteredBy?: number | null;
}

export interface ExpenseInput extends Omit<Expense, 'id'> { }

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

export interface SupplierInventory {
  supplierName: string;
  totalQuantity: number;
  totalValueUSD: number;
  soldQuantity: number;
  totalSoldValueUSD: number;
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
  lowStock: Array<{ sku: string; productName: string; color?: string | null; size?: string | null; quantity: number }>;
  expensesVsSales: ExpensesVsSalesEntry[];
  activityLogs: ActivityLogEntry[];
  inventoryBySupplier: SupplierInventory[];
  returnsSummary: {
    count: number;
    totalIQD: number;
  };
  totalInventoryValueIncludingSoldIQD?: number;
  totalItemsInStock?: number;
}

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

export interface ActivityLog {
  id: number;
  userId: number;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ProductsListResponse {
  products: Product[];
}

export interface SalesListResponse {
  sales: SaleDetail[];
}

export interface ExchangeRateResponse {
  currentRate: ExchangeRate | null;
}

export interface UserSession {
  token: string;
  userId: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId?: number | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId?: number | null;
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

// Pagination types
export interface PaginationParams {
  limit?: number;      // Default 100
  cursor?: number;     // Last seen ID
  search?: string;     // Optional search term
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: number | null;  // null if no more items
  hasMore: boolean;
  total?: number;  // Optional total count
}

export interface SaleDetailItem extends SaleItem {
  productName: string;
  color?: string | null;
  size?: string | null;
}

export interface SaleDetail extends Sale {
  items: SaleDetailItem[];
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

