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
 * A number input that also works as a calculator.
 * Users can type expressions like "40+50+45" and press Enter to calculate the result.
 * Supports basic operations: +, -, *, /
 */
const CalculatorInput: React.FC<CalculatorInputProps> = ({
    value,
    onChange,
    min,
    max,
    placeholder,
    className,
}) => {
    // Display value can be a number or an expression being typed
    const [displayValue, setDisplayValue] = useState<string>(String(value));
    const [isExpression, setIsExpression] = useState(false);

    // Sync display value when external value changes
    useEffect(() => {
        if (!isExpression) {
            setDisplayValue(String(value));
        }
    }, [value, isExpression]);

    const evaluateExpression = (expression: string): number | null => {
        try {
            // Remove whitespace
            const cleanExpr = expression.replace(/\s/g, '');

            // Check if it's a valid expression (only contains numbers and operators)
            if (!/^[\d+\-*/().]+$/.test(cleanExpr)) {
                return null;
            }

            // Check for dangerous patterns (like function calls)
            if (/[a-zA-Z]/.test(cleanExpr)) {
                return null;
            }

            // Safely evaluate the expression using Function constructor
            // This is safer than eval as it creates an isolated scope
            const result = new Function(`return ${cleanExpr}`)();

            if (typeof result !== 'number' || !isFinite(result)) {
                return null;
            }

            return result;
        } catch {
            return null;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setDisplayValue(newValue);

        // Check if this looks like an expression (contains operators)
        const hasOperators = /[+\-*/]/.test(newValue);
        setIsExpression(hasOperators);

        // If it's just a number, update immediately
        if (!hasOperators) {
            const numValue = parseFloat(newValue) || 0;
            let constrainedValue = numValue;
            if (min !== undefined) constrainedValue = Math.max(min, constrainedValue);
            if (max !== undefined) constrainedValue = Math.min(max, constrainedValue);
            onChange(constrainedValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            const result = evaluateExpression(displayValue);

            if (result !== null) {
                let constrainedValue = result;
                if (min !== undefined) constrainedValue = Math.max(min, constrainedValue);
                if (max !== undefined) constrainedValue = Math.min(max, constrainedValue);

                setDisplayValue(String(constrainedValue));
                setIsExpression(false);
                onChange(constrainedValue);
            } else {
                // If evaluation fails, try to parse as a simple number
                const numValue = parseFloat(displayValue) || 0;
                let constrainedValue = numValue;
                if (min !== undefined) constrainedValue = Math.max(min, constrainedValue);
                if (max !== undefined) constrainedValue = Math.min(max, constrainedValue);

                setDisplayValue(String(constrainedValue));
                setIsExpression(false);
                onChange(constrainedValue);
            }
        }
    };

    const handleBlur = () => {
        // On blur, if there's an expression, try to evaluate it
        if (isExpression) {
            const result = evaluateExpression(displayValue);
            if (result !== null) {
                let constrainedValue = result;
                if (min !== undefined) constrainedValue = Math.max(min, constrainedValue);
                if (max !== undefined) constrainedValue = Math.min(max, constrainedValue);

                setDisplayValue(String(constrainedValue));
                setIsExpression(false);
                onChange(constrainedValue);
            } else {
                // Revert to the actual value
                setDisplayValue(String(value));
                setIsExpression(false);
            }
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    return (
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
                // Add a subtle indicator when in expression mode
                ...(isExpression && {
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: 'rgb(59, 130, 246)',
                }),
            }}
        />
    );
};

export default CalculatorInput;
