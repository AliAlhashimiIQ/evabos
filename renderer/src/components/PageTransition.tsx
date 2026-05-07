import { useLocation } from 'react-router-dom';
import { useRef, useEffect, type ReactNode } from 'react';
import './PageTransition.css';

interface PageTransitionProps {
  children: ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps): JSX.Element => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset animation
    el.classList.remove('PageTransition--enter');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('PageTransition--enter');
  }, [location.pathname]);

  return (
    <div ref={containerRef} className="PageTransition PageTransition--enter">
      {children}
    </div>
  );
};
