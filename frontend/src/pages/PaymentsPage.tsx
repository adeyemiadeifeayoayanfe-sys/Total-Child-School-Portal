import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { Payment, Student } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

export default function PaymentsPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    purpose: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isParent = user?.role === 'parent';

  const fetchPayments = useCallback(async () => {
    setLoading(true);

    if (isParent) {
      const childrenResult = await call('/parents/my/children');
      if (childrenResult.success && childrenResult.data) {
        const allPayments: Payment[] = [];
        for (const child of childrenResult.data) {
          const childPayments = await call(`/parents/my/children/${child.student.id}/payments`);
          if (childPayments.success && childPayments.data) {
            allPayments.push(...childPayments.data);
          }
        }
        setPayments(allPayments);
      }
    } else {
      const result = await call('/payments');
      if (result.success && result.data) {
        setPayments(result.data);
      }
    }
    setLoading(false);
  }, [call, isParent]);

  useEffect(() => {
    fetchPayments();
    if (isAdmin) {
      fetchStudents();
    }
  }, [fetchPayments, isAdmin]);

  const fetchStudents = async () => {
    const result = await call('/students?limit=100');
    if (result.success && result.data) {
      setStudents(result.data.data);
    }
  };

  const handleRecordPayment = async () => {
    if (!formData.student_id || !formData.amount || !formData.purpose) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await call('/payments', {
      method: 'POST',
      body: {
        student_id: formData.student_id,
        amount: Number(formData.amount),
        purpose: formData.purpose,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
      },
    });

    if (result.success) {
      showToast('success', 'Payment recorded successfully');
      setShowRecordModal(false);
      resetForm();
      fetchPayments();
    } else {
      showToast('error', result.error || 'Failed to record payment');
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setFormData({
      student_id: '',
      amount: '',
      purpose: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
    });
  };

  const columns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (payment: Payment) => (
        <span className="text-xs font-semibold">{payment.payment_reference}</span>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      render: (payment: Payment) =>
        payment.student ? `${payment.student.first_name} ${payment.student.last_name}` : '—',
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (payment: Payment) => payment.purpose,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment: Payment) => (
        <span className="font-semibold">₦{payment.amount.toLocaleString()}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (payment: Payment) => payment.payment_date,
    },
    {
      key: 'method',
      header: 'Method',
      render: (payment: Payment) => (
        <span className="capitalize">{payment.payment_method}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment: Payment) => <StatusBadge status={payment.status} />,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-description">
            {isParent ? "View your children's payment history" : 'Record and manage school payments'}
          </p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <Button variant="primary" onClick={() => { resetForm(); setShowRecordModal(true); }}>
              Record Payment
            </Button>
          </div>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          data={payments}
          loading={loading}
          emptyMessage="No payments found"
        />
      </Card>

      <Modal
        open={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title="Record Payment"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Student</label>
            <select
              className="form-select"
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
            >
              <option value="">Select student...</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ({student.admission_number})
                </option>
              ))}
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
              placeholder="e.g., 50000"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Purpose</label>
            <input
              className="form-input"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="e.g., School Fees"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select
                className="form-select"
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="pos">POS</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>
          <Button variant="primary" onClick={handleRecordPayment} loading={submitting}>
            Record Payment
          </Button>
        </div>
      </Modal>
    </div>
  );
}