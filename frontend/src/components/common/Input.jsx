import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    label,
    type = 'text',
    icon: Icon,
    className = '',
    error,
    hint,
    success,
    required,
    rightElement,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasError = Boolean(error);

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}

      <div className="group relative">
        {Icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <Icon
              className={`h-4 w-4 transition-colors ${
                hasError
                  ? 'text-rose-500'
                  : 'text-slate-400 group-focus-within:text-slate-600 dark:group-focus-within:text-slate-300'
              }`}
            />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={[
            'w-full rounded-xl border bg-white/90 px-3.5 py-2.5 text-sm',
            'text-slate-800 shadow-sm outline-none transition-all duration-200',
            'placeholder:text-slate-400',
            'dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500',
            'disabled:cursor-not-allowed disabled:opacity-60',
            Icon ? 'pl-10' : '',
            isPassword || rightElement ? 'pr-10' : '',
            hasError
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/25 dark:border-rose-500/60'
              : success
              ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-emerald-500/60'
              : 'border-slate-200 hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:hover:border-slate-600 dark:focus:border-sky-400 dark:focus:ring-sky-400/30',
            className,
          ].join(' ')}
          {...props}
        />

        {isPassword && !rightElement && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:text-slate-600 focus-visible:outline-none dark:hover:text-slate-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        {rightElement && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>

      {error ? (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Input;