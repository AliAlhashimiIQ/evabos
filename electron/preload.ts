import { contextBridge, ipcRenderer } from 'electron';
import type {
  ProductInput,
  ProductUpdateInput,
  VariantUpdateInput,
  SaleInput,
  DateRange,
  ExchangeRateInput,
  SupplierInput,
  PurchaseOrderInput,
  PurchaseOrderReceiveInput,
  CustomerInput,
  CustomerUpdateInput,
  ReturnInput,
  ExpenseInput,
  // AdvancedReports removed (unused)
  UserInput,
  UserUpdateInput,
  BranchInput,
  BranchUpdateInput,
} from './db/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder for future API methods
  platform: process.platform,
  getSetting: (key: string) => ipcRenderer.invoke('db:get-setting', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('db:set-setting', key, value),
  getLegalDocument: (type: 'eula' | 'privacy' | 'terms') => ipcRenderer.invoke('legal:get-document', type),
  getAllSettings: () => ipcRenderer.invoke('db:get-all-settings'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  resetFocus: () => ipcRenderer.invoke('app:reset-focus'),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  onUpdateStatus: (callback: (status: string, info?: any) => void) => {
    // Clean up previous listeners to avoid duplicates if necessary, 
    // but in a preload context for a React app, usually useEffect handles cleanup.
    // For simplicity, we just add the listener. The renderer should handle removeListener if needed.
    const subscription = (_: any, status: string, info?: any) => callback(status, info);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.removeListener('update-status', subscription);
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    const subscription = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('update-download-progress', subscription);
    return () => ipcRenderer.removeListener('update-download-progress', subscription);
  }
});

contextBridge.exposeInMainWorld('evaApi', {
  products: {
    list: (token: string) => ipcRenderer.invoke('inventory:products:list', token),
    create: (token: string, data: ProductInput) => ipcRenderer.invoke('inventory:products:create', token, data),
    update: (token: string, data: ProductUpdateInput) => ipcRenderer.invoke('inventory:products:update', token, data),
    updateVariant: (token: string, data: VariantUpdateInput) => ipcRenderer.invoke('inventory:variants:update', token, data),
    deleteVariant: (token: string, variantId: number) => ipcRenderer.invoke('inventory:variants:delete', token, variantId),
    adjustStock: (token: string, payload: {
      variantId: number;
      branchId: number;
      deltaQuantity: number;
      reason: string;
      note?: string;
      userId?: number | null;
    }) => ipcRenderer.invoke('inventory:stock:adjust', token, payload),
    importExcel: (token: string, payload: { fileBuffer: number[] | Buffer; branchId?: number }) =>
      ipcRenderer.invoke('inventory:excel:import', token, payload),
  },
  sales: {
    create: (token: string, data: SaleInput) => ipcRenderer.invoke('sales:create', token, data),
    listByDateRange: (token: string, range: DateRange) => ipcRenderer.invoke('sales:listByDateRange', token, range),
    getDetail: (token: string, saleId: number) => ipcRenderer.invoke('sales:getDetail', token, saleId),
    delete: (token: string, saleId: number) => ipcRenderer.invoke('sales:delete', token, saleId),
  },
  exchangeRates: {
    getCurrent: () => ipcRenderer.invoke('exchangeRates:getCurrent'),
    update: (token: string, data: ExchangeRateInput) => ipcRenderer.invoke('exchangeRates:update', token, data),
  },
  suppliers: {
    list: (token: string) => ipcRenderer.invoke('suppliers:list', token),
    create: (token: string, data: SupplierInput) => ipcRenderer.invoke('suppliers:create', token, data),
    update: (token: string, id: number, data: SupplierInput) => ipcRenderer.invoke('suppliers:update', token, id, data),
    delete: (token: string, id: number) => ipcRenderer.invoke('suppliers:delete', token, id),
  },
  purchaseOrders: {
    list: (token: string) => ipcRenderer.invoke('purchasing:purchase-orders:list', token),
    create: (token: string, data: PurchaseOrderInput) => ipcRenderer.invoke('purchasing:purchase-orders:create', token, data),
    receive: (token: string, data: PurchaseOrderReceiveInput) => ipcRenderer.invoke('purchasing:purchase-orders:receive', token, data),
  },
  customers: {
    list: (token: string) => ipcRenderer.invoke('customers:list', token),
    create: (token: string, data: CustomerInput) => ipcRenderer.invoke('customers:create', token, data),
    update: (token: string, data: CustomerUpdateInput) => ipcRenderer.invoke('customers:update', token, data),
    delete: (token: string, customerId: number) => ipcRenderer.invoke('customers:delete', token, customerId),
    history: (token: string, customerId: number) => ipcRenderer.invoke('customers:history', token, customerId),
    attachSale: (token: string, payload: { saleId: number; customerId: number }) => ipcRenderer.invoke('customers:attach-sale', token, payload),
  },
  returns: {
    list: (token: string) => ipcRenderer.invoke('returns:list', token),
    create: (token: string, data: ReturnInput) => ipcRenderer.invoke('returns:create', token, data),
    saleInfo: (token: string, saleId: number) => ipcRenderer.invoke('returns:sale-info', token, saleId),
  },
  expenses: {
    list: (token: string) => ipcRenderer.invoke('expenses:list', token),
    create: (token: string, data: ExpenseInput) => ipcRenderer.invoke('expenses:create', token, data),
    delete: (token: string, expenseId: number) => ipcRenderer.invoke('expenses:delete', token, expenseId),
    summary: (token: string, range: DateRange) => ipcRenderer.invoke('expenses:summary', token, range),
  },
  settings: {
    reset: (token: string) => ipcRenderer.invoke('settings:reset', token),
  },
  reports: {
    advanced: (token: string, range: DateRange) => ipcRenderer.invoke('reports:advanced', token, range),
    peakHours: (token: string, params: { startDate: string; endDate: string; branchId?: number }) => ipcRenderer.invoke('reports:peakHours', token, params),
    peakDays: (token: string, params: { startDate: string; endDate: string; branchId?: number }) => ipcRenderer.invoke('reports:peakDays', token, params),
    leastProfitableItems: (token: string, params: { startDate: string; endDate: string; exchangeRate?: number; limit?: number }) => ipcRenderer.invoke('reports:leastProfitableItems', token, params),
    leastProfitableSuppliers: (token: string, params: { startDate: string; endDate: string; exchangeRate?: number }) => ipcRenderer.invoke('reports:leastProfitableSuppliers', token, params),
    inventoryAging: (token: string, params: { limit?: number }) => ipcRenderer.invoke('reports:inventoryAging', token, params),
  },
  email: {
    getSettings: (token: string) => ipcRenderer.invoke('email:getSettings', token),
    saveSettings: (token: string, settings: {
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      smtpUser: string;
      smtpPassword: string;
      emailRecipient: string;
      emailEnabled: boolean;
    }) => ipcRenderer.invoke('email:saveSettings', token, settings),
    sendTest: (token: string) => ipcRenderer.invoke('email:sendTest', token),
  },
  printing: {
    getPrinters: () => ipcRenderer.invoke('printing:get-printers'),
    print: (payload: { html: string; printerName?: string | null }) =>
      ipcRenderer.invoke('printing:print', payload),
  },
  users: {
    list: (token: string) => ipcRenderer.invoke('users:list', token),
    create: (token: string, payload: UserInput) => ipcRenderer.invoke('users:create', token, payload),
    update: (token: string, payload: UserUpdateInput) => ipcRenderer.invoke('users:update', token, payload),
    delete: (token: string, userId: number) => ipcRenderer.invoke('users:delete', token, userId),
  },
  branches: {
    list: (token: string) => ipcRenderer.invoke('branches:list', token),
    create: (token: string, payload: BranchInput) => ipcRenderer.invoke('branches:create', token, payload),
    update: (token: string, payload: BranchUpdateInput) => ipcRenderer.invoke('branches:update', token, payload),
  },
  dashboard: {
    getKPIs: (token: string, branchId?: number, dateRange?: { startDate: string; endDate: string }) =>
      ipcRenderer.invoke('dashboard:getKPIs', token, branchId ?? undefined, dateRange),
  },
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
    getCurrentUser: (token: string) => ipcRenderer.invoke('auth:getCurrentUser', token),
    getPosLockStatus: () => ipcRenderer.invoke('auth:getPosLockStatus'),
    lockPos: (token: string) => ipcRenderer.invoke('auth:lockPos', token),
    unlockPos: (token: string) => ipcRenderer.invoke('auth:unlockPos', token),
    getActivityLogs: (token: string, limit?: number) => ipcRenderer.invoke('auth:getActivityLogs', token, limit),
    changePassword: (token: string, currentPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:changePassword', token, currentPassword, newPassword),
  },
  backup: {
    create: (token: string) => ipcRenderer.invoke('backup:create', token),
    list: (token: string) => ipcRenderer.invoke('backup:list', token),
    restore: (token: string, backupPath: string) => ipcRenderer.invoke('backup:restore', token, backupPath),
    delete: (token: string, backupPath: string) => ipcRenderer.invoke('backup:delete', token, backupPath),
    getDir: (token: string) => ipcRenderer.invoke('backup:getDir', token),
    selectFile: (token: string) => ipcRenderer.invoke('backup:selectFile', token),
  },
  licensing: {
    validate: () => ipcRenderer.invoke('licensing:validate'),
    getMachineId: () => ipcRenderer.invoke('licensing:getMachineId'),
    getUsbInfo: () => ipcRenderer.invoke('licensing:getUsbInfo'),
    activate: (licenseKey: string) => ipcRenderer.invoke('licensing:activate', licenseKey),
  },
});

