import { forwardRef } from 'react';
import { classNames } from '@/lib/utils';

type InputVariant = 'text' | 'email' | 'url' | 'number' | 'tel' | 'textarea' | 'select' | 'checkbox';

interface FieldProps {
  label: string;
  name: string;
  type?: InputVariant;
  value?: string | number | boolean;
  defaultValue?: string | number;
  defaultChecked?: boolean;
  placeholder?: string;
  error?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  step?: number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FieldProps>(
  ({ label, name, type = 'text', value, defaultValue, defaultChecked, placeholder, error, required, options, min, step, onChange }, ref) => {
    const baseClass = classNames(
      'w-full rounded-lg border border-ink-border bg-ink-surface px-3.5 py-2.5 text-sm text-text',
      'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-flame-500 focus:border-transparent',
      'transition-colors',
      error && 'border-red-400 focus:ring-red-500',
    );

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={name} className="text-sm font-medium text-text">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {type === 'textarea' && (
          <textarea
            id={name}
            name={name}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            value={value as string}
            defaultValue={defaultValue}
            placeholder={placeholder}
            required={required}
            rows={4}
            className={baseClass}
            onChange={onChange}
          />
        )}
        {type === 'select' && (
          <select
            id={name}
            name={name}
            ref={ref as React.Ref<HTMLSelectElement>}
            value={value as string}
            defaultValue={defaultValue}
            required={required}
            className={baseClass}
            onChange={onChange}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
        {type === 'checkbox' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id={name}
              name={name}
              type="checkbox"
              ref={ref as React.Ref<HTMLInputElement>}
              defaultChecked={defaultChecked}
              required={required}
              onChange={onChange}
              className="h-4 w-4 rounded border-ink-border bg-ink-surface text-flame-500 focus:ring-flame-500"
            />
            <span className="text-sm text-text">{placeholder || 'Yes'}</span>
          </label>
        )}
        {type !== 'textarea' && type !== 'select' && type !== 'checkbox' && (
          <input
            id={name}
            name={name}
            type={type}
            ref={ref as React.Ref<HTMLInputElement>}
            value={value as string | number}
            defaultValue={defaultValue}
            placeholder={placeholder}
            required={required}
            min={min}
            step={step}
            className={baseClass}
            onChange={onChange}
          />
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);

Field.displayName = 'Field';
