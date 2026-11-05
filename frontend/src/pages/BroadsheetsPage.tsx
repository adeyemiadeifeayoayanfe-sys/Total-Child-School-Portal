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
import { formatStudentName } from '../utils/studentName';
import { broadsheetDocument, openPrintableDocument } from '../utils/printDocuments';

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
  const [previewHtml, setPreviewHtml] = useState('');

  const role = activeRole || user?.role;
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const fetchBroadsheets = useCallback(async () => {
    setLoading(true);
    const result = await call('/broadsheets');
    if (result.success && result.data) {
      setBroadsheets(result.data as BroadsheetSubmission[]);
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

  const prepareBroadsheet = async (broadsheet: BroadsheetSubmission) => {
    const isPreview = broadsheet.id.startsWith('preview:');
    const query = new URLSearchParams({ class_id: broadsheet.class_id, subject_id: broadsheet.subject_id, session_id: broadsheet.session_id, term_id: broadsheet.term_id });
    const result = await call(isPreview ? `/broadsheets/preview?${query.toString()}` : `/broadsheets/${broadsheet.id}/print`);
    if (!result.success || !result.data) { showToast('error', result.error || 'Failed to prepare broadsheet'); return null; }
    const data: any = result.data;
    return broadsheetDocument(data);
  };

  const printBroadsheet = async (broadsheet: BroadsheetSubmission) => {
    const html = await prepareBroadsheet(broadsheet);
    if (html && !openPrintableDocument(html)) showToast('error', 'Please allow pop-ups to print the broadsheet');
  };

  const previewFullClassBroadsheet = async (broadsheet: BroadsheetSubmission) => {
    const query = new URLSearchParams({ class_id: broadsheet.class_id, session_id: broadsheet.session_id, term_id: broadsheet.term_id });
    const result = await call(`/broadsheets/full-preview?${query.toString()}`);
    if (!result.success || !result.data) { showToast('error', result.error || 'Failed to prepare the full class broadsheet'); return; }
    setPreviewHtml(broadsheetDocument(result.data));
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
          <Button variant="secondary" size="sm" onClick={() => previewFullClassBroadsheet(broadsheet)}>Full Class</Button>
          <Button variant="secondary" size="sm" onClick={async () => { const html = await prepareBroadsheet(broadsheet); if (html) setPreviewHtml(html); }}>Preview</Button>
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
      <Modal open={!!previewHtml} onClose={() => setPreviewHtml('')} title="Broadsheet Preview" size="lg" footer={<Button onClick={() => { if (!openPrintableDocument(previewHtml)) showToast('error', 'Please allow pop-ups to print the broadsheet'); }}>Print / Save as PDF</Button>}>
        <iframe title="Broadsheet document preview" className="h-[620px] w-full border-0" srcDoc={previewHtml} />
      </Modal>
    </div>
  );
}

