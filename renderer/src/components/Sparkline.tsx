interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export const Sparkline = ({
  data,
  width = 80,
  height = 28,
  color = '#3b82f6',
  className = '',
}: SparklineProps): JSX.Element | null => {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * innerW;
    const y = padding + innerH - ((v - min) / range) * innerH;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  // Create fill path (close the polygon along the bottom)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const fillPath = `M ${firstPoint} L ${polyline.replace(/,/g, ' ').split(' ').reduce((acc: string[], val, idx) => {
    if (idx % 2 === 0 && idx > 0) acc.push('L');
    acc.push(val);
    return acc;
  }, []).join(' ')} L ${lastPoint.split(',')[0]} ${height - padding} L ${firstPoint.split(',')[0]} ${height - padding} Z`;

  const gradientId = `sparkGrad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`Sparkline ${className}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on latest value */}
      {data.length > 0 && (
        <circle
          cx={padding + innerW}
          cy={padding + innerH - ((data[data.length - 1] - min) / range) * innerH}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
};
