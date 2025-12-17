import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Pages.css';
import './ActivityLogsPage.css';

type ActivityLogEntry = import('../types/electron').ActivityLogEntry;

const ActivityLogsPage = (): JSX.Element => {
  const { token, hasRole } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole(['admin', 'manager'])) {
      setError('Access denied. Only admin or manager can view activity logs.');
      setLoading(false);
      return;
    }

    const loadLogs = async () => {
      if (!token || !window.evaApi) {
        setError('Desktop bridge unavailable.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await window.evaApi.auth.getActivityLogs(token, 500);
        setLogs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity logs.');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [token, hasRole]);

  if (!hasRole(['admin', 'manager'])) {
    return (
      <div className="Page Page--transparent ActivityLogsPage">
        <div className="ActivityLogsPage-error">Access denied. Only admin or manager can view activity logs.</div>
      </div>
    );
  }

  return (
    <div className="Page Page--transparent ActivityLogsPage">
      <div className="ActivityLogsPage-header">
        <h1>Activity Logs</h1>
        <p>View system activity and user actions.</p>
      </div>

      {error && <div className="ActivityLogsPage-alert ActivityLogsPage-alert--error">{error}</div>}

      {loading ? (
        <div className="ActivityLogsPage-empty">Loading activity logs...</div>
      ) : logs.length === 0 ? (
        <div className="ActivityLogsPage-empty">No activity logs found.</div>
      ) : (
        <div className="ActivityLogsPage-tableWrapper">
          <table className="ActivityLogsPage-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User ID</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.userId}</td>
                  <td>
                    <span className="ActivityLogsPage-action">{log.action}</span>
                  </td>
                  <td>{log.entity ?? '—'}</td>
                  <td>{log.entityId ?? '—'}</td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActivityLogsPage;

