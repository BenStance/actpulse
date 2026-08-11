// src/components/common/Input.jsx
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Input({ 
  label, 
  type = 'text', 
  icon: Icon, 
  className = '', 
  error, 
  ...props 
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
        )}
        <input
          type={inputType}
          className={`
            w-full rounded-xl border bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
            px-3 py-2.5 text-slate-800 dark:text-slate-100
            outline-none transition-all duration-200
            border-slate-200 dark:border-slate-700
            focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:focus:ring-[#427aa1]/50
            disabled:opacity-60 disabled:cursor-not-allowed
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            ${Icon ? 'pl-9' : ''}
            ${isPassword ? 'pr-9' : ''}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}