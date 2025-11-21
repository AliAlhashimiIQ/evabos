import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Pages.css';
import './BackupPage.css';

type BackupInfo = import('../types/electron').BackupInfo;

const BackupPage = (): JSX.Element => {
  const { token, hasRole } = useAuth();
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
      setError('Desktop bridge unavailable.');
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
      setError(err instanceof Error ? err.message : 'Failed to load backups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasRole(['admin', 'manager'])) {
      loadBackups();
    } else {
      setError('Access denied. Only admin or manager can manage backups.');
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
      setSuccess(`Backup created successfully: ${backup.filename}`);
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup.');
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
        `Are you sure you want to restore from "${filename}"?\n\nThis will replace your current database. The app will restart after restoration.`,
      );

      if (!confirmed) return;

      setRestoring(selectedPath);
      setError(null);
      setSuccess(null);
      await window.evaApi.backup.restore(token, selectedPath);
      setSuccess('Backup restored successfully. The app will restart...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup.');
      setRestoring(null);
    }
  };

  const handleRestore = async (backupPath: string, filename: string) => {
    if (!token || !window.evaApi) return;

    const confirmed = window.confirm(
      `Are you sure you want to restore from "${filename}"?\n\nThis will replace your current database. The app will restart after restoration.`,
    );

    if (!confirmed) return;

    try {
      setRestoring(backupPath);
      setError(null);
      setSuccess(null);
      await window.evaApi.backup.restore(token, backupPath);
      setSuccess('Backup restored successfully. The app will restart...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup.');
      setRestoring(null);
    }
  };

  const handleDelete = async (backupPath: string, filename: string) => {
    if (!token || !window.evaApi) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${filename}"?`);

    if (!confirmed) return;

    try {
      setDeleting(backupPath);
      setError(null);
      await window.evaApi.backup.delete(token, backupPath);
      setSuccess('Backup deleted successfully.');
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup.');
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
        <div className="BackupPage-error">Access denied. Only admin or manager can manage backups.</div>
      </div>
    );
  }

  return (
    <div className="Page Page--transparent BackupPage">
      <div className="BackupPage-header">
        <div>
          <h1>Backup & Restore</h1>
          <p>Manage database backups and restore from previous versions.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {hasRole(['admin']) && (
            <button 
              onClick={handleSelectAndRestore} 
              disabled={restoring || loading} 
              className="BackupPage-createButton"
              style={{ backgroundColor: '#27ae60' }}
            >
              {restoring ? 'Restoring...' : '📁 Select Backup File'}
            </button>
          )}
          <button onClick={handleCreateBackup} disabled={creating || loading} className="BackupPage-createButton">
            {creating ? 'Creating...' : 'Create Backup Now'}
          </button>
        </div>
      </div>

      {backupDir && (
        <div className="BackupPage-info">
          <strong>Backup Directory:</strong> {backupDir}
        </div>
      )}

      {error && <div className="BackupPage-alert BackupPage-alert--error">{error}</div>}
      {success && <div className="BackupPage-alert BackupPage-alert--success">{success}</div>}

      <div className="BackupPage-note">
        <strong>Note:</strong> Daily automatic backups run every 24 hours. Manual backups can be created at any time.
        Only admins can restore backups.
      </div>

      {loading ? (
        <div className="BackupPage-empty">Loading backups...</div>
      ) : backups.length === 0 ? (
        <div className="BackupPage-empty">No backups found. Create your first backup above.</div>
      ) : (
        <div className="BackupPage-tableWrapper">
          <table className="BackupPage-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Size</th>
                <th>Created</th>
                <th>Actions</th>
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
                          {restoring === backup.filepath ? 'Restoring...' : 'Restore'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(backup.filepath, backup.filename)}
                        disabled={restoring === backup.filepath || deleting === backup.filepath}
                        className="BackupPage-actionButton BackupPage-actionButton--delete"
                      >
                        {deleting === backup.filepath ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BackupPage;

