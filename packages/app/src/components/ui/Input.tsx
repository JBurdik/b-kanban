import { forwardRef, type InputHTMLAttributes } from "react";
import * as Field from "@base-ui-components/react/field";
import clsx from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label for the input */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text to display below input */
  helperText?: string;
}

/**
 * Input component with optional label and error state.
 * Built on base-ui Field component.
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="Enter your email"
 *   error={errors.email}
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <Field.Root className="flex flex-col gap-1">
        {label && (
          <Field.Label
            htmlFor={inputId}
            className="text-sm font-medium text-dark-text"
          >
            {label}
          </Field.Label>
        )}
        <Field.Control
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full px-3 py-2 bg-dark-surface border rounded-lg text-dark-text",
            "placeholder:text-dark-muted",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
            error ? "border-rose-500" : "border-dark-border",
            className
          )}
          render={<input />}
          {...props}
        />
        {error && (
          <Field.Error className="text-xs text-rose-400">{error}</Field.Error>
        )}
        {helperText && !error && (
          <Field.Description className="text-xs text-dark-muted">
            {helperText}
          </Field.Description>
        )}
      </Field.Root>
    );
  }
);

Input.displayName = "Input";

/**
 * Textarea component with optional label and error state.
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="Description"
 *   placeholder="Enter description..."
 *   rows={4}
 * />
 * ```
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <Field.Root className="flex flex-col gap-1">
        {label && (
          <Field.Label
            htmlFor={textareaId}
            className="text-sm font-medium text-dark-text"
          >
            {label}
          </Field.Label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            "w-full px-3 py-2 bg-dark-surface border rounded-lg text-dark-text",
            "placeholder:text-dark-muted",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors resize-none",
            error ? "border-rose-500" : "border-dark-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-dark-muted">{helperText}</p>
        )}
      </Field.Root>
    );
  }
);

Textarea.displayName = "Textarea";
