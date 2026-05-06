import React, { useState, useEffect } from 'react';

interface CalculatorInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    placeholder?: string;
    className?: string;
}

/**
 * A number input that works as a calculator.
 * - Type "40+50+45" → press Enter → evaluates to 135
 * - Type "30k"      → evaluates to 30,000  (k = ×1,000)
 * - Type "30k+50k"  → evaluates to 80,000
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
    const [displayValue, setDisplayValue] = useState<string>(String(value));
    const [isExpression, setIsExpression] = useState(false);
    const [preview, setPreview] = useState<number | null>(null);

    // Sync display when external value changes (only when not mid-expression)
    useEffect(() => {
        if (!isExpression) {
            setDisplayValue(String(value));
        }
    }, [value, isExpression]);

    /** Expand 'k' shorthand: "30k" → "(30*1000)" */
    const expandK = (expr: string): string =>
        expr.replace(/(\d+(?:\.\d+)?)k/gi, '($1*1000)');

    const evaluateExpression = (expression: string): number | null => {
        try {
            const expanded = expandK(expression.replace(/\s/g, ''));
            // After expanding k, only digits and math operators should remain
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
        const constrained = constrain(result !== null ? result : (parseFloat(raw) || 0));
        setDisplayValue(String(constrained));
        setIsExpression(false);
        setPreview(null);
        onChange(constrained);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setDisplayValue(raw);

        // 'k' counts as an operator/expression indicator
        const hasOperators = /[+\-*/k]/i.test(raw);
        setIsExpression(hasOperators);

        if (!hasOperators) {
            onChange(constrain(parseFloat(raw) || 0));
            setPreview(null);
        } else {
            const result = evaluateExpression(raw);
            setPreview(result !== null ? constrain(result) : null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit(displayValue);
        }
    };

    const handleBlur = () => {
        if (isExpression) commit(displayValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <input
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
                        left: 0,
                        fontSize: '0.75rem',
                        color: '#3b82f6',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                >
                    = {preview.toLocaleString('en-IQ')}
                </div>
            )}
        </div>
    );
};

export default CalculatorInput;
