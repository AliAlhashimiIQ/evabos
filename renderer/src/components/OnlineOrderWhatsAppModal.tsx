import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Copy,
  ExternalLink,
  Check,
  User,
  Smartphone,
  Sparkles,
  ClipboardCheck,
  Truck,
  ShoppingBag,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import './OnlineOrderWhatsAppModal.css';

type OnlineOrder = import('../types/electron').OnlineOrder;

interface OnlineOrderWhatsAppModalProps {
  visible: boolean;
  onClose: () => void;
  order: OnlineOrder | null;
  storeName?: string;
}

/**
 * Normalizes Iraqi phone numbers into standard WhatsApp international format (+964)
 */
export function normalizeIraqiPhone(rawPhone: string): { normalized: string; formatted: string; isValid: boolean } {
  if (!rawPhone) return { normalized: '', formatted: '', isValid: false };

  // Remove spaces, hyphens, parentheses, and any non-digit chars except leading +
  let cleaned = rawPhone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // If starts with 07... (standard Iraqi local mobile)
  if (cleaned.startsWith('07')) {
    cleaned = '964' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 10) {
    // Missing leading zero, e.g. 7701234567
    cleaned = '964' + cleaned;
  }

  // Validate length: Iraqi numbers with country code are typically 12-13 digits (964 7XX XXX XXXX)
  const isValid = cleaned.startsWith('964') && cleaned.length >= 12 && cleaned.length <= 14;

  // Nicely formatted display string: +964 770 123 4567
  let formatted = '+' + cleaned;
  if (cleaned.startsWith('9647') && cleaned.length === 13) {
    formatted = `+964 ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }

  return { normalized: cleaned, formatted, isValid };
}

export const OnlineOrderWhatsAppModal: React.FC<OnlineOrderWhatsAppModalProps> = ({
  visible,
  onClose,
  order,
  storeName = 'EVA POS',
}) => {
  const toast = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<'confirm' | 'out_for_delivery' | 'ready_pickup'>('confirm');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Generate default templates whenever order or storeName changes
  useEffect(() => {
    if (!order) return;

    const custName = order.customerName ? `أستاذ/ة ${order.customerName}` : 'عزيزنا العميل';
    const totalFormatted = `${order.totalIQD.toLocaleString('en-IQ')} د.ع`;
    const itemsList = order.items
      .map((i) => `• ${i.productName}${i.color || i.size ? ` (${[i.color, i.size].filter(Boolean).join(' / ')})` : ''} × ${i.quantity}`)
      .join('\n');

    let msg = '';
    if (selectedTemplate === 'confirm') {
      msg = `مرحباً ${custName} 🌸\nشكراً لطلبك من ${storeName}!\n\nتفاصيل طلبك (#${order.id}):\n${itemsList}\n\n💰 المبلغ الإجمالي: ${totalFormatted}\n${order.note ? `📍 العنوان / ملاحظاتك: ${order.note}\n` : ''}\nتم تأكيد طلبك وجاري تجهيز الشحنة والتوصيل إليك قريباً! 🛵✨`;
    } else if (selectedTemplate === 'out_for_delivery') {
      msg = `مرحباً ${custName} 🌸\nنود إعلامك بأن طلبك (#${order.id}) من ${storeName} قد خرج مع مندوب التوصيل وهو في الطريق إليك الآن 🛵📦\n\n💰 المبلغ المطلوب عند الاستلام: ${totalFormatted}\n${order.note ? `📍 العنوان: ${order.note}\n` : ''}\nيرجى إبقاء الهاتف متاحاً للتنسيق مع المندوب. شكراً لتسوقك معنا!`;
    } else if (selectedTemplate === 'ready_pickup') {
      msg = `مرحباً ${custName} 🌸\nنود إعلامك بأن طلبك (#${order.id}) أصبح جاهزاً للاستلام من فرعنا 🛍️✨\n\n💰 المبلغ المطلوب: ${totalFormatted}\nبانتظار تشريفكم في أي وقت خلال ساعات العمل!`;
    }

    setCustomMessage(msg);
  }, [order, selectedTemplate, storeName]);

  if (!visible || !order) return null;

  const phoneInfo = normalizeIraqiPhone(order.customerPhone || '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      toast.success('تم نسخ نص الرسالة بنجاح');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('تعذر نسخ النص');
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!phoneInfo.normalized) {
      toast.warning('يرجى التأكد من وجود رقم هاتف صحيح للعميل');
      return;
    }

    const encodedText = encodeURIComponent(customMessage);
    const waUrl = `https://wa.me/${phoneInfo.normalized}?text=${encodedText}`;

    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(waUrl);
      } else {
        window.open(waUrl, '_blank');
      }
      toast.success('جاري فتح محادثة واتساب في المتصفح...');
    } catch (err) {
      console.error('Failed to open WhatsApp URL:', err);
      toast.error('تعذر فتح الرابط في المتصفح');
    }
  };

  return (
    <div className="OOWA-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="OOWA-modal">
        {/* Header */}
        <div className="OOWA-header">
          <div className="OOWA-header-title">
            <div className="OOWA-iconWrap">
              <MessageCircle size={22} className="OOWA-waIcon" />
            </div>
            <div>
              <h3>مراسلة العميل عبر واتساب</h3>
              <p>طلب #{order.id} • {order.customerName || 'عميل عام'}</p>
            </div>
          </div>
          <button className="OOWA-closeBtn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="OOWA-body">
          {/* Customer & Phone Badge */}
          <div className="OOWA-customerBar">
            <div className="OOWA-custItem">
              <User size={15} />
              <span>{order.customerName || 'عميل غير مسجل الاسم'}</span>
            </div>
            <div className="OOWA-custItem">
              <Smartphone size={15} />
              <span className={`OOWA-phoneBadge ${phoneInfo.isValid ? 'valid' : 'invalid'}`} dir="ltr">
                {phoneInfo.formatted || 'لا يوجد رقم هاتف'}
              </span>
            </div>
          </div>

          {!phoneInfo.isValid && (
            <div className="OOWA-warningBanner">
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>رقم الهاتف المسجل غير متوافق تماماً مع صيغة الأرقام العراقية. تأكد من صحة الرقم قبل الإرسال.</span>
            </div>
          )}

          {/* Template Selector */}
          <div className="OOWA-section">
            <label className="OOWA-label">
              <Sparkles size={16} /> اختر قالب الرسالة:
            </label>
            <div className="OOWA-templates">
              <button
                className={`OOWA-templateBtn ${selectedTemplate === 'confirm' ? 'active' : ''}`}
                onClick={() => setSelectedTemplate('confirm')}
              >
                <ClipboardCheck size={16} />
                <span>تأكيد الطلب</span>
              </button>
              <button
                className={`OOWA-templateBtn ${selectedTemplate === 'out_for_delivery' ? 'active' : ''}`}
                onClick={() => setSelectedTemplate('out_for_delivery')}
              >
                <Truck size={16} />
                <span>خرج للتوصيل</span>
              </button>
              <button
                className={`OOWA-templateBtn ${selectedTemplate === 'ready_pickup' ? 'active' : ''}`}
                onClick={() => setSelectedTemplate('ready_pickup')}
              >
                <ShoppingBag size={16} />
                <span>جاهز للاستلام</span>
              </button>
            </div>
          </div>

          {/* Message Textarea */}
          <div className="OOWA-section">
            <div className="OOWA-labelRow">
              <label className="OOWA-label">نص الرسالة (قابل للتعديل):</label>
              <span className="OOWA-charCount">{customMessage.length} حرف</span>
            </div>
            <textarea
              className="OOWA-textarea"
              rows={8}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="اكتب نص الرسالة هنا..."
            />
          </div>

          {/* Actions */}
          <div className="OOWA-actions">
            <button className="OOWA-btn OOWA-btn--ghost" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'تم النسخ!' : 'نسخ الرسالة'}
            </button>
            <button
              className="OOWA-btn OOWA-btn--whatsapp"
              onClick={handleOpenWhatsApp}
              disabled={!phoneInfo.normalized}
            >
              <MessageCircle size={17} />
              <span>إرسال عبر واتساب</span>
              <ExternalLink size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineOrderWhatsAppModal;
