import { Users } from 'lucide-react';

interface EmployeeSalesEntry {
  employeeId: number | null;
  employeeName: string;
  salesCount: number;
  itemsSold: number;
  totalRevenueIQD: number;
}

interface Props {
  employeeSales: EmployeeSalesEntry[];
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');

export const EmployeesTab = ({ employeeSales, t }: Props): JSX.Element => {
  const totalRevenue = employeeSales.reduce((s, c) => s + c.totalRevenueIQD, 0);
  const totalSalesCount = employeeSales.reduce((s, c) => s + c.salesCount, 0);
  const totalItemsSold = employeeSales.reduce((s, c) => s + c.itemsSold, 0);

  return (
    <>
      {/* Mini KPIs */}
      <div className="Reports-miniKpis">
        <div className="Reports-miniKpi">
          <span>{t('employees') || 'Employees'}</span>
          <strong>{employeeSales.length}</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('totalRevenue') || 'Total Revenue'}</span>
          <strong>{fmt(totalRevenue)} IQD</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('totalItemsSold') || 'Total Items Sold'}</span>
          <strong>{fmt(totalItemsSold)}</strong>
        </div>
      </div>

      {/* Employee Sales Table */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth" style={{ maxHeight: 500 }}>
          <header>
            <h3>
              <Users size={18} /> {t('employeeSales') || 'Sales by Employee'}
            </h3>
          </header>
          {employeeSales.length === 0 ? (
            <div className="Reports-empty">{t('noData')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('employeeName') || 'Employee Name'}</th>
                  <th>{t('salesReport') || 'Sales Count'}</th>
                  <th>{t('totalItemsSold') || 'Items Sold'}</th>
                  <th>{t('totalAmount') || 'Revenue'}</th>
                  <th>{t('share') || '% Share'}</th>
                </tr>
              </thead>
              <tbody>
                {employeeSales.map((entry, idx) => {
                  const share =
                    totalRevenue > 0
                      ? ((entry.totalRevenueIQD / totalRevenue) * 100).toFixed(1)
                      : '0';
                  return (
                    <tr key={entry.employeeId || 'unassigned'}>
                      <td>{idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}</td>
                      <td>{entry.employeeName}</td>
                      <td>{entry.salesCount}</td>
                      <td>{entry.itemsSold}</td>
                      <td>{fmt(entry.totalRevenueIQD)} IQD</td>
                      <td>{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </>
  );
};
