import React, { useEffect, useState, useCallback } from 'react';
import { Smartphone, X, Copy, Check, RefreshCw, Tag, ShoppingCart } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface CompanionQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanionQrModal: React.FC<CompanionQrModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{
    url: string;
    qrDataUrl: string;
    ip: string;
    port: number;
    active: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const companionApi = (window as any).evaApi?.companion || (window as any).electronAPI?.companion;
      let res = null;
      if (companionApi?.getInfo) {
        res = await companionApi.getInfo(token || undefined);
      }

      if (res && res.url) {
        if (!res.qrDataUrl) {
          res.qrDataUrl = await QRCode.toDataURL(res.url, {
            width: 260,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        }
        setInfo(res);
      } else {
        const fallbackUrl = `http://${window.location.hostname || '127.0.0.1'}:8989`;
        const qrDataUrl = await QRCode.toDataURL(fallbackUrl, {
          width: 260,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        setInfo({
          url: fallbackUrl,
          qrDataUrl,
          ip: window.location.hostname || '127.0.0.1',
          port: 8989,
          active: true,
        });
      }
    } catch (err) {
      console.error('Failed to get companion info:', err);
      try {
        const fallbackUrl = `http://127.0.0.1:8989`;
        const qrDataUrl = await QRCode.toDataURL(fallbackUrl, {
          width: 260,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        setInfo({
          url: fallbackUrl,
          qrDataUrl,
          ip: '127.0.0.1',
          port: 8989,
          active: true,
        });
      } catch (fallbackErr) {
        console.error('QR fallback failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchInfo();
    }
  }, [isOpen, fetchInfo]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (info?.url) {
      navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '18px',
          maxWidth: '460px',
          width: '100%',
          padding: '1.5rem',
          color: 'var(--text-primary, #0f172a)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          direction: 'rtl',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '1.12rem', color: 'var(--text-primary, #0f172a)' }}>
            <Smartphone size={22} color="#3b82f6" />
            <span>ماسح الهاتف وفاحص الأسعار (Wi-Fi)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', marginBottom: '1.15rem', lineHeight: '1.5' }}>
          امسح الرمز بكاميرا الهاتف لفتح تطبيق الماسح وفاحص العروض مباشرة في المتصفح دون تثبيت أي برامج!
        </p>

        {/* QR Code Container */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            marginBottom: '1.15rem',
          }}
        >
          {loading ? (
            <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <RefreshCw size={32} className="spin" />
            </div>
          ) : info?.qrDataUrl ? (
            <img
              src={info.qrDataUrl}
              alt="Companion QR Code"
              style={{ width: '220px', height: '220px', display: 'block', borderRadius: '6px' }}
            />
          ) : (
            <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              تعذر إنشاء الرمز
            </div>
          )}
        </div>

        {/* URL Box */}
        <div
          style={{
            background: 'var(--bg-primary, #f1f5f9)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            direction: 'ltr',
          }}
        >
          <span style={{ fontSize: '0.88rem', fontFamily: 'monospace', color: '#2563eb', fontWeight: 'bold' }}>
            {info?.url || 'http://...'}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              color: '#2563eb',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold',
            }}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
          </button>
        </div>

        {/* SSL Camera Notice */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary, #64748b)',
            marginBottom: '1rem',
            textAlign: 'right',
            lineHeight: '1.4',
          }}
        >
          <strong>ملاحظة للهاتف:</strong> عند فتح الرابط لأول مرة، اضغط على <strong>متابعة / Advanced → Proceed</strong> لمنح إذن تشغيل كاميرا الفيديو المباشرة على متصفحك.
        </div>

        {/* 2 Modes Feature Highlights */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            textAlign: 'right',
            fontSize: '0.8rem',
            marginBottom: '1.2rem',
          }}
        >
          <div
            style={{
              background: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: '10px',
              padding: '8px 10px',
            }}
          >
            <div style={{ color: '#2563eb', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <ShoppingCart size={14} /> وضع الكاشير
            </div>
            <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.74rem' }}>
              أي مسح بالكاميرا يُضاف مباشرة لسلة المبيعات.
            </div>
          </div>

          <div
            style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '10px',
              padding: '8px 10px',
            }}
          >
            <div style={{ color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <Tag size={14} /> فاحص الأسعار والعروض
            </div>
            <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.74rem' }}>
              فحص السعر، المخزون، وحساب مضاعفات (1x, 2x, 3x).
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '11px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          تم
        </button>
      </div>
    </div>
  );
};

export default CompanionQrModal;
