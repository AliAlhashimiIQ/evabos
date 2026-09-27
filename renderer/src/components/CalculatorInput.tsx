import React, { useState, useEffect, useRef } from 'react';

interface CalculatorInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    placeholder?: string;
    className?: string;
}

/**
 * Format a number or numeric string with standard thousands comma separators:
 * 40000 -> "40,000"
 */
export const formatWithCommas = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val).replace(/,/g, '').trim();
    if (str === '') return '';
    const hasMinus = str.startsWith('-');
    const cleanStr = hasMinus ? str.slice(1) : str;
    const parts = cleanStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (hasMinus ? '-' : '') + parts.join('.');
};

/**
 * A number input that works as a calculator with Iraqi Dinar / currency thousands support:
 * - Automatically displays numbers with commas (e.g. 40,000)
 * - Supports typing digits with automatic thousands comma formatting
 * - Type "40+50+45" → press Enter → evaluates to 135
 * - Type "30k" or "30ك" or "30 الف" → evaluates to 30,000 (thousand shorthand)
 * - Shows a live "= X" preview while typing an expression
 */
const CalculatorInput: React.FC<CalculatorInputProps> = ({
    value,
    onChange,
    min,
    max,
    placeholder,
    className,
}) => {
    const [displayValue, setDisplayValue] = useState<string>(() => (value ? formatWithCommas(value) : (value === 0 ? '0' : '')));
    const [isExpression, setIsExpression] = useState(false);
    const [preview, setPreview] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync display when external value changes (only when not mid-expression)
    useEffect(() => {
        if (!isExpression) {
            setDisplayValue(value ? formatWithCommas(value) : (value === 0 ? '0' : ''));
        }
    }, [value, isExpression]);

    /** Expand thousand shorthands: "30k", "30ك", "30 الف", "30ألف" → "(30*1000)" */
    const expandK = (expr: string): string =>
        expr.replace(/(\d+(?:\.\d+)?)\s*(?:k|ك|ألف|الف)/gi, '($1*1000)');

    const evaluateExpression = (expression: string): number | null => {
        try {
            const cleanExpr = expression.replace(/,/g, '').replace(/\s/g, '');
            const expanded = expandK(cleanExpr);
            // After expanding thousand shortcuts, only digits and math operators should remain
            if (!/^[\d+\-*/().]+$/.test(expanded)) return null;
            if (/[a-zA-Z]/.test(expanded)) return null;
            // eslint-disable-next-line no-new-func
            const result = new Function(`return ${expanded}`)();
            if (typeof result !== 'number' || !isFinite(result)) return null;
            return result;
        } catch {
            return null;
        }
    };

    const constrain = (v: number): number => {
        let out = v;
        if (min !== undefined) out = Math.max(min, out);
        if (max !== undefined) out = Math.min(max, out);
        return out;
    };

    const commit = (raw: string) => {
        const result = evaluateExpression(raw);
        const clean = raw.replace(/,/g, '').trim();
        const fallback = parseFloat(clean) || 0;
        const evaluated = result !== null ? result : fallback;
        const constrained = constrain(evaluated);
        setDisplayValue(constrained > 0 ? formatWithCommas(constrained) : (constrained === 0 ? '0' : ''));
        setIsExpression(false);
        setPreview(null);
        onChange(constrained);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;

        // Check if user is typing an expression: math symbols or thousand abbreviations
        const hasOperators = /[+\-*/kك]/i.test(raw) || /ألف|الف/.test(raw);
        setIsExpression(hasOperators);

        if (hasOperators) {
            setDisplayValue(raw);
            const result = evaluateExpression(raw);
            setPreview(result !== null ? constrain(result) : null);
        } else {
            // Plain number entry: strip commas first
            const clean = raw.replace(/,/g, '').trim();

            if (clean === '') {
                setDisplayValue('');
                setPreview(null);
                onChange(0);
                return;
            }

            // Allow trailing decimal point while typing, e.g. "40."
            if (clean.endsWith('.')) {
                const numPart = clean.slice(0, -1);
                const formatted = formatWithCommas(numPart) + '.';
                setDisplayValue(formatted);
                const num = parseFloat(numPart) || 0;
                onChange(constrain(num));
                setPreview(null);
                return;
            }

            const num = parseFloat(clean);
            if (isNaN(num) || !isFinite(num)) {
                setDisplayValue(raw);
                return;
            }

            const constrained = constrain(num);
            onChange(constrained);
            setPreview(null);

            // Format with commas
            const formatted = formatWithCommas(clean);

            // Calculate non-comma cursor offset to maintain natural typing cursor
            const input = inputRef.current;
            const cursorPos = input?.selectionStart || 0;
            const nonCommasBeforeCursor = raw.slice(0, cursorPos).replace(/,/g, '').length;

            setDisplayValue(formatted);

            requestAnimationFrame(() => {
                if (!inputRef.current) return;
                let newCursor = 0;
                let counted = 0;
                for (let i = 0; i < formatted.length; i++) {
                    if (formatted[i] !== ',') {
                        counted++;
                    }
                    if (counted === nonCommasBeforeCursor) {
                        newCursor = i + 1;
                        break;
                    }
                }
                inputRef.current.setSelectionRange(newCursor, newCursor);
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit(displayValue);
        }
    };

    const handleBlur = () => {
        if (isExpression) {
            commit(displayValue);
        } else if (displayValue) {
            // Ensure clean formatting on blur
            const clean = displayValue.replace(/,/g, '').trim();
            const num = parseFloat(clean);
            if (!isNaN(num) && isFinite(num)) {
                const constrained = constrain(num);
                setDisplayValue(constrained > 0 ? formatWithCommas(constrained) : (constrained === 0 ? '0' : ''));
            }
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={handleFocus}
                placeholder={placeholder}
                className={className}
                style={{
                    width: '100%',
                    ...(isExpression && {
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: 'rgb(59, 130, 246)',
                    }),
                }}
            />
            {isExpression && preview !== null && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-1.5rem',
                        insetInlineStart: 0,
                        fontSize: '0.75rem',
                        color: '#3b82f6',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                >
                    = {preview.toLocaleString('en-IQ')} IQD
                </div>
            )}
        </div>
    );
};

export default CalculatorInput;
