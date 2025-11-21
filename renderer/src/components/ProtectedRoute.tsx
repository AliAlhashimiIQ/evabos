import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: Array<'admin' | 'manager' | 'cashier'>;
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps): JSX.Element {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    // Redirect cashiers to POS if they try to access restricted pages
    if (user?.role === 'cashier') {
      return <Navigate to="/pos" replace />;
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Access denied. You do not have permission to view this page.</div>
      </div>
    );
  }

  return <>{children}</>;
}

