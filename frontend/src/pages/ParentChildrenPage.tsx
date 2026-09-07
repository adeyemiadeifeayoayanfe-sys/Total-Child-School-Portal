import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { LoadingContainer } from '../components/ui/Spinner';

export default function ParentChildrenPage() {
  const { call } = useApi();

  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'attendance' | 'payments'>('results');
  const [tabData, setTabData] = useState<any>(null);
  const [tabLoading, setTabLoading] = useState(false);

  const fetchChildren = useCallback(async () => {
    setLoading(true);
    const result = await call('/parents/my/children');
    if (result.success && result.data) {
      setChildren(result.data);
      if (result.data.length > 0) {
        setSelectedChild(result.data[0]);
        fetchTabData(result.data[0].student.id, 'results');
      }
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const fetchTabData = async (childId: string, tab: string) => {
    setTabLoading(true);
    const endpoint =
      tab === 'results'
        ? `/parents/my/children/${childId}/results`
        : tab === 'attendance'
          ? `/parents/my/children/${childId}/attendance`
          : `/parents/my/children/${childId}/payments`;

    const result = await call(endpoint);
    if (result.success && result.data) {
      setTabData(result.data);
    } else {
      setTabData(null);
    }
    setTabLoading(false);
  };

  const handleSelectChild = (child: any) => {
    setSelectedChild(child);
    setActiveTab('results');
    fetchTabData(child.student.id, 'results');
  };

  const handleTabChange = (tab: 'results' | 'attendance' | 'payments') => {
    setActiveTab(tab);
    if (selectedChild) {
      fetchTabData(selectedChild.student.id, tab);
    }
  };

  if (loading) {
    return <LoadingContainer text="Loading children..." />;
  }

  if (children.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">My Children</h1>
            <p className="page-description">View your children's information</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">CH</div>
          <div className="empty-state-title">No children assigned</div>
          <p className="empty-state-description">
            Please contact the school administration to link your children to your account.
          </p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    if (tabLoading) {
      return <LoadingContainer text="Loading details..." />;
    }

    if (!tabData) {
      return (
        <div className="empty-state py-8">
          <div className="empty-state-title text-base">No data available</div>
        </div>
      );
    }

    if (activeTab === 'results') {
      const results = tabData.results || [];
      if (results.length === 0) {
        return <p className="text-gray-500">No results published yet.</p>;
      }
      return (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Average</th>
                <th>Position</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result: any, i: number) => (
                <tr key={i}>
                  <td>{result.term?.name || '—'}</td>
                  <td className="font-semibold">{result.term_average}%</td>
                  <td>{result.term_position || '—'}</td>
                  <td><StatusBadge status={result.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'attendance') {
      const records = tabData.records || [];
      if (records.length === 0) {
        return <p className="text-gray-500">No attendance records found.</p>;
      }
      return (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record: any, i: number) => (
                <tr key={i}>
                  <td>{record.attendance_date}</td>
                  <td><StatusBadge status={record.status} /></td>
                  <td>{record.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'payments') {
      const payments = tabData.payments || [];
      if (payments.length === 0) {
        return <p className="text-gray-500">No payment records found.</p>;
      }
      return (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: any, i: number) => (
                <tr key={i}>
                  <td className="text-xs font-semibold">{payment.payment_reference}</td>
                  <td>{payment.purpose}</td>
                  <td className="font-semibold">₦{payment.amount.toLocaleString()}</td>
                  <td>{payment.payment_date}</td>
                  <td><StatusBadge status={payment.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Children</h1>
          <p className="page-description">Select a child to view their details</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap gap-3">
          {children.map((child, index) => (
            <button
              key={index}
              className={`px-4 py-3 rounded-lg text-left transition-all ${
                selectedChild?.student.id === child.student.id
                  ? 'bg-primary-50 border-2 border-primary-500 shadow-sm'
                  : 'bg-white border-2 border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleSelectChild(child)}
              style={{ minWidth: '200px', flex: '1 1 auto' }}
            >
              <div className="font-semibold text-gray-900">
                {child.student.first_name} {child.student.last_name}
              </div>
              <div className="text-sm text-gray-500">
                {child.student.current_class?.name || 'No class assigned'}
              </div>
              <div className="text-xs text-gray-400">{child.student.admission_number}</div>
            </button>
          ))}
        </div>

        {selectedChild && (
          <Card>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedChild.student.first_name} {selectedChild.student.last_name}
              </h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="badge badge-info">
                  {selectedChild.student.current_class?.name || 'No Class'}
                </span>
                <span className="badge badge-neutral">
                  {selectedChild.student.admission_number}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {(['results', 'attendance', 'payments'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleTabChange(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>

            <div className="mt-2">{renderTabContent()}</div>
          </Card>
        )}
      </div>
    </div>
  );
}