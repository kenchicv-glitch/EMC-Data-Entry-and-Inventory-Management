import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface DscAutocompleteProps {
  value: string;
  onChange: (value: string, extraData?: any) => void;
  onSearch: (term: string) => Promise<any[]>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DscAutocomplete: React.FC<DscAutocompleteProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    onChange(term);

    if (term.length >= 2) {
      setIsLoading(true);
      setIsOpen(true);
      try {
        const data = await onSearch(term);
        setResults(data);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setResults([]);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (item: any) => {
    onChange(item.name || item.description, item);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-2 py-1 text-xs bg-transparent border-none outline-none focus:ring-0 placeholder:text-text-muted text-text-primary"
      />
      
      {isOpen && (isLoading || results.length > 0) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface border border-border-default rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {isLoading ? (
            <div className="px-4 py-2 text-[10px] text-text-muted animate-pulse">Searching...</div>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {results.map((item, index) => (
                <li
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-brand-red text-white' : 'hover:bg-subtle text-text-primary'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-tight">{item.name || item.description}</div>
                  {item.selling_price && (
                    <div className={`text-[9px] ${index === selectedIndex ? 'text-white/80' : 'text-text-muted'}`}>
                      ₱{Number(item.selling_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
