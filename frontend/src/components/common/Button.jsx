import { forwardRef } from 'react';
import { useThemeContext } from '../../context/ThemeContext';

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    loading = false,
    disabled = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    fullWidth = false,
    type = 'button',
    ...props
  },
  ref
) {
  const { darkMode, getBrandPrimary, getBrandSecondary } = useThemeContext();
  const primary = getBrandPrimary?.() || '#064789';
  const secondary = getBrandSecondary?.() || '#427aa1';

  const isDisabled = disabled || loading;

  const sizeClasses = {
    sm: 'px-3.5 py-2 text-sm rounded-lg gap-1.5',
    md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-2',
    icon: 'p-2.5 rounded-xl',
  };

  const base =
    'relative inline-flex items-center justify-center font-semibold tracking-tight ' +
    'transition-all duration-200 ease-out select-none whitespace-nowrap ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ' +
    'active:scale-[0.97]';

  // ---------- Variant styles ----------
  const variantStyles = {
    primary: {
      style: {
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        boxShadow: darkMode
          ? `0 4px 14px ${primary}40`
          : `0 4px 14px ${primary}30`,
        color: '#fff',
      },
      className: 'hover:shadow-lg hover:brightness-110 focus-visible:ring-[var(--btn-ring)]',
      cssVars: { '--btn-ring': secondary },
    },
    secondary: {
      style: darkMode
        ? { color: secondary, borderColor: secondary, backgroundColor: 'transparent' }
        : { color: primary, borderColor: primary, backgroundColor: 'transparent' },
      className:
        'border-2 hover:scale-[1.02] focus-visible:ring-[var(--btn-ring)] ' +
        (darkMode
          ? 'hover:bg-white/5'
          : 'hover:bg-black/[0.03]'),
      cssVars: { '--btn-ring': darkMode ? secondary : primary },
    },
    outline: {
      style: {},
      className:
        'border transition-colors focus-visible:ring-[var(--btn-ring)] ' +
        (darkMode
          ? 'border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'),
      cssVars: { '--btn-ring': secondary },
    },
    ghost: {
      style: {},
      className:
        'transition-colors focus-visible:ring-[var(--btn-ring)] ' +
        (darkMode
          ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'),
      cssVars: { '--btn-ring': secondary },
    },
    danger: {
      style: {},
      className:
        'text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 ' +
        'focus-visible:ring-rose-500',
    },
    success: {
      style: {},
      className:
        'text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 ' +
        'focus-visible:ring-emerald-500',
    },
  };

  const v = variantStyles[variant] || variantStyles.primary;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={isDisabled}
      style={{ ...v.style, ...v.cssVars, ...props.style }}
      className={[
        base,
        sizeClasses[size],
        v.className,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading ? (
        <>
          <Spinner />
          <span>Loading…</span>
        </>
      ) : (
        <>
          {LeftIcon && <LeftIcon className="h-4 w-4 shrink-0" />}
          {children}
          {RightIcon && <RightIcon className="h-4 w-4 shrink-0" />}
        </>
      )}
    </button>
  );
});

export default Button;
