// src/components/common/Modal.jsx
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';

export default function Modal({ open, title, children, onClose, size = 'md', showCloseButton = true }) {
  const { darkMode, getBrandPrimary } = useThemeContext();
  const primaryColor = getBrandPrimary?.() || '#064789';

  // Prevent body scroll when modal open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] h-[90vh]',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 ${sizeClasses[size]} p-4`}
          >
            <div className={`
              rounded-2xl shadow-2xl overflow-visible
              backdrop-blur-xl border
              ${darkMode 
                ? 'bg-slate-900/80 border-[#427aa1]/30' 
                : 'bg-white/90 border-[#064789]/20'
              }
            `}>
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    {title}
                  </h2>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </button>
                  )}
                </div>
              )}
              {/* Content */}
              <div className="p-6">
                {children}
              </div>
              {/* Optional footer can be added via children composition */}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
