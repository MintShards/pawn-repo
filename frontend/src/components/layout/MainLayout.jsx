import React from 'react';
import AppFooter from './AppFooter';

/**
 * Main layout wrapper for authenticated pages
 * Provides consistent structure with header area, main content, and footer
 */
const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Main content area - flex-1 ensures it takes available space */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Application footer - always at bottom */}
      <AppFooter />
    </div>
  );
};

export default MainLayout;
