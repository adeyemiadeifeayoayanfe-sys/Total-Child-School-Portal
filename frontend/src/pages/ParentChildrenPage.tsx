import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
type Child = {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string;
  current_class?: {
    id: string;
    name: string;
  } | null;
};
type ResultSubject = {
  id: string;
  subject_id: string;
  total: number;
  percentage: number;
  grade: string | null;
  subject?: {
    name: string;
  };
};
type Result = {
  id: string;
  term_average: number | null;
  term_position: number | null;
  cumulative_average: number | null;
  status: string;
  term?: {
    name: string;
  };
  session?: {
    name: string;
  };
  result_subjects?: ResultSubject[];
};
type Attendance = {
  id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks: string | null;
};
type Payment = {
  id: string;
  payment_reference: string;
  amount: number;
  purpose: string;
  payment_date: string;
  payment_method: string;
  status: string;
  receipt?: {
    receipt_number: string;
    status: string;
  } | null;
};
export default function ParentChildrenPage() {
  const { call } = useApi();
  const { showToast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'attendance' | 'payments'>('overview');
  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId]
  );
  const fetchChildren = useCallback(async () => {
    setLoading(true);
    const result = await call('/parents/my/children');
    if (result.success && result.data) {
      const loadedChildren = result.data as Child[];
      setChildren(loadedChildren);
      if (loadedChildren.length > 0) {
        setSelectedChildId((current) =>
          current && loadedChildren.some((child) => child.id === current)
            ? current
            : loadedChildren[0].id
        );
      }
    } else {
      showToast('error', result.error || 'Failed to load children');
    }
    setLoading(false);
  }, [call, showToast]);
  const fetchChildDetails = useCallback(async () => {
    if (!selectedChildId) {
      setResults([]);
      setAttendance([]);
      setPayments([]);
      return;
    }
    setDetailsLoading(true);
    const [resultsResponse, attendanceResponse, paymentsResponse] =
      await Promise.all([
        call(`/parents/my/children/${selectedChildId}/results`),
        call(`/parents/my/children/${selectedChildId}/attendance`),
        call(`/parents/my/children/${selectedChildId}/payments`),
      ]);
    setResults(
      resultsResponse.success && resultsResponse.data
        ? resultsResponse.data
        : []
    );
    setAttendance(
      attendanceResponse.success && attendanceResponse.data
        ? attendanceResponse.data
        : []
    );
    setPayments(
      paymentsResponse.success && paymentsResponse.data
        ? paymentsResponse.data
        : []
    );
    setDetailsLoading(false);
  }, [call, selectedChildId]);
  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);
  useEffect(() => {
    fetchChildDetails();
  }, [fetchChildDetails]);
  const attendanceSummary = useMemo(() => {
    const present = attendance.filter(
      (item) => item.status === 'present'
    ).length;
    const late = attendance.filter(
      (item) => item.status === 'late'
    ).length;
    const absent = attendance.filter(
      (item) => item.status === 'absent'
    ).length;
    const excused = attendance.filter(
      (item) => item.status === 'excused'
    ).length;
    return {
      total: attendance.length,
      present,
      late,
      absent,
      excused,
    };
  }, [attendance]);
  const paymentTotal = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );
  const latestResult = results[0] || null;
  const formatCurrency = (amount: number) =>
    `?${Number(amount || 0).toLocaleString()}`;
  const resultColumns = [
    {
      key: 'subject',
      header: 'Subject',
      render: (item: ResultSubject) =>
        item.subject?.name || 'Subject',
    },
    {
      key: 'test1',
      header: 'Total',
      render: (item: ResultSubject) => (
        <span className="font-semibold">
          {Number(item.total || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'percentage',
      header: '%',
      render: (item: ResultSubject) =>
        `${Number(item.percentage || 0).toFixed(2)}%`,
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (item: ResultSubject) => (
        <StatusBadge status={item.grade || 'N/A'} />
      ),
    },
  ];
  const attendanceColumns = [
    {
      key: 'date',
      header: 'Date',
      render: (item: Attendance) => item.attendance_date,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Attendance) => (
        <StatusBadge status={item.status} />
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (item: Attendance) => item.remarks || '-',
    },
  ];
  const paymentColumns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (item: Payment) => (
        <span className="text-xs font-semibold">
          {item.payment_reference}
        </span>
      ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (item: Payment) => item.purpose,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: Payment) => (
        <span className="font-semibold">
          {formatCurrency(item.amount)}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (item: Payment) => item.payment_date,
    },
    {
      key: 'method',
      header: 'Method',
      render: (item: Payment) => item.payment_method,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (item: Payment) =>
        item.receipt?.receipt_number || 'Pending',
    },
  ];
  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">
          Loading your children...
        </div>
      </div>
    );
  }
  if (children.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">My Children</h1>
            <p className="page-description">
              View your children's school information.
            </p>
          </div>
        </div>
        <Card>
          <div className="empty-state">
            <div className="empty-state-icon">CH</div>
            <div className="empty-state-title">
              No children assigned
            </div>
            <p className="empty-state-description">
              No student has been assigned to your parent account yet.
            </p>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Children</h1>
          <p className="page-description">
            View your children's academic, attendance and payment information.
          </p>
        </div>
        <div className="page-actions">
          <select
            className="form-input"
            value={selectedChildId}
            onChange={(event) => {
              setSelectedChildId(event.target.value);
              setActiveTab('overview');
            }}
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.first_name} {child.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {selectedChild && (
        <>
          <Card className="mb-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">Student</p>
                <p className="font-semibold">
                  {selectedChild.first_name} {selectedChild.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Admission Number</p>
                <p className="font-semibold">
                  {selectedChild.admission_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Class</p>
                <p className="font-semibold">
                  {selectedChild.current_class?.name || 'Not assigned'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Attendance Records</p>
                <p className="font-semibold">
                  {attendanceSummary.total}
                </p>
              </div>
            </div>
          </Card>
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'overview' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </Button>
            <Button
              variant={activeTab === 'results' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('results')}
            >
              Results
            </Button>
            <Button
              variant={activeTab === 'attendance' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('attendance')}
            >
              Attendance
            </Button>
            <Button
              variant={activeTab === 'payments' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('payments')}
            >
              Payments
            </Button>
          </div>
          {detailsLoading ? (
            <Card>
              <div className="empty-state">
                <div className="empty-state-title">
                  Loading child information...
                </div>
              </div>
            </Card>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="grid gap-6 md:grid-cols-3">
                  <Card>
                    <div className="stat-card">
                      <div className="stat-icon stat-icon-blue">RS</div>
                      <div className="stat-content">
                        <h3>
                          {latestResult?.term_average != null
                            ? `${Number(latestResult.term_average).toFixed(2)}%`
                            : '-'}
                        </h3>
                        <p>Latest Term Average</p>
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <div className="stat-card">
                      <div className="stat-icon stat-icon-green">AT</div>
                      <div className="stat-content">
                        <h3>
                          {attendanceSummary.present +
                            attendanceSummary.late}
                        </h3>
                        <p>Present / Late</p>
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <div className="stat-card">
                      <div className="stat-icon stat-icon-yellow">PY</div>
                      <div className="stat-content">
                        <h3>{formatCurrency(paymentTotal)}</h3>
                        <p>Total Recorded Payments</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="md:col-span-3">
                    <h2 className="mb-4 text-lg font-semibold">
                      Latest Published Result
                    </h2>
                    {latestResult ? (
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-gray-500">Session</p>
                          <p className="font-semibold">
                            {latestResult.session?.name || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Term</p>
                          <p className="font-semibold">
                            {latestResult.term?.name || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Position</p>
                          <p className="font-semibold">
                            {latestResult.term_position ?? '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Cumulative</p>
                          <p className="font-semibold">
                            {latestResult.cumulative_average != null
                              ? `${Number(latestResult.cumulative_average).toFixed(2)}%`
                              : '-'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No published result is available yet.
                      </p>
                    )}
                  </Card>
                </div>
              )}
              {activeTab === 'results' && (
                <div className="space-y-6">
                  {results.length === 0 ? (
                    <Card>
                      <div className="empty-state">
                        <div className="empty-state-title">
                          No published results
                        </div>
                      </div>
                    </Card>
                  ) : (
                    results.map((result) => (
                      <Card
                        key={result.id}
                        title={`${result.session?.name || 'Session'} • ${result.term?.name || 'Term'}`}
                      >
                        <div className="mb-4 grid gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-xs text-gray-500">
                              Term Average
                            </p>
                            <p className="text-lg font-semibold">
                              {result.term_average != null
                                ? `${Number(result.term_average).toFixed(2)}%`
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              Position
                            </p>
                            <p className="text-lg font-semibold">
                              {result.term_position ?? '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              Cumulative Average
                            </p>
                            <p className="text-lg font-semibold">
                              {result.cumulative_average != null
                                ? `${Number(result.cumulative_average).toFixed(2)}%`
                                : '-'}
                            </p>
                          </div>
                        </div>
                        <Table
                          columns={resultColumns}
                          data={result.result_subjects || []}
                          loading={false}
                          emptyMessage="No subject results available"
                        />
                      </Card>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <div className="stat-card">
                        <div className="stat-content">
                          <h3>{attendanceSummary.present}</h3>
                          <p>Present</p>
                        </div>
                      </div>
                    </Card>
                    <Card>
                      <div className="stat-card">
                        <div className="stat-content">
                          <h3>{attendanceSummary.late}</h3>
                          <p>Late</p>
                        </div>
                      </div>
                    </Card>
                    <Card>
                      <div className="stat-card">
                        <div className="stat-content">
                          <h3>{attendanceSummary.absent}</h3>
                          <p>Absent</p>
                        </div>
                      </div>
                    </Card>
                    <Card>
                      <div className="stat-card">
                        <div className="stat-content">
                          <h3>{attendanceSummary.excused}</h3>
                          <p>Excused</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                  <Card>
                    <Table
                      columns={attendanceColumns}
                      data={attendance}
                      loading={false}
                      emptyMessage="No attendance records found"
                    />
                  </Card>
                </div>
              )}
              {activeTab === 'payments' && (
                <Card>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Payment History
                      </h2>
                      <p className="text-sm text-gray-500">
                        Total recorded: {formatCurrency(paymentTotal)}
                      </p>
                    </div>
                  </div>
                  <Table
                    columns={paymentColumns}
                    data={payments}
                    loading={false}
                    emptyMessage="No payment records found"
                  />
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
