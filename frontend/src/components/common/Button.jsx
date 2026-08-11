// src/components/common/Button.jsx
import { useThemeContext } from '../../context/ThemeContext';

export default function Button({ children, variant = 'primary', className = '', loading = false, ...props }) {
  const { darkMode, getBrandPrimary, getBrandSecondary } = useThemeContext();
  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';

  const baseClasses = 'relative inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-base font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group';
  
  const variants = {
    primary: darkMode
      ? `bg-gradient-to-r from-[${primaryColor}] to-[${secondaryColor}] text-white shadow-lg hover:shadow-xl hover:scale-105 focus:ring-[${secondaryColor}]`
      : `bg-gradient-to-r from-[${primaryColor}] to-[${secondaryColor}] text-white shadow-md hover:shadow-lg hover:scale-105 focus:ring-[${primaryColor}]`,
    secondary: darkMode
      ? 'border-2 border-[#427aa1] text-[#427aa1] bg-transparent hover:bg-[#427aa1]/10 hover:scale-105 focus:ring-[#427aa1]'
      : 'border-2 border-[#064789] text-[#064789] bg-transparent hover:bg-[#064789]/5 hover:scale-105 focus:ring-[#064789]',
    outline: darkMode
      ? 'border border-slate-600 text-slate-300 bg-transparent hover:bg-slate-800 hover:border-[#427aa1] hover:text-[#427aa1]'
      : 'border border-slate-300 text-slate-700 bg-transparent hover:bg-slate-50 hover:border-[#064789] hover:text-[#064789]',
  };

  // Apply gradient with inline style for dynamic colors
  const gradientStyle = (variant === 'primary') ? {
    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
    boxShadow: darkMode ? `0 0 10px ${secondaryColor}80` : `0 2px 8px ${primaryColor}60`,
  } : {};

  return (
    <button
      className={`${baseClasses} ${variants[variant] || variants.primary} ${className}`}
      style={variant === 'primary' ? gradientStyle : {}}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
      {/* Ripple overlay on hover */}
      <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none" />
    </button>
  );
}