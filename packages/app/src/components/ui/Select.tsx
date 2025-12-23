import * as BaseSelect from "@base-ui-components/react/select";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Label for the select */
  label?: string;
  /** Currently selected value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available options */
  options: SelectOption[];
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional className for the trigger */
  className?: string;
}

/**
 * Select dropdown component built on base-ui Select.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Priority"
 *   value={priority}
 *   onChange={setPriority}
 *   options={[
 *     { value: "low", label: "Low" },
 *     { value: "medium", label: "Medium" },
 *     { value: "high", label: "High" },
 *   ]}
 * />
 * ```
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error,
  className,
}: SelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-dark-text">{label}</label>
      )}
      <BaseSelect.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <BaseSelect.Trigger
          className={clsx(
            "flex items-center justify-between w-full px-3 py-2",
            "bg-dark-surface border rounded-lg text-dark-text text-sm",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
            error ? "border-rose-500" : "border-dark-border",
            className
          )}
        >
          <BaseSelect.Value placeholder={placeholder}>
            {selectedOption?.label || placeholder}
          </BaseSelect.Value>
          <BaseSelect.Icon className="text-dark-muted">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </BaseSelect.Icon>
        </BaseSelect.Trigger>

        <BaseSelect.Portal>
          <BaseSelect.Positioner sideOffset={4}>
            <BaseSelect.Popup
              className={clsx(
                "bg-dark-surface border border-dark-border rounded-lg shadow-lg",
                "py-1 min-w-[8rem] overflow-hidden z-50"
              )}
            >
              {options.map((option) => (
                <BaseSelect.Option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                    "text-dark-text hover:bg-dark-hover",
                    "focus:outline-none focus:bg-dark-hover",
                    "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
                    "data-[selected]:bg-accent/10 data-[selected]:text-accent"
                  )}
                >
                  <BaseSelect.OptionIndicator className="text-accent">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </BaseSelect.OptionIndicator>
                  <BaseSelect.OptionText>
                    {option.label}
                  </BaseSelect.OptionText>
                </BaseSelect.Option>
              ))}
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
