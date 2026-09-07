import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: string;
}

export default function EmptyState({ 
  title, 
  description, 
  action, 
  icon = '—' 
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}