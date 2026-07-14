import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { X, Plus, FileDown, ClipboardList, Trash2, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import './Pages.css';
import './ExpensesPage.css';
import NumberInput from '../components/NumberInput';
import { confirmDialog } from '../utils/confirmDialog';
import { SkeletonTable } from '../components/Skeleton';

type Expense = import('../types/electron').Expense;
type ExpenseInput = import('../types/electron').ExpenseInput;
type ExpenseSummary = import('../types/electron').ExpenseSummary;
type DateRange = import('../types/electron').DateRange;

const defaultForm: ExpenseInput = {
  branchId: 1,
  expenseDate: new Date().toISOString().slice(0, 10),
  amountIQD: 0,
  category: '', // Default to empty string instead of 'Other'
  note: '',
};

const ExpensesPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<ExpenseInput>(defaultForm);
  
  // Dynamic currency symbol based on layout direction
  const currencySymbol = useMemo(() => {
    return document.documentElement.dir === 'rtl' ? 'د.ع' : 'IQD';
  }, []);

  // Translated default categories
  const defaultCategories = useMemo(() => {
    return document.documentElement.dir === 'rtl'
      ? ['إيجار', 'رواتب', 'مصاريف المحل', 'تسويق', 'بضاعة', 'أخرى']
      : ['Rent', 'Salaries', 'Utilities', 'Marketing', 'Inventory', 'Other'];
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [range, setRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });
  const [summary, setSummary] = useState<ExpenseSummary>({ totalIQD: 0, categories: [] });
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('thisWeek');

  // Extract unique categories from expenses and combine with default categories
  const categories = useMemo(() => {
    const expenseCategories = new Set(expenses.map((exp) => exp.category).filter(Boolean));
    const allCategories = new Set([...defaultCategories, ...Array.from(expenseCategories)]);
    return Array.from(allCategories).sort();
  }, [expenses, defaultCategories]);

  const loadExpenses = async () => {
    if (!window.evaApi || !token) return;
    try {
      setLoading(true);
      setError(null);
      const [listResponse, summaryResponse] = await Promise.all([
        window.evaApi.expenses.list(token),
        window.evaApi.expenses.summary(token, range),
      ]);
      setExpenses(listResponse);
      setSummary(summaryResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadExpenses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadExpenses();
    }
  }, [range, token]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      return filterCategory === 'all' || expense.category === filterCategory;
    });
  }, [expenses, filterCategory]);

  const topCategory = useMemo(() => {
    if (!summary.categories || summary.categories.length === 0) return null;
    return [...summary.categories].sort((a, b) => b.amountIQD - a.amountIQD)[0];
  }, [summary.categories]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.evaApi || !token) return;
    try {
      setSubmitting(true);
      await window.evaApi.expenses.create(token, {
        ...form,
        expenseDate: new Date(form.expenseDate ?? new Date().toISOString()).toISOString(),
      });
      setForm(defaultForm);
      setShowAddForm(false);
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSaveExpense'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expenseId: number) => {
    if (!window.evaApi || !token) return;
    const ok = await confirmDialog({ message: t('confirmDeleteExpense') || 'Are you sure you want to delete this expense?', variant: 'danger', confirmText: t('delete') });
    if (!ok) return;
    try {
      await window.evaApi.expenses.delete(token, expenseId);
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToDeleteExpense'));
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Amount IQD', 'Note'];
    const rows = filteredExpenses.map((expense) => [
      new Date(expense.expenseDate).toLocaleDateString(),
      expense.category,
      expense.amountIQD.toString(),
      expense.note ?? '',
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${range.startDate}_${range.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleQuickFilter = (filterType: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'allTime') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (filterType) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        break;
      case 'thisWeek':
        start.setDate(now.getDate() - 6);
        break;
      case 'thisMonth':
        start.setDate(1);
        break;
      case 'lastMonth':
        start.setMonth(now.getMonth() - 1);
        start.setDate(1);
        end.setDate(0);
        break;
      case 'allTime':
        start = new Date(2000, 0, 1);
        break;
    }

    setActiveQuickFilter(filterType);
    setRange({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="Page Page--transparent ExpensesPage">
      {/* Header with Title and Actions */}
      <div className="ExpensesPage-header">
        <div>
          <h1>{t('expenses') || 'Expenses'}</h1>
          <p>{t('trackOperatingCosts') || 'Track operational costs and overall business profitability.'}</p>
        </div>
        <div className="ExpensesPage-headerActions">
          <button className="ExpensesPage-addBtn" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <X size={16} /> : <Plus size={16} />} 
            <span>{showAddForm ? t('cancel') : t('addExpense')}</span>
          </button>
          <button className="ExpensesPage-exportBtn" onClick={exportToCSV}>
            <FileDown size={16} /> 
            <span>{t('exportToCSV')}</span>
          </button>
        </div>
      </div>

      {error && <div className="ExpensesPage-alert">{error}</div>}

      {/* Collapsible Add Expense Form */}
      {showAddForm && (
        <section className="ExpensesPage-formCard">
          <header>
            <h3><Plus size={18} /> {t('addExpense')}</h3>
          </header>
          <form onSubmit={handleSubmit}>
            <label>
              <span>{t('dateExpense')}</span>
              <input
                type="date"
                value={form.expenseDate?.slice(0, 10) ?? ''}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, expenseDate: event.target.value }));
                }}
                required
              />
            </label>
            <label>
              <span>{t('category')}</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  list="expense-categories"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder={t('selectOrTypeCategory')}
                  required
                  style={{ width: '100%' }}
                />
                <datalist id="expense-categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </label>
            <label>
              <span>{t('amountIQD')}</span>
              <NumberInput
                min="0"
                value={form.amountIQD}
                onChange={(event) => setForm((prev) => ({ ...prev, amountIQD: Number(event.target.value) || 0 }))}
                required
              />
            </label>
            <label className="ExpensesPage-span">
              <span>{t('notes')}</span>
              <textarea
                rows={2}
                value={form.note ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={t('writeNotes') || 'Write expense notes...'}
              />
            </label>
            <div className="ExpensesPage-actions">
              <button type="button" className="ExpensesPage-cancelBtn" onClick={() => setShowAddForm(false)}>
                {t('cancel')}
              </button>
              <button type="submit" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', borderRadius: '0.65rem', padding: '0.6rem 1.4rem', fontWeight: 600, cursor: 'pointer' }} disabled={submitting}>
                {submitting ? t('saving') : t('saveExpense')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Summary KPI Dashboard Panel */}
      <section className="ExpensesPage-summary">
        <div className="ExpensesPage-summaryCard ExpensesPage-summaryCard--spent">
          <div className="ExpensesPage-summaryCard-label">
            <DollarSign size={16} />
            <span>{t('totalExpenses') || 'Total Expenses'}</span>
          </div>
          <strong>{summary.totalIQD.toLocaleString('en-IQ')} {currencySymbol}</strong>
        </div>

        <div className="ExpensesPage-summaryCard ExpensesPage-summaryCard--count">
          <div className="ExpensesPage-summaryCard-label">
            <Calendar size={16} />
            <span>{t('transactionsCount') || 'Transactions'}</span>
          </div>
          <strong>{filteredExpenses.length}</strong>
        </div>

        <div className="ExpensesPage-summaryCard ExpensesPage-summaryCard--top">
          <div className="ExpensesPage-summaryCard-label">
            <TrendingUp size={16} />
            <span>{t('topCategory')}</span>
          </div>
          {topCategory ? (
            <div className="ExpensesPage-summaryCard-valueGroup">
              <span className="ExpensesPage-summaryCard-categoryName" title={topCategory.category}>
                {topCategory.category}
              </span>
              <strong className="ExpensesPage-summaryCard-categoryAmount">
                {topCategory.amountIQD.toLocaleString('en-IQ')} {currencySymbol}
              </strong>
            </div>
          ) : (
            <strong className="ExpensesPage-summaryCard-categoryName">—</strong>
          )}
        </div>
      </section>

      {/* Quick Filters + Date Range Selector */}
      <section className="ExpensesPage-filtersSection">
        <div className="ExpensesPage-quickFilters">
          <button 
            type="button" 
            className={activeQuickFilter === 'today' ? 'active' : ''} 
            onClick={() => handleQuickFilter('today')}
          >
            {t('today')}
          </button>
          <button 
            type="button" 
            className={activeQuickFilter === 'yesterday' ? 'active' : ''} 
            onClick={() => handleQuickFilter('yesterday')}
          >
            {t('yesterday')}
          </button>
          <button 
            type="button" 
            className={activeQuickFilter === 'thisWeek' ? 'active' : ''} 
            onClick={() => handleQuickFilter('thisWeek')}
          >
            {t('last7Days')}
          </button>
          <button 
            type="button" 
            className={activeQuickFilter === 'thisMonth' ? 'active' : ''} 
            onClick={() => handleQuickFilter('thisMonth')}
          >
            {t('thisMonth')}
          </button>
          <button 
            type="button" 
            className={activeQuickFilter === 'lastMonth' ? 'active' : ''} 
            onClick={() => handleQuickFilter('lastMonth')}
          >
            {t('lastMonth')}
          </button>
          <button 
            type="button" 
            className={activeQuickFilter === 'allTime' ? 'active' : ''} 
            onClick={() => handleQuickFilter('allTime')}
          >
            {t('allTime')}
          </button>
        </div>
        
        <div className="ExpensesPage-filters">
          <label>
            <span>{t('startDateExpense')}</span>
            <input
              type="date"
              value={range.startDate}
              onChange={(event) => {
                setActiveQuickFilter('custom');
                setRange((prev) => ({ ...prev, startDate: event.target.value }));
              }}
            />
          </label>
          <label>
            <span>{t('endDate')}</span>
            <input
              type="date"
              value={range.endDate}
              onChange={(event) => {
                setActiveQuickFilter('custom');
                setRange((prev) => ({ ...prev, endDate: event.target.value }));
              }}
            />
          </label>
          <label>
            <span>{t('category')}</span>
            <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
              <option value="all">{t('all')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Expenses Table list */}
      <section className="ExpensesPage-list">
        <header>
          <h3><ClipboardList size={18} /> {t('expenses') || 'Expenses'} ({filteredExpenses.length})</h3>
        </header>
        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : filteredExpenses.length === 0 ? (
          <div className="ExpensesPage-empty">{t('noExpensesInRange')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>{t('dateExpense')}</th>
                  <th style={{ width: '22%' }}>{t('category')}</th>
                  <th style={{ width: '22%' }}>{t('amountIQD')}</th>
                  <th style={{ width: '30%' }}>{t('notes')}</th>
                  <th style={{ width: '8%', textAlign: 'center' }} />
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{new Date(expense.expenseDate).toLocaleDateString()}</td>
                    <td>
                      <span className="ExpensesPage-categoryBadge">{expense.category}</span>
                    </td>
                    <td className="ExpensesPage-amount">{expense.amountIQD.toLocaleString('en-IQ')} {currencySymbol}</td>
                    <td className="ExpensesPage-note" title={expense.note ?? ''}>{expense.note ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="ExpensesPage-deleteBtn" 
                        onClick={() => handleDelete(expense.id)}
                        title={t('delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExpensesPage;
