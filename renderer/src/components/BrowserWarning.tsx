import { AlertTriangle } from 'lucide-react';
import './BrowserWarning.css';

export function BrowserWarning(): JSX.Element | null {
  // Check if we're in Electron (window.evaApi exists) or in a browser
  const isElectron = typeof window !== 'undefined' && window.evaApi;

  if (isElectron) {
    return null; // Don't show warning in Electron
  }

  return (
    <div className="BrowserWarning" dir="rtl">
      <div className="BrowserWarning-content">
        <div className="BrowserWarning-icon"><AlertTriangle size={48} /></div>
        <h2>يجب تشغيل هذا التطبيق داخل نافذة Electron المكتبية</h2>
        <p>
          يبدو أنك تحاول فتح هذا النظام في متصفح ويب عادي. هذا النظام مصمم ليعمل كـ <strong>تطبيق مكتبي مخصص</strong> داخل بيئة Electron لربط الطابعات وأجهزة الباركود وقواعد البيانات المحلية.
        </p>
        <div className="BrowserWarning-steps">
          <h3>طريقة التشغيل الصحيحة:</h3>
          <ol>
            <li>أغلق علامة تبويب المتصفح هذه.</li>
            <li>افتح موجه الأوامر (PowerShell / Command Prompt) في مجلد المشروع.</li>
            <li>نفذ الأمر: <code dir="ltr">npm run dev</code></li>
            <li>انتظر حتى تفتح نافذة البرنامج المكتبية تلقائياً.</li>
            <li>استخدم نافذة البرنامج المكتبية مباشرة (وليس المتصفح).</li>
          </ol>
        </div>
        <div className="BrowserWarning-note">
          <strong>ملاحظة:</strong> ستفتح نافذة النظام تلقائياً بعد تشغيل الأمر <code dir="ltr">npm run dev</code>. لا تقم بفتح الرابط داخل المتصفح يدوياً.
        </div>
      </div>
    </div>
  );
}

