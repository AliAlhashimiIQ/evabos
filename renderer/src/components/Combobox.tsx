import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './Combobox.css';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
}

const Combobox: React.FC<ComboboxProps> = ({ value, onChange, options, placeholder, id }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Filter options based on current input value
  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes((value || '').toLowerCase())
  );

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="Combobox-wrapper" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        className="Combobox-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button 
        type="button" 
        className="Combobox-toggle"
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={-1}
      >
        <ChevronDown size={16} />
      </button>

      {isOpen && filteredOptions.length > 0 && (
        <ul className="Combobox-dropdown">
          {filteredOptions.map((option, index) => (
            <li 
              key={index} 
              className="Combobox-option"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Combobox;
