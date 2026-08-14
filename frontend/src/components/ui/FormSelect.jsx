import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Select input.
 *
 * Two modes, one prop contract:
 *  - default        → a native <select>, which gets keyboard and mobile
 *                     behaviour for free
 *  - `searchable`   → a filterable listbox, for long lists like product pickers
 *
 * `onChange` always receives an event-shaped object (`{ target: { name, value } }`),
 * so React Hook Form's `register` works in both modes.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {string} [props.value]
 * @param {(event: { target: { name: string, value: string } }) => void} props.onChange
 * @param {{ value: string, label: string }[]} props.options
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {boolean} [props.searchable]
 * @param {boolean} [props.clearable]
 * @param {boolean} [props.loading] async option loading
 */
export const FormSelect = forwardRef(function FormSelect(
  {
    label,
    name,
    value = '',
    onChange,
    options = [],
    error,
    required = false,
    searchable = false,
    clearable = false,
    loading = false,
    disabled = false,
    placeholder = 'Select…',
    className,
    ...rest
  },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;

  const emit = (nextValue) =>
    onChange?.({ target: { name, value: nextValue } });

  const controlClasses = cn(
    'w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm text-text',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed disabled:opacity-60',
    error ? 'border-danger' : 'border-border',
  );

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        {searchable ? (
          <SearchableSelect
            id={id}
            value={value}
            options={options}
            disabled={disabled || loading}
            placeholder={placeholder}
            describedBy={describedBy}
            invalid={Boolean(error)}
            className={controlClasses}
            onSelect={emit}
          />
        ) : (
          <select
            ref={ref}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled || loading}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(controlClasses, 'appearance-none pr-8')}
            {...rest}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {/* Trailing affordances. Stacked right-to-left: spinner, clear, chevron. */}
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
          {loading && (
            <Loader2 size={14} className="animate-spin text-text-muted" />
          )}
          {clearable && value && !loading && (
            <button
              type="button"
              onClick={() => emit('')}
              disabled={disabled}
              aria-label={`Clear ${label}`}
              className="pointer-events-auto rounded-sm text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={14} />
            </button>
          )}
          {!searchable && !loading && (
            <ChevronDown size={14} className="text-text-muted" />
          )}
        </div>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

/** Filterable listbox used when `searchable` is set. */
function SearchableSelect({
  id,
  value,
  options,
  disabled,
  placeholder,
  describedBy,
  invalid,
  className,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selected = options.find((option) => option.value === value);
  const visible = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  // Close when focus or a click leaves the component.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (option) => {
    onSelect(option.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className={cn(className, 'pr-8')}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? '')}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && open && visible.length > 0) {
            event.preventDefault();
            choose(visible[0]);
          }
        }}
      />

      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {visible.length === 0 && (
            <li className="px-2.5 py-1.5 text-sm text-text-muted">
              No matches
            </li>
          )}
          {visible.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => choose(option)}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm text-text hover:bg-bg focus-visible:bg-bg focus-visible:outline-none"
              >
                {option.label}
                {option.value === value && (
                  <Check size={14} className="text-primary" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
