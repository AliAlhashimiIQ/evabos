import { ClipboardList } from 'lucide-react';

type AdvancedReports = import('../../types/electron').AdvancedReports;

interface Props {
  reports: AdvancedReports;
  t: (key: string) => string;
}

export const ActivityTab = ({ reports, t }: Props): JSX.Element => {
  // Summarize by user
  const userMap = new Map<number, number>();
  const actionMap = new Map<string, number>();
  for (const log of reports.activityLogs) {
    userMap.set(log.userId, (userMap.get(log.userId) || 0) + 1);
    actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
  }

  const userSummary = Array.from(userMap.entries()).sort((a, b) => b[1] - a[1]);
  const actionSummary = Array.from(actionMap.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {/* Summary KPIs */}
      <div className="Reports-miniKpis">
        <div className="Reports-miniKpi">
          <span>{t('totalActions') || 'Total Actions'}</span>
          <strong>{reports.activityLogs.length}</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('activeUsers') || 'Active Users'}</span>
          <strong>{userMap.size}</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('actionTypes') || 'Action Types'}</span>
          <strong>{actionMap.size}</strong>
        </div>
      </div>

      <section className="Reports-grid">
        {/* Actions by User */}
        <article>
          <header><h3>{t('actionsByUser') || 'Actions by User'}</h3></header>
          <table>
            <thead><tr><th>{t('user')}</th><th>{t('count') || 'Count'}</th></tr></thead>
            <tbody>
              {userSummary.map(([userId, count]) => (
                <tr key={userId}><td>User #{userId}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </article>

        {/* Actions by Type */}
        <article>
          <header><h3>{t('actionsByType') || 'Actions by Type'}</h3></header>
          <table>
            <thead><tr><th>{t('action')}</th><th>{t('count') || 'Count'}</th></tr></thead>
            <tbody>
              {actionSummary.map(([action, count]) => (
                <tr key={action}><td>{action}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      {/* Full Logs */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth" style={{ maxHeight: 450 }}>
          <header><h3><ClipboardList size={18} /> {t('activityLogs')}</h3></header>
          <table>
            <thead><tr><th>{t('time')}</th><th>{t('user')}</th><th>{t('action')}</th></tr></thead>
            <tbody>
              {reports.activityLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.userId}</td>
                  <td>{log.action} {log.entity ? `(${log.entity} #${log.entityId ?? ''})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </>
  );
};
