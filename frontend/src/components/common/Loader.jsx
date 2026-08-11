// src/components/common/Loader.jsx
import { useThemeContext } from '../../context/ThemeContext';

export default function Loader({ size = 'md', fullScreen = false }) {
  const { darkMode, getBrandPrimary, getBrandSecondary } = useThemeContext();
  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';

  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-14 h-14 border-4',
  };

  const loader = (
    <div className="relative flex items-center justify-center">
      <div className={`
        ${sizeClasses[size]} 
        rounded-full 
        border-t-transparent 
        animate-spin
        bg-gradient-to-r from-[${primaryColor}] to-[${secondaryColor}]
        p-[2px]
      `} style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }} />
      <div className="absolute inset-0 rounded-full blur-sm opacity-50" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }} />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          {loader}
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return loader;
}