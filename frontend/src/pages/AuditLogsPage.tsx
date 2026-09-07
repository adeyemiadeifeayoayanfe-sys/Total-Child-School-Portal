import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { AuditLog } from '../types';
import Table from '../components/ui/Table';
import Card from '../components/ui/Card';

export default function AuditLogsPage() {
  const { call } = useApi();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (filterAction) query.set('action', filterAction);
    if (filterEntity) query.set('entity_type', filterEntity);

    const result = await call(`/audit-logs?${query.toString()}`);
    if (result.success && result.data) {
      setLogs(result.data.logs || []);
    }
    setLoading(false);
  }, [call, filterAction, filterEntity]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-600">
          {new Date(log.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (log: AuditLog) => log.user?.email || 'System',
    },
    {
      key: 'action',
      header: 'Action',
      render: (log: AuditLog) => (
        <span className="font-semibold text-primary-600">
          {log.action.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (log: AuditLog) => (
        <span className="capitalize">{log.entity_type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'metadata',
      header: 'Details',
      render: (log: AuditLog) => {
        const metadata = log.metadata || {};
        const keys = Object.keys(metadata);
        if (keys.length === 0) return '—';
        return (
          <span className="text-xs text-gray-500">
            {keys.slice(0, 3).map(key => `${key}: ${metadata[key]}`).join(', ')}
            {keys.length > 3 && ` +${keys.length - 3} more`}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-description">Track all important system activities</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            className="form-input"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ maxWidth: '250px' }}
          />
          <input
            className="form-input"
            placeholder="Filter by entity..."
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            style={{ maxWidth: '250px' }}
          />
          {(filterAction || filterEntity) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilterAction('');
                setFilterEntity('');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
        <Table
          columns={columns}
          data={logs}
          loading={loading}
          emptyMessage="No audit logs found"
        />
      </Card>
    </div>
  );
}