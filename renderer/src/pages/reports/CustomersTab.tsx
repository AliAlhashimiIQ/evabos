import { Users } from 'lucide-react';

type AdvancedReports = import('../../types/electron').AdvancedReports;

interface Props {
  reports: AdvancedReports;
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');

export const CustomersTab = ({ reports, t }: Props): JSX.Element => {
  const customers = reports.topCustomers;
  const totalRevenue = customers.reduce((s, c) => s + c.amountIQD, 0);

  return (
    <>
      {/* Mini KPIs */}
      <div className="Reports-miniKpis">
        <div className="Reports-miniKpi">
          <span>{t('totalCustomers') || 'Total Customers'}</span>
          <strong>{customers.length}</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('totalCustomerRevenue') || 'Customer Revenue'}</span>
          <strong>{fmt(totalRevenue)} IQD</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('avgPerCustomer') || 'Avg / Customer'}</span>
          <strong>{customers.length > 0 ? fmt(Math.round(totalRevenue / customers.length)) : 0} IQD</strong>
        </div>
      </div>

      {/* Top Customers Table */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth" style={{ maxHeight: 500 }}>
          <header><h3><Users size={18} /> {t('topCustomers')}</h3></header>
          {customers.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <table>
              <thead><tr>
                <th>#</th>
                <th>{t('customer')}</th>
                <th>{t('ordersReport')}</th>
                <th>{t('spend')}</th>
                <th>{t('share') || '% Share'}</th>
              </tr></thead>
              <tbody>
                {customers.map((entry, idx) => {
                  const share = totalRevenue > 0 ? ((entry.amountIQD / totalRevenue) * 100).toFixed(1) : '0';
                  return (
                    <tr key={entry.name}>
                      <td>{idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}</td>
                      <td>{entry.name}</td>
                      <td>{entry.quantity}</td>
                      <td>{fmt(entry.amountIQD)} IQD</td>
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
