import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { variant: BadgeVariant; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'neutral', label: 'Inactive' },
    suspended: { variant: 'error', label: 'Suspended' },
    draft: { variant: 'neutral', label: 'Draft' },
    submitted: { variant: 'info', label: 'Submitted' },
    returned: { variant: 'warning', label: 'Returned' },
    approved: { variant: 'success', label: 'Approved' },
    pending: { variant: 'warning', label: 'Pending' },
    generated: { variant: 'info', label: 'Generated' },
    reviewed: { variant: 'info', label: 'Reviewed' },
    published: { variant: 'success', label: 'Published' },
    archived: { variant: 'neutral', label: 'Archived' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'error', label: 'Failed' },
    voided: { variant: 'error', label: 'Voided' },
    present: { variant: 'success', label: 'Present' },
    absent: { variant: 'error', label: 'Absent' },
    late: { variant: 'warning', label: 'Late' },
    excused: { variant: 'info', label: 'Excused' },
    printed: { variant: 'success', label: 'Printed' },
    paid: { variant: 'success', label: 'Paid' },
    unpaid: { variant: 'error', label: 'Unpaid' },
    partial: { variant: 'warning', label: 'Partial' },
  };

  const mapped = statusMap[status?.toLowerCase()] || { 
    variant: 'neutral' as BadgeVariant, 
    label: status || 'Unknown' 
  };

  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}