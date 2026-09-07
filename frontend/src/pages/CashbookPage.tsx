import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { CashbookTransaction } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';

export default function CashbookPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<CashbookTransaction[]>([]);
  const [summary, setSummary] = useState({ total_credits: 0, total_debits: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    particulars: '',
    txn_type: 'credit',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });

  const fetchCashbook = useCallback(async () => {
    setLoading(true);
    const result = await call('/payments/cashbook');
    if (result.success && result.data) {
      setTransactions(result.data.transactions);
      setSummary(result.data.summary);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchCashbook();
  }, [fetchCashbook]);

  const handleManualTransaction = async () => {
    if (!formData.particulars.trim() || !formData.amount) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await call('/payments/cashbook/manual', {
      method: 'POST',
      body: {
        particulars: formData.particulars,
        txn_type: formData.txn_type,
        amount: Number(formData.amount),
        description: formData.description,
        transaction_date: formData.transaction_date,
      },
    });

    if (result.success) {
      showToast('success', 'Transaction added successfully');
      setShowManualModal(false);
      resetForm();
      fetchCashbook();
    } else {
      showToast('error', result.error || 'Failed to add transaction');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormData({
      particulars: '',
      txn_type: 'credit',
      amount: '',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
    });
  };

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (txn: CashbookTransaction) => txn.transaction_date,
    },
    {
      key: 'particulars',
      header: 'Particulars',
      render: (txn: CashbookTransaction) => (
        <span className="font-medium">{txn.particulars}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (txn: CashbookTransaction) => (
        <span
          className={`text-xs font-semibold uppercase ${
            txn.txn_type === 'credit' ? 'text-success' : 'text-error'
          }`}
        >
          {txn.txn_type}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (txn: CashbookTransaction) => (
        <span className={`font-semibold ${
          txn.txn_type === 'credit' ? 'text-success' : 'text-error'
        }`}>
          {txn.txn_type === 'credit' ? '+' : '-'}₦{txn.amount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (txn: CashbookTransaction) => (
        <span className="font-semibold">₦{txn.running_balance.toLocaleString()}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (txn: CashbookTransaction) => txn.description || '—',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cashbook</h1>
          <p className="page-description">Financial ledger for all transactions</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => { resetForm(); setShowManualModal(true); }}>
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="dashboard-grid mb-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">CR</div>
          <div className="stat-content">
            <h3>₦{summary.total_credits.toLocaleString()}</h3>
            <p>Total Credits</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-red">DB</div>
          <div className="stat-content">
            <h3>₦{summary.total_debits.toLocaleString()}</h3>
            <p>Total Debits</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">BL</div>
          <div className="stat-content">
            <h3 className={summary.balance >= 0 ? 'text-success' : 'text-error'}>
              ₦{summary.balance.toLocaleString()}
            </h3>
            <p>Current Balance</p>
          </div>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={transactions}
          loading={loading}
          emptyMessage="No cashbook transactions found"
        />
      </Card>

      <Modal
        open={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Add Manual Transaction"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Particulars</label>
            <input
              className="form-input"
              value={formData.particulars}
              onChange={(e) => setFormData({ ...formData, particulars: e.target.value })}
              placeholder="e.g., Stationery Purchase"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={formData.txn_type}
                onChange={(e) => setFormData({ ...formData, txn_type: e.target.value })}
              >
                <option value="credit">Credit (Income)</option>
                <option value="debit">Debit (Expenditure)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₦)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes about this transaction"
            />
          </div>
          <Button variant="primary" onClick={handleManualTransaction} loading={submitting}>
            Add Transaction
          </Button>
        </div>
      </Modal>
    </div>
  );
}