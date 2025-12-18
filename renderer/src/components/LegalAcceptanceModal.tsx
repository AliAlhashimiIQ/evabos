import React, { useEffect, useState } from 'react';
import './LegalAcceptanceModal.css';

export function LegalAcceptanceModal(): JSX.Element | null {
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState<'privacy' | 'terms' | 'eula'>('privacy');
    const [content, setContent] = useState<string>('جاري التحميل...');
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [accepted, setAccepted] = useState({
        privacy: false,
        terms: false,
        eula: false
    });

    useEffect(() => {
        const checkLegalSetting = async () => {
            if (!window.electronAPI) return;
            const result = await window.electronAPI.getSetting('legal_accepted_v1');
            if (result !== 'true') {
                setVisible(true);
                loadContent('privacy');
            }
        };
        checkLegalSetting();
    }, []);

    const loadContent = async (type: 'privacy' | 'terms' | 'eula') => {
        if (!window.electronAPI) return;
        setContent('جاري التحميل...');
        setScrolledToBottom(false);
        const text = await window.electronAPI.getLegalDocument(type);
        setContent(text);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            setScrolledToBottom(true);
        }
    };

    const handleNext = async () => {
        if (!scrolledToBottom) return;

        if (step === 'privacy') {
            setAccepted(prev => ({ ...prev, privacy: true }));
            setStep('terms');
            loadContent('terms');
        } else if (step === 'terms') {
            setAccepted(prev => ({ ...prev, terms: true }));
            setStep('eula');
            loadContent('eula');
        } else if (step === 'eula') {
            setAccepted(prev => ({ ...prev, eula: true }));
            if (window.electronAPI) {
                await window.electronAPI.setSetting('legal_accepted_v1', 'true');
                setVisible(false);
            }
        }
    };

    if (!visible) return null;

    const titles = {
        privacy: 'سياسة الخصوصية',
        terms: 'شروط الخدمة',
        eula: 'اتفاقية المستخدم (EULA)'
    };

    return (
        <div className="LegalModal-overlay" dir="rtl">
            <div className="LegalModal-card">
                <div className="LegalModal-header">
                    <div className="LegalModal-progress" style={{ flexDirection: 'row-reverse' }}>
                        <div className={`dot ${step === 'privacy' ? 'active' : ''} ${accepted.privacy ? 'done' : ''}`} />
                        <div className={`dot ${step === 'terms' ? 'active' : ''} ${accepted.terms ? 'done' : ''}`} />
                        <div className={`dot ${step === 'eula' ? 'active' : ''} ${accepted.eula ? 'done' : ''}`} />
                    </div>
                    <h1>{titles[step]}</h1>
                    <p>يرجى القراءة والموافقة للمتابعة</p>
                </div>

                <div className="LegalModal-content" onScroll={handleScroll}>
                    <pre className="LegalModal-text" style={{ textAlign: 'right', direction: 'rtl' }}>{content}</pre>
                </div>

                <div className="LegalModal-footer">
                    {!scrolledToBottom && (
                        <div className="LegalModal-hint">⬇️ يرجى التمرير للأسفل للموافقة</div>
                    )}
                    <button
                        className="LegalModal-button"
                        onClick={handleNext}
                        disabled={!scrolledToBottom}
                    >
                        {step === 'eula' ? 'قبول وإنهاء' : 'أوافق وأتابع'}
                    </button>
                </div>
            </div>
        </div>
    );
}
