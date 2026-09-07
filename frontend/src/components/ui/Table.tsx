import React from 'react';

interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  striped?: boolean;
}

export default function Table<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  striped = false,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" aria-hidden="true" />
        <span className="loading-text">Loading data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          <span>DI</span>
        </div>
        <div className="empty-state-title">No Data Available</div>
        <p className="empty-state-description">{emptyMessage}</p>
      </div>
    );
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className="table-container">
      <table className={`table ${striped ? 'table-striped' : ''}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th 
                key={col.key} 
                style={col.width ? { width: col.width } : undefined}
                className={alignClasses[col.align || 'left']}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr 
              key={item.id} 
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'cursor-pointer' : ''}
            >
              {columns.map((col) => (
                <td 
                  key={col.key}
                  className={alignClasses[col.align || 'left']}
                >
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}