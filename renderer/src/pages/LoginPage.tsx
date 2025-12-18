import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PasswordChangeModal } from '../components/PasswordChangeModal';
import './Pages.css';
import './LoginPage.css';

interface PendingLogin {
  token: string;
  username: string;
}

const LoginPage = (): JSX.Element => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !pendingLogin) {
      navigate('/pos', { replace: true });
    }
  }, [user, navigate, pendingLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Direct API call to check for requiresPasswordChange
      const response = await window.evaApi.auth.login(username, password);
      if (response) {
        if (response.requiresPasswordChange) {
          // User needs to change password - show modal
          setPendingLogin({ token: response.token, username: response.username });
        } else {
          // Normal login flow
          const success = await login(username, password);
          if (success) {
            navigate('/pos', { replace: true });
          } else {
            setError('Login failed');
          }
        }
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    // Password changed successfully, complete login
    setPendingLogin(null);
    const success = await login(username, password);
    if (success) {
      navigate('/pos', { replace: true });
    }
  };

  const handleLogout = async () => {
    if (pendingLogin) {
      // Logout the pending session
      try {
        await window.evaApi.auth.logout(pendingLogin.token);
      } catch {
        // Ignore errors
      }
    }
    setPendingLogin(null);
    setUsername('');
    setPassword('');
  };

  return (
    <div className="Page LoginPage">
      {pendingLogin && (
        <PasswordChangeModal
          token={pendingLogin.token}
          username={pendingLogin.username}
          onSuccess={handlePasswordChangeSuccess}
          onLogout={handleLogout}
        />
      )}
      <div className="LoginPage-container">
        <div className="LoginPage-header">
          <h1>EVA POS</h1>
          <p>Point of Sale System</p>
        </div>

        <form onSubmit={handleSubmit} className="LoginPage-form">
          {error && <div className="LoginPage-error">{error}</div>}

          <div className="LoginPage-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="LoginPage-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
              }}
            />
          </div>

          <button type="submit" className="LoginPage-button" disabled={loading || !username || !password}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="LoginPage-footer">
          <p>© 2024 EVA POS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

