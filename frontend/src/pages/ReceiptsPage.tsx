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
  const [printing, setPrinting] = useState(false);
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
    } else {
      showToast('error', result.error || 'Failed to fetch receipts');
    }
    setLoading(false);
  }, [call, showToast]);
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
      await fetchReceipts();
    } else {
      showToast('error', result.error || 'Failed to update receipt');
    }
    setSaving(false);
  };
  const getStudentName = (receipt: Receipt) => {
    if (!receipt.student) return '-';
    return `${receipt.student.first_name} ${receipt.student.last_name}`;
  };
  const createReceiptMarkup = (receipt: Receipt) => {
    const studentName = getStudentName(receipt);
    return `
      <article class="print-receipt">
        <div class="print-receipt-header">
          <div>
            <h1>CEM Total Child School</h1>
            <p>Official Payment Receipt</p>
          </div>
          <div class="print-receipt-badge">RECEIPT</div>
        </div>
        <div class="print-receipt-number">
          <span>Receipt No.</span>
          <strong>${receipt.receipt_number}</strong>
        </div>
        <div class="print-receipt-grid">
          <div class="print-field">
            <span>Date</span>
            <strong>${receipt.receipt_date}</strong>
          </div>
          <div class="print-field">
            <span>Student</span>
            <strong>${studentName}</strong>
          </div>
          <div class="print-field print-field-wide">
            <span>Purpose</span>
            <strong>${receipt.purpose}</strong>
          </div>
          <div class="print-field print-amount">
            <span>Amount Paid</span>
            <strong>₦${Number(receipt.amount).toLocaleString()}</strong>
          </div>
        </div>
        <div class="print-receipt-footer">
          <span>Thank you for your payment.</span>
          <span>CEM Total Child School</span>
        </div>
      </article>
    `;
  };
  const printReceipts = async (queue: Receipt[]) => {
    if (!queue.length || printing) return;
    setPrinting(true);
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      showToast(
        'error',
        'The print window was blocked. Please allow pop-ups for this site.'
      );
      setPrinting(false);
      return;
    }
    const receiptMarkup = queue.map(createReceiptMarkup).join('');
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>CEM Total Child School - Receipt Queue</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            html,
            body {
              margin: 0;
              padding: 0;
              width: 210mm;
              min-height: 297mm;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
            }
            body {
              display: block;
            }
            .print-page {
              width: 210mm;
              height: 297mm;
              padding: 8mm;
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: 1fr 1fr;
              gap: 4mm;
              page-break-after: always;
              break-after: page;
            }
            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .print-receipt {
              width: 100%;
              height: 100%;
              min-width: 0;
              min-height: 0;
              border: 1.2px solid #1d4ed8;
              border-radius: 2mm;
              padding: 5mm;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              position: relative;
              background: #ffffff;
            }
            .print-receipt::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 2mm;
              background: #dc2626;
            }
            .print-receipt-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 3mm;
              padding-top: 1mm;
              padding-bottom: 3mm;
              border-bottom: 0.4mm solid #dbe3ef;
            }
            .print-receipt-header h1 {
              margin: 0;
              color: #1d4ed8;
              font-size: 13pt;
              line-height: 1.1;
            }
            .print-receipt-header p {
              margin: 1.5mm 0 0;
              color: #6b7280;
              font-size: 7.5pt;
            }
            .print-receipt-badge {
              border: 0.4mm solid #dc2626;
              color: #dc2626;
              padding: 1.2mm 2mm;
              border-radius: 1mm;
              font-size: 7pt;
              font-weight: 800;
              letter-spacing: 0.08em;
              white-space: nowrap;
            }
            .print-receipt-number {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 3mm;
              padding: 3mm 0;
              border-bottom: 0.4mm solid #dbe3ef;
            }
            .print-receipt-number span,
            .print-field span {
              color: #6b7280;
              font-size: 7pt;
            }
            .print-receipt-number strong {
              color: #111827;
              font-size: 8pt;
            }
            .print-receipt-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2.5mm;
              padding: 3mm 0;
              flex: 1;
              align-content: start;
            }
            .print-field {
              min-width: 0;
              border: 0.3mm solid #e5e7eb;
              border-radius: 1mm;
              padding: 2.2mm;
              display: flex;
              flex-direction: column;
              gap: 1mm;
            }
            .print-field strong {
              color: #111827;
              font-size: 8pt;
              line-height: 1.25;
              overflow-wrap: anywhere;
            }
            .print-field-wide {
              grid-column: 1 / -1;
            }
            .print-amount {
              grid-column: 1 / -1;
              border: 0.5mm solid #1d4ed8;
              background: #f8fafc;
            }
            .print-amount strong {
              color: #1d4ed8;
              font-size: 14pt;
            }
            .print-receipt-footer {
              display: flex;
              justify-content: space-between;
              gap: 3mm;
              padding-top: 3mm;
              border-top: 0.4mm solid #dbe3ef;
              color: #6b7280;
              font-size: 6.5pt;
            }
            @media print {
              html,
              body {
                width: 210mm;
                height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div id="receipt-pages"></div>
          <script>
            const receipts = ${JSON.stringify(receiptMarkup)};
            const wrapper = document.getElementById('receipt-pages');
            const temp = document.createElement('div');
            temp.innerHTML = receipts;
            const receiptNodes = Array.from(temp.children);
            for (let index = 0; index < receiptNodes.length; index += 4) {
              const page = document.createElement('section');
              page.className = 'print-page';
              receiptNodes.slice(index, index + 4).forEach((receipt) => {
                page.appendChild(receipt);
              });
              wrapper.appendChild(page);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    const markPrinted = async () => {
      for (const receipt of queue) {
        await call(`/receipts/${receipt.id}/print`, {
          method: 'POST',
        });
      }
      await fetchReceipts();
      setPrinting(false);
    };
    printWindow.addEventListener('afterprint', () => {
      void markPrinted();
    });
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };
  const handlePrintQueue = async () => {
    const result = await call('/receipts/queue');
    if (!result.success || !result.data) {
      showToast(
        'error',
        result.error || 'Failed to load the receipt queue'
      );
      return;
    }
    const queue = result.data as Receipt[];
    if (!queue.length) {
      showToast('info', 'There are no pending receipts to print');
      return;
    }
    await printReceipts(queue);
  };
  const handlePrintSingle = async (receipt: Receipt) => {
    await printReceipts([receipt]);
  };
  const columns = [
    {
      key: 'receipt_number',
      header: 'Receipt No.',
      render: (receipt: Receipt) => (
        <span className="text-xs font-semibold">
          {receipt.receipt_number}
        </span>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      render: (receipt: Receipt) => getStudentName(receipt),
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
        <span className="font-semibold">
          ₦{Number(receipt.amount).toLocaleString()}
        </span>
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
      render: (receipt: Receipt) => (
        <StatusBadge status={receipt.status} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (receipt: Receipt) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPreview(receipt)}
          >
            Preview
          </Button>
          {receipt.status !== 'printed' &&
            receipt.status !== 'voided' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(receipt)}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handlePrintSingle(receipt)}
                  loading={printing}
                >
                  Print
                </Button>
              </>
            )}
        </div>
      ),
    },
  ];
  return (
    <div className="receipts-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-description">
            Manage, edit and print payment receipts
          </p>
        </div>
        <div className="receipt-page-actions">
          <Button
            variant="primary"
            onClick={handlePrintQueue}
            loading={printing}
          >
            Print Queue
          </Button>
        </div>
      </div>
      <Card>
        <div className="receipt-queue-info">
          <div>
            <strong>
              {receipts.filter(
                (receipt) => receipt.status === 'pending'
              ).length}
            </strong>
            <span>Pending receipts</span>
          </div>
          <div>
            <strong>
              {receipts.filter(
                (receipt) => receipt.status === 'printed'
              ).length}
            </strong>
            <span>Printed receipts</span>
          </div>
          <div>
            <strong>{receipts.length}</strong>
            <span>Total receipts</span>
          </div>
        </div>
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
              <div>
                <h3>CEM Total Child School</h3>
                <p>Official Receipt</p>
              </div>
              <span className="receipt-preview-badge">RECEIPT</span>
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
                <strong>{getStudentName(selectedReceipt)}</strong>
              </div>
              <div className="receipt-row">
                <span>Purpose:</span>
                <strong>{selectedReceipt.purpose}</strong>
              </div>
              <div className="receipt-row receipt-total">
                <span>Amount:</span>
                <strong>
                  ₦{Number(selectedReceipt.amount).toLocaleString()}
                </strong>
              </div>
            </div>
            <div className="receipt-footer">
              <p>Thank you for your payment</p>
              <p>CEM Total Child School</p>
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
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  receipt_number: e.target.value,
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Purpose</label>
            <input
              className="form-input"
              value={editForm.purpose}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  purpose: e.target.value,
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt Date</label>
            <input
              type="date"
              className="form-input"
              value={editForm.receipt_date}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  receipt_date: e.target.value,
                })
              }
            />
          </div>
          <Button
            variant="primary"
            onClick={handleEdit}
            loading={saving}
          >
            Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
