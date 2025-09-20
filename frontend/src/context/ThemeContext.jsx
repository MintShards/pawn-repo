import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Initialize theme from localStorage immediately
    const savedTheme = localStorage.getItem('pawn_repo_theme') || localStorage.getItem('pawn_shop_theme');
    return savedTheme || 'dark'; // Default to dark if no saved theme
  });

  useEffect(() => {
    // Handle theme migration if needed
    if (localStorage.getItem('pawn_shop_theme') && !localStorage.getItem('pawn_repo_theme')) {
      const oldTheme = localStorage.getItem('pawn_shop_theme');
      localStorage.setItem('pawn_repo_theme', oldTheme);
      localStorage.removeItem('pawn_shop_theme');
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    
    // Add transitioning class to prevent FOUC
    root.classList.add('theme-transitioning');
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Remove transitioning class after a short delay
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 0);
    
    // Save theme to localStorage
    localStorage.setItem('pawn_repo_theme', theme);
    
    // Set data-theme attribute for prefers-color-scheme override
    root.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const setLightTheme = () => setTheme('light');
  const setDarkTheme = () => setTheme('dark');

  const value = {
    theme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};