import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { X, Plus, FileDown, ClipboardList, Trash2 } from 'lucide-react';
import './Pages.css';
import './ExpensesPage.css';
import NumberInput from '../components/NumberInput';
import { confirmDialog } from '../utils/confirmDialog';

type Expense = import('../types/electron').Expense;
type ExpenseInput = import('../types/electron').ExpenseInput;
type ExpenseSummary = import('../types/electron').ExpenseSummary;
type DateRange = import('../types/electron').DateRange;

const defaultForm: ExpenseInput = {
  branchId: 1,
  expenseDate: new Date().toISOString().slice(0, 10),
  amountIQD: 0,
  category: 'Other',
  note: '',
};

const ExpensesPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<ExpenseInput>(defaultForm);
  const defaultCategories: string[] = [];
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

  // Extract unique categories from expenses and combine with default categories
  const categories = useMemo(() => {
    const expenseCategories = new Set(expenses.map((exp) => exp.category));
    const allCategories = new Set([...defaultCategories, ...Array.from(expenseCategories)]);
    return Array.from(allCategories).sort();
  }, [expenses]);

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
      const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;
      const matchesDate =
        new Date(expense.expenseDate).getTime() >= new Date(range.startDate).getTime() &&
        new Date(expense.expenseDate).getTime() <= new Date(range.endDate).getTime();
      return matchesCategory && matchesDate;
    });
  }, [expenses, filterCategory, range]);

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
    // Confirmation dialog
    if (!confirmDialog(t('confirmDeleteExpense') || 'Are you sure you want to delete this expense?')) {
      return;
    }
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

  // Quick date filter handlers
  const handleQuickFilter = (filterType: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (filterType) {
      case 'today':
        // start and end are already today
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
        end.setDate(0); // Last day of previous month
        break;
    }

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
          <h1>{t('expenses')}</h1>
          <p>{t('trackOperatingCosts')}</p>
        </div>
        <div className="ExpensesPage-headerActions">
          <button className="ExpensesPage-addBtn" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <X size={18} /> : <Plus size={18} />} {showAddForm ? t('cancel') : t('addExpense')}
          </button>
          <button className="ExpensesPage-exportBtn" onClick={exportToCSV}>
            <FileDown size={18} /> {t('exportToCSV')}
          </button>
        </div>
      </div>

      {error && <div className="ExpensesPage-alert">{error}</div>}

      {/* Collapsible Add Expense Form */}
      {showAddForm && (
        <section className="ExpensesPage-formCard">
          <header>
            <h3><Plus size={20} /> {t('addExpense')}</h3>
          </header>
          <form onSubmit={handleSubmit}>
            <label>
              {t('dateExpense')}
              <input
                type="date"
                value={form.expenseDate?.slice(0, 10) ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, expenseDate: event.target.value }))}
                required
              />
            </label>
            <label>
              {t('category')}
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
              {t('amountIQD')}
              <NumberInput
                min="0"
                value={form.amountIQD}
                onChange={(event) => setForm((prev) => ({ ...prev, amountIQD: Number(event.target.value) || 0 }))}
                required
              />
            </label>
            <label className="ExpensesPage-span">
              {t('notes')}
              <textarea
                rows={2}
                value={form.note ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
            <div className="ExpensesPage-actions">
              <button type="button" className="ExpensesPage-cancelBtn" onClick={() => setShowAddForm(false)}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={submitting}>
                {submitting ? t('saving') : t('saveExpense')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Summary Card - Total Only */}
      <section className="ExpensesPage-summary">
        <div className="ExpensesPage-summaryMain">
          <span>{t('total')} ({range.startDate} → {range.endDate})</span>
          <strong>{summary.totalIQD.toLocaleString('en-IQ')} IQD</strong>
        </div>
      </section>

      {/* Quick Filters + Date Range */}
      <section className="ExpensesPage-filtersSection">
        <div className="ExpensesPage-quickFilters">
          <button type="button" onClick={() => handleQuickFilter('today')}>{t('today')}</button>
          <button type="button" onClick={() => handleQuickFilter('yesterday')}>{t('yesterday')}</button>
          <button type="button" onClick={() => handleQuickFilter('thisWeek')}>{t('last7Days')}</button>
          <button type="button" onClick={() => handleQuickFilter('thisMonth')}>{t('thisMonth')}</button>
          <button type="button" onClick={() => handleQuickFilter('lastMonth')}>{t('lastMonth')}</button>
        </div>
        <div className="ExpensesPage-filters">
          <label>
            {t('startDateExpense')}
            <input
              type="date"
              value={range.startDate}
              onChange={(event) => setRange((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </label>
          <label>
            {t('endDate')}
            <input
              type="date"
              value={range.endDate}
              onChange={(event) => setRange((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </label>
          <label>
            {t('category')}
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

      {/* Expenses List */}
      <section className="ExpensesPage-list">
        <header>
          <h3><ClipboardList size={20} /> {t('expenses')} ({filteredExpenses.length})</h3>
        </header>
        {loading ? (
          <div className="ExpensesPage-empty">{t('loadingExpenses')}</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="ExpensesPage-empty">{t('noExpensesInRange')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('dateExpense')}</th>
                <th>{t('category')}</th>
                <th>{t('amountIQD')}</th>
                <th>{t('notes')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{new Date(expense.expenseDate).toLocaleDateString()}</td>
                  <td>
                    <span className="ExpensesPage-categoryBadge">{expense.category}</span>
                  </td>
                  <td className="ExpensesPage-amount">{expense.amountIQD.toLocaleString('en-IQ')} IQD</td>
                  <td className="ExpensesPage-note">{expense.note ?? '—'}</td>
                  <td>
                    <button className="ExpensesPage-deleteBtn" onClick={() => handleDelete(expense.id)}>
                      <Trash2 size={16} /> {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default ExpensesPage;
