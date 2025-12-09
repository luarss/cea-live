import { useState, useRef, useEffect } from 'react';

const PROPERTY_TYPES = [
  { value: 'CONDOMINIUM_APARTMENTS', label: 'Condominium/Apartments' },
  { value: 'HDB', label: 'HDB' },
  { value: 'LANDED', label: 'Landed' },
  { value: 'EXECUTIVE_CONDOMINIUM', label: 'Executive Condominium' },
  { value: 'STRATA_LANDED', label: 'Strata Landed' }
];

const TRANSACTION_TYPES = [
  { value: 'WHOLE RENTAL', label: 'Whole Rental' },
  { value: 'RESALE', label: 'Resale' },
  { value: 'ROOM RENTAL', label: 'Room Rental' },
  { value: 'NEW SALE', label: 'New Sale' },
  { value: 'SUB-SALE', label: 'Sub-Sale' }
];

const REPRESENTATION_TYPES = [
  { value: 'LANDLORD', label: 'Landlord' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'BUYER', label: 'Buyer' },
  { value: 'TENANT', label: 'Tenant' }
];

function MultiSelectDropdown({ label, options, selected = [], onChange, fieldName }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = (value) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return 'All';
    if (selected.length === 1) {
      return options.find(o => o.value === selected[0])?.label || selected[0];
    }
    return `${selected.length} selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-left bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className={`text-sm ${selected.length === 0 ? 'text-gray-500' : 'text-gray-900'}`}>
            {getDisplayText()}
          </span>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <button
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear selection"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="py-1">
            {options.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() => handleToggle(value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-3 text-sm text-gray-700">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ filters, onFiltersChange }) {
  const handleFilterChange = (field, values) => {
    onFiltersChange({
      ...filters,
      [field]: values.length > 0 ? values : undefined
    });
  };

  const handleReset = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => filters[key]?.length > 0);
  const activeFilterCount = Object.values(filters).filter(v => v?.length > 0).length;

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
          {hasActiveFilters && (
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Reset All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MultiSelectDropdown
          label="Property Type"
          options={PROPERTY_TYPES}
          selected={filters.property_type || []}
          onChange={(values) => handleFilterChange('property_type', values)}
          fieldName="property_type"
        />

        <MultiSelectDropdown
          label="Transaction Type"
          options={TRANSACTION_TYPES}
          selected={filters.transaction_type || []}
          onChange={(values) => handleFilterChange('transaction_type', values)}
          fieldName="transaction_type"
        />

        <MultiSelectDropdown
          label="Representation"
          options={REPRESENTATION_TYPES}
          selected={filters.represented || []}
          onChange={(values) => handleFilterChange('represented', values)}
          fieldName="represented"
        />
      </div>
    </div>
  );
}
