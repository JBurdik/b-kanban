import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

export interface CustomSelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface CustomSelectProps<T = string> {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  renderOption?: (option: CustomSelectOption<T>, isSelected: boolean) => React.ReactNode;
  renderValue?: (option: CustomSelectOption<T> | undefined) => React.ReactNode;
}

export function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  allowClear = false,
  renderOption,
  renderValue,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (option: CustomSelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm",
          "flex items-center justify-between gap-2",
          "hover:border-dark-hover focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
          "transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer"
        )}
      >
        <span className="flex-1 text-left truncate">
          {renderValue ? (
            renderValue(selectedOption)
          ) : selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon}
              <span>{selectedOption.label}</span>
            </span>
          ) : (
            <span className="text-dark-muted">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1">
          {allowClear && selectedOption && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-dark-hover rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={clsx("w-4 h-4 text-dark-muted transition-transform", isOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={clsx(
            "absolute z-50 w-full mt-1 py-1",
            "bg-dark-surface border border-dark-border rounded-lg shadow-xl",
            "max-h-60 overflow-y-auto"
          )}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-dark-muted">No options</div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={option.disabled}
                  className={clsx(
                    "w-full px-3 py-2 text-sm text-left",
                    "flex items-center gap-2",
                    "transition-colors",
                    isSelected
                      ? "bg-accent/20 text-accent"
                      : "text-dark-text hover:bg-dark-hover",
                    option.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {renderOption ? (
                    renderOption(option, isSelected)
                  ) : (
                    <>
                      {option.icon}
                      <span className="flex-1">{option.label}</span>
                      {isSelected && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
