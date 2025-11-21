import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PosLockOverlay } from './components/PosLockOverlay';
import { BrowserWarning } from './components/BrowserWarning';
import { LicenseValidator } from './components/LicenseValidator';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';
import ProductsPage from './pages/ProductsPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import CustomersPage from './pages/CustomersPage';
import ReturnsPage from './pages/ReturnsPage';
import ExpensesPage from './pages/ExpensesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import BackupPage from './pages/BackupPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import BranchesPage from './pages/BranchesPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import './App.css';

function App(): JSX.Element {
  return (
    <LicenseValidator>
      <BrowserWarning />
      <PosLockOverlay />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Cashier-accessible routes */}
          <Route path="/pos" element={<PosPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/customers" element={<CustomersPage />} />

          {/* Admin/Manager-only routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <SalesHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales/:saleId"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <SalesHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <PurchaseOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/branches"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <BranchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity-logs"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <ActivityLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/backup"
            element={
              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                <BackupPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </LicenseValidator>
  );
}

export default App;

