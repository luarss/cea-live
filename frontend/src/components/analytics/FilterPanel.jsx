import { useState, useRef, useEffect } from 'react';
import { PROPERTY_TYPES, TRANSACTION_TYPES, REPRESENTATION_TYPES } from '../../lib/format';
import { ChevronDownIcon, CheckIcon } from '../ui/Icons';

const FILTER_FIELDS = [
  { field: 'property_type', label: 'Property', options: PROPERTY_TYPES },
  { field: 'transaction_type', label: 'Deal type', options: TRANSACTION_TYPES },
  { field: 'represented', label: 'Acting for', options: REPRESENTATION_TYPES },
];

function MultiSelectDropdown({ label, options, selected = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (value) => {
    const newSelected = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return 'Any';
    if (selected.length === 1) {
      return options.find(option => option.value === selected[0])?.label || selected[0];
    }
    return `${selected.length} selected`;
  };

  const isActive = selected.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`h-9 pl-4 pr-3 rounded-full border text-sm flex items-center gap-2 transition-colors duration-150 ${
          isActive
            ? 'bg-signal-wash border-signal text-ink'
            : 'bg-white border-[#c9c9c5] text-ink hover:border-ink'
        }`}
      >
        <span className="text-ink-muted">{label}</span>
        <span className="font-semibold">{getDisplayText()}</span>
        <ChevronDownIcon className={`w-4 h-4 text-ink-soft transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 left-0 mt-2 min-w-[220px] bg-white border border-ink shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1">
          {options.map(({ value, label: optionLabel }) => {
            const isChecked = selected.includes(value);
            return (
              <label
                key={value}
                className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-wash"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(value)}
                  className="peer sr-only"
                />
                <span
                  className={`w-4 h-4 border flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-signal ${
                    isChecked ? 'bg-ink border-ink text-white' : 'border-[#8a8a86] bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isChecked && <CheckIcon className="w-3 h-3" />}
                </span>
                <span>{optionLabel}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ filters, onFiltersChange, isUpdating }) {
  const handleFilterChange = (field, values) => {
    onFiltersChange({
      ...filters,
      [field]: values.length > 0 ? values : undefined
    });
  };

  const hasActiveFilters = Object.values(filters).some(values => values?.length > 0);

  return (
    <div className="border-b border-rule bg-white">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-2">
        {FILTER_FIELDS.map(({ field, label, options }) => (
          <MultiSelectDropdown
            key={field}
            label={label}
            options={options}
            selected={filters[field] || []}
            onChange={(values) => handleFilterChange(field, values)}
          />
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onFiltersChange({})}
            className="h-9 px-3 text-sm font-semibold text-ink-soft underline underline-offset-4 decoration-[#c9c9c5] hover:text-ink hover:decoration-ink"
          >
            Clear filters
          </button>
        )}
        <span className={`ml-auto text-sm text-ink-muted transition-opacity duration-200 ${isUpdating ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
          {isUpdating ? 'Updating…' : ''}
        </span>
      </div>
    </div>
  );
}
