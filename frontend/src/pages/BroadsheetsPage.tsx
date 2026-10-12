import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { BroadsheetSubmission } from '../types';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';

export default function BroadsheetsPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const { user, activeRole } = useAuth();

  const [broadsheets, setBroadsheets] = useState<BroadsheetSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedBroadsheet, setSelectedBroadsheet] = useState<BroadsheetSubmission | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const role = activeRole || user?.role;
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const fetchBroadsheets = useCallback(async () => {
    setLoading(true);
    const result = await call('/broadsheets');
    if (result.success && result.data) {
      setBroadsheets(result.data);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchBroadsheets();
  }, [fetchBroadsheets]);

  const handleSubmitBroadsheet = async (broadsheet: BroadsheetSubmission) => {
    const result = await call('/broadsheets/submit', {
      method: 'POST',
      body: {
        class_id: broadsheet.class_id,
        subject_id: broadsheet.subject_id,
        session_id: broadsheet.session_id,
        term_id: broadsheet.term_id,
      },
    });

    if (result.success) {
      showToast('success', 'Broadsheet submitted successfully');
      fetchBroadsheets();
    } else {
      showToast('error', result.error || 'Failed to submit broadsheet');
    }
  };

  const handleApproveBroadsheet = async (broadsheet: BroadsheetSubmission) => {
    const result = await call(`/broadsheets/${broadsheet.id}/approve`, {
      method: 'POST',
    });

    if (result.success) {
      showToast('success', 'Broadsheet approved successfully');
      fetchBroadsheets();
    } else {
      showToast('error', result.error || 'Failed to approve broadsheet');
    }
  };

  const handleReturnBroadsheet = async () => {
    if (!selectedBroadsheet || !returnReason.trim()) {
      showToast('error', 'Please provide a reason for returning');
      return;
    }

    setSubmitting(true);
    const result = await call(`/broadsheets/${selectedBroadsheet.id}/return`, {
      method: 'POST',
      body: { return_reason: returnReason },
    });

    if (result.success) {
      showToast('success', 'Broadsheet returned to teacher');
      setShowReturnModal(false);
      setReturnReason('');
      fetchBroadsheets();
    } else {
      showToast('error', result.error || 'Failed to return broadsheet');
    }
    setSubmitting(false);
  };

  const printBroadsheet = async (broadsheet: BroadsheetSubmission) => {
    const result = await call(`/broadsheets/${broadsheet.id}/print`);
    if (!result.success || !result.data) { showToast('error', result.error || 'Failed to prepare broadsheet'); return; }
    const data: any = result.data;
    const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = (data.students || []).map((item: any, index: number) => `<tr><td>${index + 1}</td><td>${esc(`${item.student?.last_name || ''} ${item.student?.first_name || ''}`.trim())}</td><td>${esc(item.student?.admission_number || '-')}</td><td>${item.score ? esc(item.score.test1) : '-'}</td><td>${item.score ? esc(item.score.test2) : '-'}</td><td>${item.score ? esc(item.score.test3) : '-'}</td><td>${item.score ? esc(item.score.examination) : '-'}</td><td>${item.score ? `<strong>${esc(item.score.total)}</strong>` : '-'}</td></tr>`).join('');
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) { showToast('error', 'Please allow pop-ups to print the broadsheet'); return; }
    printWindow.document.write(`<!doctype html><html><head><title>Broadsheet</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111827;font-size:10px}.header{text-align:center;border-bottom:2px solid #1d4ed8;margin-bottom:10px;padding-bottom:8px}h1{margin:0;color:#1d4ed8;font-size:20px}.context{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:10px 0}.context div{border:1px solid #cbd5e1;padding:5px}.label{font-size:8px;color:#64748b;text-transform:uppercase}table{width:100%;border-collapse:collapse}thead{display:table-header-group}th,td{border:1px solid #94a3b8;padding:5px;text-align:center}th{background:#dbeafe;font-weight:700}td:nth-child(2){text-align:left}tr{break-inside:avoid}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><h1>CEM Total Child School</h1><strong>CLASS BROADSHEET</strong></div><div class="context"><div><span class="label">Class</span><br>${esc(data.class?.name)}</div><div><span class="label">Subject</span><br>${esc(data.subject?.name)}</div><div><span class="label">Session / Term</span><br>${esc(data.session?.name)} / ${esc(data.term?.name)}</div><div><span class="label">Assessment Stage</span><br>${esc(data.term?.assessment_stage || '-')}</div></div><table><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th>Test 1 /20</th><th>Test 2 /20</th><th>Test 3 /20</th><th>Exam /40</th><th>Total /100</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close(); printWindow.focus(); setTimeout(() => printWindow.print(), 300);
  };

  const columns = [
    {
      key: 'class',
      header: 'Class',
      render: (broadsheet: BroadsheetSubmission) => (
        <span className="font-medium">{broadsheet.class?.name || '—'}</span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (broadsheet: BroadsheetSubmission) => broadsheet.subject?.name || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (broadsheet: BroadsheetSubmission) => <StatusBadge status={broadsheet.status} />,
    },
    {
      key: 'submitted_at',
      header: 'Submitted At',
      render: (broadsheet: BroadsheetSubmission) =>
        broadsheet.submitted_at ? new Date(broadsheet.submitted_at).toLocaleString() : '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (broadsheet: BroadsheetSubmission) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => printBroadsheet(broadsheet)}>Print</Button>
          {isTeacher && (broadsheet.status === 'draft' || broadsheet.status === 'returned') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmitBroadsheet(broadsheet)}
            >
              {broadsheet.status === 'returned' ? 'Resubmit' : 'Submit'}
            </Button>
          )}
          {isAdmin && broadsheet.status === 'submitted' && (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleApproveBroadsheet(broadsheet)}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedBroadsheet(broadsheet);
                  setShowReturnModal(true);
                }}
              >
                Return
              </Button>
            </>
          )}
          {isAdmin && broadsheet.status === 'approved' && (
            <span className="text-xs text-gray-500">Approved</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Broadsheets</h1>
          <p className="page-description">Broadsheet submission and approval workflow</p>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          data={broadsheets}
          loading={loading}
          emptyMessage="No broadsheets found"
        />
      </Card>

      <Modal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Return Broadsheet"
        size="sm"
      >
        <div className="grid gap-4">
          <div className="form-group">
            <label className="form-label">Reason for Return</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Explain why this broadsheet is being returned..."
            />
            <p className="form-hint">This reason will be visible to the teacher.</p>
          </div>
          <Button variant="danger" onClick={handleReturnBroadsheet} loading={submitting}>
            Return Broadsheet
          </Button>
        </div>
      </Modal>
    </div>
  );
}

