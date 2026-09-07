import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  white?: boolean;
  className?: string;
}

export default function Spinner({ 
  size = 'md', 
  white = false, 
  className = '' 
}: SpinnerProps) {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: '',
    lg: 'spinner-lg',
  };

  const classes = [
    'spinner',
    sizeClasses[size],
    white ? 'spinner-white' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes} aria-hidden="true" />;
}

export function LoadingContainer({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="loading-container">
      <Spinner />
      <span className="loading-text">{text}</span>
    </div>
  );
}