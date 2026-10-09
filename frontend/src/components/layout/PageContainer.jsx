// src/components/layout/PageContainer.jsx
import { motion } from 'framer-motion';
import { useThemeContext } from '../../context/ThemeContext';

export default function PageContainer({ 
  title, 
  subtitle, 
  children, 
  actions,        // optional array of action buttons
  className = '' 
}) {
  const { darkMode, getBrandPrimary, getBrandSecondary } = useThemeContext();
  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`space-y-6 ${className}`}
    >
      {/* Header Section with decorative accent line */}
      <div className="relative">
        {/* Animated accent bar using orange/red gradient on hover */}
        <div className="absolute -top-2 left-0 h-1 w-12 rounded-full bg-gradient-to-r from-[#E63F2E] to-[#E03A3A] group-hover:w-full transition-all duration-500" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight
                           text-slate-800 dark:text-slate-100
                           hover:text-[#064789] dark:hover:text-[#427aa1] 
                           transition-colors duration-200">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Optional action buttons */}
          {actions && (
            <div className="flex gap-3">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className="px-4 py-2 text-sm font-medium rounded-xl
                           transition-all duration-200 hover:scale-105
                           focus:outline-none focus:ring-2 focus:ring-offset-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: action.variant === 'primary' 
                      ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                      : darkMode 
                        ? 'rgba(66, 122, 161, 0.15)' 
                        : 'rgba(6, 71, 137, 0.08)',
                    color: action.variant === 'primary' 
                      ? 'white' 
                      : darkMode ? secondaryColor : primaryColor,
                    border: action.variant !== 'primary' 
                      ? `1px solid ${darkMode ? `${secondaryColor}50` : `${primaryColor}30`}`
                      : 'none',
                    boxShadow: action.variant === 'primary' && darkMode 
                      ? `0 0 10px ${secondaryColor}80` 
                      : 'none',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Subtle bottom border with accent on hover */}
        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent 
                      via-slate-200 dark:via-slate-700 to-transparent
                      group-hover:via-[#E63F2E] transition-all duration-500" />
      </div>
      
      {/* Main Content */}
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}
