import React from 'react';
import { Button } from './button';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

const ThemeToggle = ({ className = "", size = "default", variant = "ghost" }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn(
        "relative",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode. Currently using ${theme} mode.`}
      aria-pressed={theme === 'dark'}
    >
      {/* Sun icon for light mode */}
      <svg
        className={`h-4 w-4 transition-all ${
          theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" strokeWidth="2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        />
      </svg>

      {/* Moon icon for dark mode */}
      <svg
        className={`absolute h-4 w-4 transition-all ${
          theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
      <span className="sr-only">
        Toggle theme. Currently using {theme} mode.
      </span>
    </Button>
  );
};

export { ThemeToggle };