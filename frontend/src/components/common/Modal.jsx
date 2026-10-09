import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';

const SIZE_CLASSES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl sm:h-[88vh]',
};

export default function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
}) {
  const { darkMode } = useThemeContext();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Focus management + keyboard handling
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const focusTimer = setTimeout(() => {
      const focusables = dialogRef.current?.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'
      );
      focusables?.[0]?.focus();
    }, 60);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = [
        ...(dialogRef.current?.querySelectorAll(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'
        ) || []),
      ].filter((el) => el.offsetParent !== null);

      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Dialog wrapper */}
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={[
                'relative flex w-full flex-col overflow-hidden',
                'rounded-t-2xl sm:rounded-2xl',
                'border shadow-2xl',
                'max-h-[92vh] sm:max-h-[88vh]',
                SIZE_CLASSES[size] || SIZE_CLASSES.md,
                darkMode
                  ? 'border-slate-700/70 bg-slate-900/95 backdrop-blur-xl'
                  : 'border-slate-200 bg-white/95 backdrop-blur-xl',
              ].join(' ')}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />

              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4 sm:px-6 dark:border-slate-700/70">
                  <div className="min-w-0">
                    {title && (
                      <h2
                        id={titleId}
                        className="truncate text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100"
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {description}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close dialog"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="border-t border-slate-200/80 bg-slate-50/60 px-5 py-3.5 sm:px-6 dark:border-slate-700/70 dark:bg-slate-900/60">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
