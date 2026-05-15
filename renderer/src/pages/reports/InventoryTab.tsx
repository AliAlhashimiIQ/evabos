import { useState } from 'react';
import { TrendingDown, Factory, Package, X, Check, BarChart3 } from 'lucide-react';

type AdvancedReports = import('../../types/electron').AdvancedReports;
type LeastProfitableItem = import('../../types/electron').LeastProfitableItem;
type LeastProfitableSupplier = import('../../types/electron').LeastProfitableSupplier;
type InventoryAgingItem = import('../../types/electron').InventoryAgingItem;

interface Props {
  reports: AdvancedReports;
  leastProfitableItems: LeastProfitableItem[];
  leastProfitableSuppliers: LeastProfitableSupplier[];
  inventoryAging: InventoryAgingItem[];
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');

export const InventoryTab = ({ reports, leastProfitableItems, leastProfitableSuppliers, inventoryAging, t }: Props): JSX.Element => {
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());

  return (
    <>
      {/* Inventory KPIs */}
      <div className="Reports-miniKpis">
        <div className="Reports-miniKpi">
          <span>{t('totalStockCount') || 'Items in Stock'}</span>
          <strong>{fmt(reports.totalItemsInStock || 0)}</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('inventoryValue')}</span>
          <strong>{fmt(reports.inventoryValue)} IQD</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('totalValueInclSold') || 'Total Value (Incl. Sold)'}</span>
          <strong>{fmt(reports.totalInventoryValueIncludingSoldIQD || 0)} IQD</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('lowStockAlerts')}</span>
          <strong style={{ color: reports.lowStock.length > 0 ? '#f87171' : '#4ade80' }}>{reports.lowStock.length}</strong>
        </div>
      </div>

      {/* Inventory by Supplier */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth">
          <header>
            <h3>{t('inventoryBySupplier')}</h3>
            {selectedSuppliers.size > 0 && (
              <button className="Reports-clearSelection" onClick={() => setSelectedSuppliers(new Set())}>
                <X size={14} /> {t('clearSelection') || 'Clear'} ({selectedSuppliers.size})
              </button>
            )}
          </header>
          {reports.inventoryBySupplier && reports.inventoryBySupplier.length > 0 ? (
            <table>
              <thead><tr>
                <th style={{ width: '40px' }}><Check size={16} /></th>
                <th>{t('supplier')}</th><th>{t('quantity')}</th><th>{t('valueUSD')}</th>
                <th>{t('soldQuantity') || 'Sold Qty'}</th><th>{t('soldValueUSD') || 'Sold (USD)'}</th>
                <th>{t('totalValueAllTime') || 'Total (All Time)'}</th>
              </tr></thead>
              <tbody>
                {reports.inventoryBySupplier.map((item) => (
                  <tr key={item.supplierName}
                    onClick={() => { const ns = new Set(selectedSuppliers); ns.has(item.supplierName) ? ns.delete(item.supplierName) : ns.add(item.supplierName); setSelectedSuppliers(ns); }}
                    style={{ cursor: 'pointer', background: selectedSuppliers.has(item.supplierName) ? 'rgba(99, 102, 241, 0.12)' : 'transparent', borderLeft: selectedSuppliers.has(item.supplierName) ? '3px solid #6366f1' : '3px solid transparent' }}>
                    <td><input type="checkbox" checked={selectedSuppliers.has(item.supplierName)} readOnly style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#6366f1' }} /></td>
                    <td>{item.supplierName === 'No Supplier' ? t('noSupplierAssigned') : item.supplierName}</td>
                    <td>{fmt(item.totalQuantity)}</td>
                    <td>${item.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td>{fmt(item.soldQuantity || 0)}</td>
                    <td>${(item.totalSoldValueUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td><strong>${((item.totalValueUSD || 0) + (item.totalSoldValueUSD || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                  </tr>
                ))}
                {selectedSuppliers.size > 0 && (
                  <tr style={{ background: 'rgba(34, 197, 94, 0.08)', fontWeight: 'bold', borderTop: '2px solid rgba(34, 197, 94, 0.3)' }}>
                    <td><BarChart3 size={16} /></td>
                    <td style={{ color: '#22c55e' }}>{t('selectedTotal') || 'Selected'} ({selectedSuppliers.size})</td>
                    <td style={{ color: '#22c55e' }}>{fmt(reports.inventoryBySupplier.filter(i => selectedSuppliers.has(i.supplierName)).reduce((s, i) => s + i.totalQuantity, 0))}</td>
                    <td style={{ color: '#22c55e' }}>${reports.inventoryBySupplier.filter(i => selectedSuppliers.has(i.supplierName)).reduce((s, i) => s + i.totalValueUSD, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: '#22c55e' }}>{fmt(reports.inventoryBySupplier.filter(i => selectedSuppliers.has(i.supplierName)).reduce((s, i) => s + (i.soldQuantity || 0), 0))}</td>
                    <td style={{ color: '#22c55e' }}>${reports.inventoryBySupplier.filter(i => selectedSuppliers.has(i.supplierName)).reduce((s, i) => s + (i.totalSoldValueUSD || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: '#22c55e' }}><strong>${reports.inventoryBySupplier.filter(i => selectedSuppliers.has(i.supplierName)).reduce((s, i) => s + (i.totalValueUSD || 0) + (i.totalSoldValueUSD || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : <div className="Reports-empty">{t('noData')}</div>}
        </article>
      </section>

      {/* Low Stock + Aging */}
      <section className="Reports-grid">
        <article>
          <header><h3>{t('lowStockAlerts')}</h3></header>
          {reports.lowStock.length === 0 ? <div className="Reports-empty">{t('stockLevelsHealthy')}</div> : (
            <table>
              <thead><tr><th>{t('skuReport')}</th><th>{t('product')}</th><th>{t('variant')}</th><th>{t('qty')}</th></tr></thead>
              <tbody>
                {reports.lowStock.map((e) => (
                  <tr key={e.sku}><td>{e.sku}</td><td>{e.productName}</td><td>{e.color ?? t('any')} / {e.size ?? t('any')}</td><td>{e.quantity}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article>
          <header><h3><Package size={18} /> {t('inventoryAging')}</h3></header>
          {inventoryAging.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <table>
              <thead><tr><th>{t('product')}</th><th>{t('stock')}</th><th>{t('daysInStock')}</th><th>{t('lastSold')}</th></tr></thead>
              <tbody>
                {inventoryAging.map((item, idx) => (
                  <tr key={idx} className={item.daysInStock > 90 ? 'Reports-aging-critical' : item.daysInStock > 60 ? 'Reports-aging-warning' : ''}>
                    <td>{item.productName}</td>
                    <td>{item.currentStock}</td>
                    <td className={item.daysInStock > 90 && item.daysInStock < 999 ? 'Reports-daysHigh' : item.daysInStock > 60 && item.daysInStock < 999 ? 'Reports-daysMedium' : ''}>{item.daysInStock >= 999 ? '∞' : item.daysInStock}</td>
                    <td>{item.lastSoldAt ? new Date(item.lastSoldAt).toLocaleDateString() : t('neverSold')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>

      {/* Least Profitable */}
      <section className="Reports-grid">
        <article>
          <header><h3><TrendingDown size={18} /> {t('leastProfitableItems')}</h3></header>
          {leastProfitableItems.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <table>
              <thead><tr><th>{t('product')}</th><th>{t('sold')}</th><th>{t('profit')}</th><th>{t('marginPercent')}</th></tr></thead>
              <tbody>
                {leastProfitableItems.map((item, idx) => (
                  <tr key={idx} className={item.marginPercent < 0 ? 'Reports-negative' : ''}>
                    <td>{item.productName}</td><td>{item.totalSold}</td>
                    <td className={item.profitIQD < 0 ? 'Reports-negativeValue' : ''}>{fmt(item.profitIQD)} IQD</td>
                    <td className={item.marginPercent < 20 ? 'Reports-lowMargin' : ''}>{item.marginPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article>
          <header><h3><Factory size={18} /> {t('leastProfitableSuppliers')}</h3></header>
          {leastProfitableSuppliers.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <table>
              <thead><tr><th>{t('supplier')}</th><th>{t('sold')}</th><th>{t('profit')}</th><th>{t('marginPercent')}</th></tr></thead>
              <tbody>
                {leastProfitableSuppliers.map((sup, idx) => (
                  <tr key={idx} className={sup.marginPercent < 0 ? 'Reports-negative' : ''}>
                    <td>{sup.supplierName}</td><td>{sup.totalSold}</td>
                    <td className={sup.profitIQD < 0 ? 'Reports-negativeValue' : ''}>{fmt(sup.profitIQD)} IQD</td>
                    <td className={sup.marginPercent < 20 ? 'Reports-lowMargin' : ''}>{sup.marginPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </>
  );
};
