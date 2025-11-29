import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Pages.css';
import './BackupPage.css';

type BackupInfo = import('../types/electron').BackupInfo;

const BackupPage = (): JSX.Element => {
  const { token, hasRole } = useAuth();
  const { t } = useLanguage();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupDir, setBackupDir] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadBackups = async () => {
    if (!token || !window.evaApi) {
      setError(t('desktopBridgeUnavailable'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [backupsList, dir] = await Promise.all([
        window.evaApi.backup.list(token),
        window.evaApi.backup.getDir(token),
      ]);
      setBackups(backupsList);
      setBackupDir(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasRole(['admin', 'manager'])) {
      loadBackups();
    } else {
      setError(t('accessDeniedBackup'));
      setLoading(false);
    }
  }, [token, hasRole]);

  const handleCreateBackup = async () => {
    if (!token || !window.evaApi) return;

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      const backup = await window.evaApi.backup.create(token);
      setSuccess(t('backupCreatedSuccess', { filename: backup.filename }));
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreateBackup'));
    } finally {
      setCreating(false);
    }
  };

  const handleSelectAndRestore = async () => {
    if (!token || !window.evaApi) return;

    try {
      const selectedPath = await window.evaApi.backup.selectFile(token);
      if (!selectedPath) {
        return; // User cancelled
      }

      const filename = selectedPath.split(/[/\\]/).pop() || 'selected file';
      const confirmed = window.confirm(
        t('confirmRestore', { filename })
      );

      if (!confirmed) return;

      setRestoring(selectedPath);
      setError(null);
      setSuccess(null);
      await window.evaApi.backup.restore(token, selectedPath);
      setSuccess(t('backupRestoredSuccess'));
      setSuccess(t('backupRestoredSuccess'));
      // App will restart automatically from main process
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToRestoreBackup'));
      setRestoring(null);
    }
  };

  const handleRestore = async (backupPath: string, filename: string) => {
    if (!token || !window.evaApi) return;

    const confirmed = window.confirm(
      t('confirmRestore', { filename })
    );

    if (!confirmed) return;

    try {
      setRestoring(backupPath);
      setError(null);
      setSuccess(null);
      await window.evaApi.backup.restore(token, backupPath);
      setSuccess(t('backupRestoredSuccess'));
      setSuccess(t('backupRestoredSuccess'));
      // App will restart automatically from main process
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToRestoreBackup'));
      setRestoring(null);
    }
  };

  const handleDelete = async (backupPath: string, filename: string) => {
    if (!token || !window.evaApi) return;

    const confirmed = window.confirm(t('confirmDeleteBackup', { filename }));

    if (!confirmed) return;

    try {
      setDeleting(backupPath);
      setError(null);
      await window.evaApi.backup.delete(token, backupPath);
      setSuccess(t('backupDeletedSuccess'));
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToDeleteBackup'));
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!hasRole(['admin', 'manager'])) {
    return (
      <div className="Page Page--transparent BackupPage">
        <div className="BackupPage-error">{t('accessDeniedBackup')}</div>
      </div>
    );
  }

  return (
    <div className="Page Page--transparent BackupPage">
      <div className="BackupPage-header">
        <div>
          <h1>{t('backupAndRestore')}</h1>
          <p>{t('manageBackups')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {hasRole(['admin']) && (
            <button
              onClick={handleSelectAndRestore}
              disabled={!!restoring || loading}
              className="BackupPage-createButton"
              style={{ backgroundColor: '#27ae60' }}
            >
              {restoring ? t('restoring') : `📁 ${t('selectBackupFile')}`}
            </button>
          )}
          <button onClick={handleCreateBackup} disabled={creating || loading} className="BackupPage-createButton">
            {creating ? t('processing') : t('createBackupNow')}
          </button>
        </div>
      </div>

      {backupDir && (
        <div className="BackupPage-info">
          <strong>{t('backupDirectory')}:</strong> {backupDir}
        </div>
      )}

      {error && <div className="BackupPage-alert BackupPage-alert--error">{error}</div>}
      {success && <div className="BackupPage-alert BackupPage-alert--success">{success}</div>}

      <div className="BackupPage-note">
        <strong>{t('dailyBackupNote')}</strong>
      </div>

      {loading ? (
        <div className="BackupPage-empty">{t('loading')}</div>
      ) : backups.length === 0 ? (
        <div className="BackupPage-empty">{t('noBackupsFound')}</div>
      ) : (
        <div className="BackupPage-tableWrapper">
          <table className="BackupPage-table">
            <thead>
              <tr>
                <th>{t('filename')}</th>
                <th>{t('size')}</th>
                <th>{t('created')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.filepath}>
                  <td>
                    <code className="BackupPage-filename">{backup.filename}</code>
                  </td>
                  <td>{formatFileSize(backup.size)}</td>
                  <td>{new Date(backup.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="BackupPage-actions">
                      {hasRole(['admin']) && (
                        <button
                          onClick={() => handleRestore(backup.filepath, backup.filename)}
                          disabled={restoring === backup.filepath || deleting === backup.filepath}
                          className="BackupPage-actionButton BackupPage-actionButton--restore"
                        >
                          {restoring === backup.filepath ? t('restoring') : t('restore')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(backup.filepath, backup.filename)}
                        disabled={restoring === backup.filepath || deleting === backup.filepath}
                        className="BackupPage-actionButton BackupPage-actionButton--delete"
                      >
                        {deleting === backup.filepath ? t('deleting') : t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {restoring && (
        <div className="BackupPage-overlay">
          <div className="BackupPage-overlayContent">
            <div className="BackupPage-spinner"></div>
            <h2>{t('restoringDatabase')}</h2>
            <p>{t('pleaseWaitRestart')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPage;

