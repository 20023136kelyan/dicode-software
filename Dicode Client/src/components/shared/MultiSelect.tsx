import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  maxDisplay?: number;
  searchable?: boolean;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  label,
  maxDisplay = 3,
  searchable = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const toggleOption = (optionId: string) => {
    if (selected.includes(optionId)) {
      onChange(selected.filter(id => id !== optionId));
    } else {
      onChange([...selected, optionId]);
    }
  };

  const removeOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(id => id !== optionId));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort options: selected first, then unselected
  const sortedOptions = [...filteredOptions].sort((a, b) => {
    const aSelected = selected.includes(a.id);
    const bSelected = selected.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const selectedOptions = options.filter(opt => selected.includes(opt.id));
  const displayedChips = selectedOptions.slice(0, maxDisplay);
  const remainingCount = selectedOptions.length - maxDisplay;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-dark-text mb-2 block">{label}</label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] rounded-xl border bg-dark-bg px-3 py-2 text-left transition flex items-center gap-2 ${
          isOpen 
            ? 'border-primary ring-2 ring-primary/20' 
            : 'border-dark-border hover:border-dark-border/80'
        }`}
      >
        <div className="flex-1 flex flex-wrap gap-1.5 items-center min-h-[28px]">
          {selected.length === 0 ? (
            <span className="text-sm text-dark-text-muted">{placeholder}</span>
          ) : (
            <>
              {displayedChips.map(option => (
                <span
                  key={option.id}
                  className="inline-flex items-center gap-1 rounded-md bg-dark-card border border-dark-border px-2 py-1 text-xs font-medium text-dark-text"
                >
                  {option.label}
                  <button
                    type="button"
                    onClick={(e) => removeOption(option.id, e)}
                    className="text-dark-text-muted hover:text-dark-text transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  +{remainingCount}
                </span>
              )}
            </>
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-1 text-dark-text-muted hover:text-dark-text transition rounded"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-dark-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-dark-border bg-dark-card shadow-xl overflow-hidden">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-dark-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-lg border border-dark-border bg-dark-bg pl-9 pr-3 py-2 text-sm text-dark-text placeholder:text-dark-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {sortedOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-dark-text-muted">
                No options found
              </div>
            ) : (
              <>
                {/* Selected Section */}
                {selected.length > 0 && searchQuery === '' && (
                  <div className="px-3 py-2 text-xs font-medium text-dark-text-muted uppercase tracking-wider bg-dark-bg/50">
                    Selected ({selected.length})
                  </div>
                )}
                
                {sortedOptions.map((option, index) => {
                  const isSelected = selected.includes(option.id);
                  const isFirstUnselected = !isSelected && index > 0 && selected.includes(sortedOptions[index - 1]?.id);
                  
                  return (
                    <React.Fragment key={option.id}>
                      {/* Divider between selected and unselected */}
                      {isFirstUnselected && searchQuery === '' && (
                        <div className="px-3 py-2 text-xs font-medium text-dark-text-muted uppercase tracking-wider bg-dark-bg/50 border-t border-dark-border">
                          Available
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => toggleOption(option.id)}
                        className={`w-full px-3 py-2.5 flex items-start gap-3 text-left transition ${
                          isSelected 
                            ? 'bg-primary/5' 
                            : 'hover:bg-dark-bg'
                        }`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition ${
                          isSelected 
                            ? 'border-primary bg-primary text-white' 
                            : 'border-dark-border'
                        }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isSelected ? 'text-dark-text' : 'text-dark-text'}`}>
                            {option.label}
                          </p>
                          {option.description && (
                            <p className="text-xs text-dark-text-muted mt-0.5 line-clamp-1">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;

