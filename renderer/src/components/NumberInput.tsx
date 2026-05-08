import React from 'react';

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    // You can add custom props here if needed
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    (props, ref) => {
        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            e.target.select();
            props.onFocus?.(e);
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            // Guard against NaN/Infinity propagating to parent
            const raw = e.target.value;
            const num = parseFloat(raw);
            if (raw !== '' && (isNaN(num) || !isFinite(num))) {
                // Override the value to 0 to prevent NaN corruption
                const syntheticEvent = {
                    ...e,
                    target: { ...e.target, value: '0' },
                } as React.ChangeEvent<HTMLInputElement>;
                props.onChange?.(syntheticEvent);
                return;
            }
            props.onChange?.(e);
        };

        return (
            <input
                type="number"
                ref={ref}
                {...props}
                onFocus={handleFocus}
                onChange={handleChange}
            />
        );
    }
);

NumberInput.displayName = 'NumberInput';

export default NumberInput;

