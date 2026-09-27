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
        <div>جاري التحميل...</div>
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
        <div dir="rtl" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          تم رفض الوصول. ليس لديك الصلاحية المطلوبة لعرض هذه الصفحة.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

