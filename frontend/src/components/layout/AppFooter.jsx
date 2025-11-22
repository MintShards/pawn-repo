import React from 'react';
import { Github, Heart, AlertCircle, Info, Layers } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Configuration from environment variables with fallbacks (static constant)
const CONFIG = {
  appName: process.env.REACT_APP_NAME || 'Pawn Repo',
  appVersion: process.env.REACT_APP_VERSION || '0.1.0',
  githubUsername: process.env.REACT_APP_GITHUB_USERNAME || 'MintShards',
  repoUrl: process.env.REACT_APP_REPO_URL || 'https://github.com/MintShards/pawn-repo',
  companyName: process.env.REACT_APP_COMPANY_NAME || 'CashNow Solutions',
  environment: process.env.NODE_ENV || 'development',
};

// Tech stack information (static constant)
const TECH_STACK = [
  { name: 'React', version: '19', category: 'Frontend Framework' },
  { name: 'ShadCN UI', version: 'Latest', category: 'UI Components' },
  { name: 'Tailwind CSS', version: '3.4', category: 'Styling' },
  { name: 'FastAPI', version: '3.x', category: 'Backend Framework' },
  { name: 'MongoDB', version: 'Latest', category: 'Database' },
  { name: 'Beanie ODM', version: 'Latest', category: 'Database ORM' },
];

/**
 * Unified application footer component
 * Appears on all authenticated pages with GitHub info, app metadata, and quick links
 *
 * Features:
 * - Dynamic build information with tooltips
 * - Tech stack display with interactive tooltips
 * - Responsive design with mobile-optimized layout
 * - Dark/light theme support with smooth transitions
 * - Accessible with ARIA labels and semantic HTML
 * - Environment-aware configuration
 * - Full keyboard navigation support (WCAG 2.1 compliant)
 *
 * Performance Optimizations:
 * - Static config and tech stack constants (no re-creation on render)
 * - useMemo for computed values (buildInfo, currentYear)
 * - Single TooltipProvider for all tooltips
 */
const AppFooter = () => {
  // Computed once on mount
  const currentYear = React.useMemo(() => new Date().getFullYear(), []);

  // Build information computed once on mount
  const buildInfo = React.useMemo(() => {
    const buildDate = process.env.REACT_APP_BUILD_DATE || new Date().toISOString();
    const buildCommit = process.env.REACT_APP_BUILD_COMMIT || 'local';

    return {
      date: new Date(buildDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      commit: buildCommit.substring(0, 7),
      environment: CONFIG.environment
    };
  }, []); // Empty deps - computed once on mount

  return (
    <footer
      className="w-full border-t border-slate-200/60 dark:border-slate-800/60 bg-transparent transition-colors duration-300"
      role="contentinfo"
      aria-label="Application footer"
    >
      <TooltipProvider delayDuration={200}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6 text-slate-600 dark:text-slate-400">

            {/* Left section - Branding and Copyright */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              {/* App name */}
              <span className="text-lg font-bold bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent">
                {CONFIG.appName}
              </span>

              <Separator orientation="vertical" className="h-5 hidden sm:block" />

              {/* Copyright with All Rights Reserved */}
              <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                © {currentYear} <span className="font-medium">{CONFIG.companyName}</span>. All rights reserved.
              </span>
            </div>

            {/* Right section - Technical info and developer credits */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              {/* Version with tooltip showing build info */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="text-sm text-slate-500 dark:text-slate-400 cursor-help flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    tabIndex={0}
                    role="button"
                    aria-label="View build information and version details"
                  >
                    <Info className="h-4 w-4" />
                    <span className="font-medium">v{CONFIG.appVersion}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-1">
                    <p><strong>Version:</strong> {CONFIG.appVersion}</p>
                    <p><strong>Built:</strong> {buildInfo.date}</p>
                    <p><strong>Commit:</strong> {buildInfo.commit}</p>
                    <p><strong>Environment:</strong> {buildInfo.environment}</p>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-5 hidden sm:block" />

              {/* Tech Stack with tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex items-center gap-1.5 text-sm cursor-help px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200"
                    tabIndex={0}
                    role="button"
                    aria-label="View technology stack details"
                  >
                    <Layers className="h-4 w-4" />
                    <span className="hidden lg:inline font-medium">Tech Stack</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm mb-2">Technology Stack</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {TECH_STACK.map((tech, index) => (
                        <div key={index} className="flex flex-col">
                          <span className="font-medium">{tech.name} {tech.version}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{tech.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Environment indicator (dev/staging only) */}
              {CONFIG.environment !== 'production' && (
                <>
                  <Separator orientation="vertical" className="h-5 hidden sm:block" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 font-medium cursor-help"
                        tabIndex={0}
                        role="button"
                        aria-label={`Current environment: ${CONFIG.environment}`}
                      >
                        <AlertCircle className="h-4 w-4" />
                        {CONFIG.environment.toUpperCase()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>Running in {CONFIG.environment} mode</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}

              <Separator orientation="vertical" className="h-5 hidden sm:block" />

              {/* Built with love message */}
              <span className="hidden sm:flex items-center gap-1.5 text-sm">
                Built with <Heart className="h-4 w-4 text-red-500 fill-red-500" aria-label="love" /> by
              </span>

              {/* GitHub profile link */}
              <a
                href={`https://github.com/${CONFIG.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm px-1 -mx-1"
                aria-label={`GitHub profile of ${CONFIG.githubUsername}`}
              >
                <Github className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="font-medium">{CONFIG.githubUsername}</span>
              </a>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </footer>
  );
};

export default AppFooter;
