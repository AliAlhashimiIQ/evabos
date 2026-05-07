import React, { useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './PortalModal.css';

interface PortalModalProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

const PortalModal = ({ children, onClose, className = '' }: PortalModalProps): JSX.Element => {
  useEffect(() => {
    // Prevent body scroll when modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className={`PortalModal-overlay ${className}`} onClick={onClose}>
      <div className="PortalModal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
};

export default PortalModal;
