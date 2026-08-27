import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Download,
  LogIn,
  ShoppingCart,
  RotateCcw,
  Edit3,
  Trash2,
  Activity,
  User,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './Pages.css';
import './ActivityLogsPage.css';

type ActivityLogEntry = import('../types/electron').ActivityLogEntry;

const ITEMS_PER_PAGE = 25;

const formatEnglishDateTime = (dateVal: string | Date | number): string => {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hh = String(hours).padStart(2, '0');

  return `${yyyy}/${mm}/${dd} • ${hh}:${minutes} ${ampm}`;
};

const ActivityLogsPage = (): JSX.Element => {
  const { token, hasRole } = useAuth();
  const { language, t } = useLanguage();

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState('allTime');
  const [currentPage, setCurrentPage] = useState(1);

  const loadLogs = async () => {
    if (!token || !window.evaApi) {
      setError(t('desktopBridgeUnavailable') || 'Desktop bridge unavailable.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await window.evaApi.auth.getActivityLogs(token, 1000);
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasRole(['admin', 'manager'])) {
      setError(t('accessDeniedBackup') || 'Access denied. Only admin or manager can view activity logs.');
      setLoading(false);
      return;
    }

    loadLogs();
  }, [token, hasRole]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Date filtering
    if (datePreset !== 'allTime') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (datePreset === 'today') {
        result = result.filter((l) => new Date(l.createdAt) >= todayStart);
      } else if (datePreset === 'last7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        result = result.filter((l) => new Date(l.createdAt) >= sevenDaysAgo);
      } else if (datePreset === 'thisMonth') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        result = result.filter((l) => new Date(l.createdAt) >= monthStart);
      }
    }

    // Action filtering
    if (actionFilter !== 'ALL') {
      result = result.filter((l) => l.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    // Search query filtering
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((l) => {
        const actionMatch = l.action.toLowerCase().includes(term);
        const entityMatch = (l.entity || '').toLowerCase().includes(term);
        const userMatch = String(l.userId).includes(term);
        const idMatch = String(l.id).includes(term);
        const metaMatch = (l.metadata || '').toLowerCase().includes(term);
        return actionMatch || entityMatch || userMatch || idMatch || metaMatch;
      });
    }

    return result;
  }, [logs, searchTerm, actionFilter, datePreset]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, datePreset]);

  // Metrics
  const stats = useMemo(() => {
    const total = logs.length;
    const logins = logs.filter((l) => l.action.toLowerCase().includes('login')).length;
    const sales = logs.filter((l) => l.action.toLowerCase().includes('sale')).length;
    const uniqueUsers = new Set(logs.map((l) => l.userId)).size;

    return { total, logins, sales, uniqueUsers };
  }, [logs]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['ID', 'User ID', 'Action', 'Entity', 'Entity ID', 'Metadata', 'Date'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.userId,
      l.action,
      l.entity || '',
      l.entityId || '',
      (l.metadata || '').replace(/"/g, '""'),
      new Date(l.createdAt).toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for action badges
  const renderActionBadge = (action: string) => {
    const act = action.toLowerCase();
    let variant = 'gray';
    let icon = <Activity size={13} />;
    let label = action;

    if (act.includes('login') || act.includes('auth')) {
      variant = 'green';
      icon = <LogIn size={13} />;
      label = t('actionLogin') || 'Login';
    } else if (act.includes('sale') || act.includes('checkout')) {
      variant = 'blue';
      icon = <ShoppingCart size={13} />;
      label = t('actionSale') || 'Sale';
    } else if (act.includes('return') || act.includes('refund')) {
      variant = 'purple';
      icon = <RotateCcw size={13} />;
      label = t('actionReturn') || 'Return';
    } else if (act.includes('create') || act.includes('add')) {
      variant = 'amber';
      icon = <Edit3 size={13} />;
      label = t('actionCreate') || 'Create';
    } else if (act.includes('update') || act.includes('edit')) {
      variant = 'amber';
      icon = <Edit3 size={13} />;
      label = t('actionUpdate') || 'Update';
    } else if (act.includes('delete') || act.includes('remove')) {
      variant = 'red';
      icon = <Trash2 size={13} />;
      label = t('actionDelete') || 'Delete';
    }

    return (
      <span className={`ActivityLogs-actionBadge ${variant}`}>
        {icon}
        <span>{label}</span>
      </span>
    );
  };

  if (!hasRole(['admin', 'manager'])) {
    return (
      <div className="Page ActivityLogsPage">
        <div className="SettingsPage-message error">
          {t('accessDeniedBackup') || 'Access denied. Only admin or manager can view activity logs.'}
        </div>
      </div>
    );
  }

  return (
    <div className="Page ActivityLogsPage">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="ActivityLogs-header">
        <div className="ActivityLogs-headerTitle">
          <h1>
            <ClipboardList size={24} style={{ color: 'var(--accent-primary, #6366f1)' }} />
            {t('activityLogs')}
          </h1>
          <p>{t('activityLogsDesc')}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="ActivityLogs-btn"
            onClick={loadLogs}
            disabled={loading}
            title={t('refresh')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>{t('refresh')}</span>
          </button>

          <button
            className="ActivityLogs-btn"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
          >
            <Download size={16} />
            <span>{t('exportCSV')}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stats Grid ────────────────────────────────── */}
      <div className="ActivityLogs-kpis">
        <div className="ActivityLogs-kpiCard">
          <div className="ActivityLogs-kpiIcon blue">
            <Layers size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="ActivityLogs-kpiLabel">{t('totalEvents')}</span>
            <span className="ActivityLogs-kpiValue">{stats.total.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="ActivityLogs-kpiCard">
          <div className="ActivityLogs-kpiIcon green">
            <LogIn size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="ActivityLogs-kpiLabel">{t('loginEvents')}</span>
            <span className="ActivityLogs-kpiValue">{stats.logins.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="ActivityLogs-kpiCard">
          <div className="ActivityLogs-kpiIcon purple">
            <ShoppingCart size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="ActivityLogs-kpiLabel">{t('saleEvents')}</span>
            <span className="ActivityLogs-kpiValue">{stats.sales.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="ActivityLogs-kpiCard">
          <div className="ActivityLogs-kpiIcon amber">
            <User size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="ActivityLogs-kpiLabel">{t('activeOperators')}</span>
            <span className="ActivityLogs-kpiValue">{stats.uniqueUsers.toLocaleString('en-IQ')}</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ───────────────────────── */}
      <div className="ActivityLogs-toolbar">
        <div className="ActivityLogs-searchBox">
          <Search size={16} className="ActivityLogs-searchIcon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchLogsPlaceholder')}
          />
        </div>

        <div className="ActivityLogs-filters">
          <select
            className="ActivityLogs-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="ALL">{t('allActions')}</option>
            <option value="login">{t('actionLogin')}</option>
            <option value="sale">{t('actionSale')}</option>
            <option value="create">{t('actionCreate')}</option>
            <option value="update">{t('actionUpdate')}</option>
            <option value="delete">{t('actionDelete')}</option>
            <option value="return">{t('actionReturn')}</option>
          </select>

          <select
            className="ActivityLogs-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
          >
            <option value="allTime">{t('allTime')}</option>
            <option value="today">{t('today')}</option>
            <option value="last7days">{t('last7days')}</option>
            <option value="thisMonth">{t('thisMonth')}</option>
          </select>
        </div>
      </div>

      {error && <div className="SettingsPage-message error">{error}</div>}

      {/* ── Table & Content Card ──────────────────────────── */}
      <div className="ActivityLogs-tableCard">
        {loading ? (
          <div className="ActivityLogs-empty">
            <RefreshCw size={28} className="spin ActivityLogs-emptyIcon" />
            <p>{t('loading')}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="ActivityLogs-empty">
            <ClipboardList size={36} className="ActivityLogs-emptyIcon" />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('noLogsFound')}</p>
          </div>
        ) : (
          <>
            <div className="ActivityLogs-tableScroll">
              <table className="ActivityLogs-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('operator')}</th>
                    <th>{t('action')}</th>
                    <th>{t('entityType')}</th>
                    <th>{t('entityIdCol')}</th>
                    <th>{t('details')}</th>
                    <th>{t('timestamp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => {
                    let details = '';
                    if (log.metadata) {
                      try {
                        const meta = JSON.parse(log.metadata);
                        if (meta.details) {
                          details = meta.details;
                        } else {
                          details = Object.entries(meta)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ');
                        }
                      } catch {
                        details = log.metadata;
                      }
                    }

                    return (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          #{log.id}
                        </td>
                        <td>
                          <div className="ActivityLogs-userPill">
                            <User size={13} style={{ color: 'var(--accent-primary)' }} />
                            <span>ID: {log.userId}</span>
                          </div>
                        </td>
                        <td>{renderActionBadge(log.action)}</td>
                        <td>
                          {log.entity ? (
                            <span className="ActivityLogs-entityTag">{log.entity}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{log.entityId ?? '—'}</td>
                        <td>
                          {details ? (
                            <span className="ActivityLogs-metadata" title={details}>
                              {details}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className="ActivityLogs-date">{formatEnglishDateTime(log.createdAt)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="ActivityLogs-pagination">
              <div className="ActivityLogs-pageInfo">
                {language === 'ar'
                  ? `عرض ${paginatedLogs.length} من إجمالي ${filteredLogs.length} سجل (صفحة ${currentPage} من ${totalPages})`
                  : `Showing ${paginatedLogs.length} of ${filteredLogs.length} logs (Page ${currentPage} of ${totalPages})`}
              </div>

              <div className="ActivityLogs-pageControls">
                <button
                  className="ActivityLogs-pageBtn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>

                <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.5rem' }}>
                  {currentPage} / {totalPages}
                </span>

                <button
                  className="ActivityLogs-pageBtn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityLogsPage;
