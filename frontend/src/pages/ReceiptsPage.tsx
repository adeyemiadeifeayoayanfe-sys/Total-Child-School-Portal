import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { Receipt } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import '../styles/receipt.css';

export default function ReceiptsPage() {
  const { call } = useApi();
  const { showToast } = useToast();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    receipt_number: '',
    purpose: '',
    receipt_date: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    const result = await call('/receipts');
    if (result.success && result.data) {
      setReceipts(result.data);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const openPreview = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowPreview(true);
  };

  const openEdit = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setEditForm({
      receipt_number: receipt.receipt_number,
      purpose: receipt.purpose,
      receipt_date: receipt.receipt_date,
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedReceipt) return;

    setSaving(true);
    const result = await call(`/receipts/${selectedReceipt.id}`, {
      method: 'PUT',
      body: editForm,
    });

    if (result.success) {
      showToast('success', 'Receipt updated successfully');
      setShowEditModal(false);
      fetchReceipts();
    } else {
      showToast('error', result.error || 'Failed to update receipt');
    }
    setSaving(false);
  };

  const handlePrint = async (receipt: Receipt) => {
    await call(`/receipts/${receipt.id}/print`, { method: 'POST' });

    setSelectedReceipt(receipt);
    setShowPreview(true);

    setTimeout(() => {
      window.print();
    }, 500);
  };

  const columns = [
    {
      key: 'receipt_number',
      header: 'Receipt No.',
      render: (receipt: Receipt) => (
        <span className="text-xs font-semibold">{receipt.receipt_number}</span>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      render: (receipt: Receipt) =>
        receipt.student ? `${receipt.student.first_name} ${receipt.student.last_name}` : '—',
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (receipt: Receipt) => receipt.purpose,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (receipt: Receipt) => (
        <span className="font-semibold">₦{receipt.amount.toLocaleString()}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (receipt: Receipt) => receipt.receipt_date,
    },
    {
      key: 'status',
      header: 'Status',
      render: (receipt: Receipt) => <StatusBadge status={receipt.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (receipt: Receipt) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => openPreview(receipt)}>
            Preview
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(receipt)}>
            Edit
          </Button>
          <Button variant="primary" size="sm" onClick={() => handlePrint(receipt)}>
            Print
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-description">Manage and print receipts</p>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={receipts}
          loading={loading}
          emptyMessage="No receipts found"
        />
      </Card>

      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Receipt Preview"
        size="sm"
      >
        {selectedReceipt && (
          <div className="receipt-preview">
            <div className="receipt-header">
              <h3>CEM Total Child School</h3>
              <p>Official Receipt</p>
            </div>
            <div className="receipt-body">
              <div className="receipt-row">
                <span>Receipt No:</span>
                <strong>{selectedReceipt.receipt_number}</strong>
              </div>
              <div className="receipt-row">
                <span>Date:</span>
                <strong>{selectedReceipt.receipt_date}</strong>
              </div>
              <div className="receipt-row">
                <span>Student:</span>
                <strong>
                  {selectedReceipt.student?.first_name} {selectedReceipt.student?.last_name}
                </strong>
              </div>
              <div className="receipt-row">
                <span>Purpose:</span>
                <strong>{selectedReceipt.purpose}</strong>
              </div>
              <div className="receipt-row receipt-total">
                <span>Amount:</span>
                <strong>₦{selectedReceipt.amount.toLocaleString()}</strong>
              </div>
            </div>
            <div className="receipt-footer">
              <p>Thank you for your payment</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Receipt"
        size="sm"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Receipt Number</label>
            <input
              className="form-input"
              value={editForm.receipt_number}
              onChange={(e) => setEditForm({ ...editForm, receipt_number: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Purpose</label>
            <input
              className="form-input"
              value={editForm.purpose}
              onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt Date</label>
            <input
              type="date"
              className="form-input"
              value={editForm.receipt_date}
              onChange={(e) => setEditForm({ ...editForm, receipt_date: e.target.value })}
            />
          </div>
          <Button variant="primary" onClick={handleEdit} loading={saving}>
            Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}