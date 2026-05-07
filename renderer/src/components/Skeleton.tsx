import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export const Skeleton = ({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  className = '',
}: SkeletonProps): JSX.Element => (
  <div
    className={`Skeleton ${className}`}
    style={{ width, height, borderRadius }}
  />
);

export const SkeletonCard = ({ className = '' }: { className?: string }): JSX.Element => (
  <div className={`SkeletonCard ${className}`}>
    <div className="SkeletonCard-icon">
      <Skeleton width="48px" height="48px" borderRadius="12px" />
    </div>
    <div className="SkeletonCard-content">
      <Skeleton width="60%" height="14px" />
      <Skeleton width="80%" height="28px" />
      <Skeleton width="40%" height="12px" />
    </div>
  </div>
);

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export const SkeletonTable = ({ rows = 5, cols = 4 }: SkeletonTableProps): JSX.Element => (
  <div className="SkeletonTable">
    <div className="SkeletonTable-header">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={`${60 + Math.random() * 40}%`} height="14px" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="SkeletonTable-row" style={{ animationDelay: `${rowIdx * 0.05}s` }}>
        {Array.from({ length: cols }).map((_, colIdx) => (
          <Skeleton key={colIdx} width={`${50 + Math.random() * 50}%`} height="16px" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonList = ({ items = 3 }: { items?: number }): JSX.Element => (
  <div className="SkeletonList">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="SkeletonList-item" style={{ animationDelay: `${i * 0.06}s` }}>
        <Skeleton width="40px" height="40px" borderRadius="10px" />
        <div className="SkeletonList-itemContent">
          <Skeleton width="70%" height="14px" />
          <Skeleton width="45%" height="12px" />
        </div>
        <Skeleton width="80px" height="16px" />
      </div>
    ))}
  </div>
);
