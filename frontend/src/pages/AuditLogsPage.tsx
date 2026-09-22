import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingContainer } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  user?: {
    email: string;
    role: string;
  } | null;
}
interface AuditResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
export default function AuditLogsPage() {
  const { call } = useApi();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  useEffect(() => {
    fetchLogs();
  }, [page, action, entityType]);
  async function fetchLogs() {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String((page - 1) * limit),
    });
    if (action.trim()) {
      params.set('action', action.trim());
    }
    if (entityType.trim()) {
      params.set('entity_type', entityType.trim());
    }
    const result = await call(`/audit-logs?${params.toString()}`);
    if (result.success && result.data) {
      const data = result.data as AuditResponse;
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } else {
      setLogs([]);
      setTotal(0);
    }
    setLoading(false);
  }
  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (page !== 1) {
      setPage(1);
    } else {
      fetchLogs();
    }
  }
  function clearFilters() {
    setSearch('');
    setAction('');
    setEntityType('');
    setPage(1);
  }
  const filteredLogs = search.trim()
    ? logs.filter((log) => {
        const query = search.toLowerCase();
        return [
          log.action,
          log.entity_type,
          log.entity_id,
          log.user?.email,
          JSON.stringify(log.metadata),
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );
      })
    : logs;
  if (loading && logs.length === 0) {
    return <LoadingContainer text="Loading audit logs..." />;
  }
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-description">
            Review important administrative and system activity.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={fetchLogs}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>
      <Card>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(220px, 2fr) repeat(2, minmax(160px, 1fr)) auto',
            gap: '0.75rem',
            alignItems: 'end',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search logs..."
            />
          </div>
          <div>
            <label className="form-label">Action</label>
            <input
              className="form-input"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              placeholder="e.g. CREATE"
            />
          </div>
          <div>
            <label className="form-label">Entity</label>
            <input
              className="form-input"
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
              placeholder="e.g. student"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="submit">Search</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={clearFilters}
            >
              Clear
            </Button>
          </div>
        </form>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              color: 'var(--color-gray-500)',
              fontSize: '0.875rem',
            }}
          >
            {total.toLocaleString()} log{total === 1 ? '' : 's'}
          </span>
          {loading && (
            <span
              style={{
                color: 'var(--color-gray-500)',
                fontSize: '0.875rem',
              }}
            >
              Refreshing...
            </span>
          )}
        </div>
        {filteredLogs.length === 0 ? (
          <EmptyState
            title="No audit logs found"
            description="No activity matches the current filters."
          />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        {log.user?.email || 'System'}
                        {log.user?.role && (
                          <div
                            style={{
                              color: 'var(--color-gray-500)',
                              fontSize: '0.75rem',
                              marginTop: '0.2rem',
                            }}
                          >
                            {log.user.role}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{log.action}</strong>
                      </td>
                      <td>
                        {log.entity_type}
                        {log.entity_id && (
                          <div
                            style={{
                              color: 'var(--color-gray-500)',
                              fontSize: '0.75rem',
                              marginTop: '0.2rem',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={log.entity_id}
                          >
                            {log.entity_id}
                          </div>
                        )}
                      </td>
                      <td>
                        <pre
                          style={{
                            margin: 0,
                            maxWidth: '360px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '0.75rem',
                            fontFamily: 'inherit',
                          }}
                        >
                          {Object.keys(log.metadata || {}).length > 0
                            ? JSON.stringify(log.metadata, null, 2)
                            : 'No additional details'}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginTop: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-gray-500)',
                }}
              >
                Page {page} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  disabled={page <= 1 || loading}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
