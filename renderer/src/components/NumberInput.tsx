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

        return (
            <input
                type="number"
                ref={ref}
                {...props}
                onFocus={handleFocus}
            />
        );
    }
);

NumberInput.displayName = 'NumberInput';

export default NumberInput;
