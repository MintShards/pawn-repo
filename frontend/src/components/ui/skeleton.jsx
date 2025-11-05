import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-100 dark:bg-slate-800",
        className
      )}
      {...props}
    />
  );
}

// Customer table skeleton
function CustomerTableSkeleton({ rows = 8 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg border-slate-200 dark:border-slate-700">
          {/* Checkbox */}
          <Skeleton className="h-4 w-4 rounded" />
          
          {/* Avatar and name */}
          <div className="flex items-center space-x-3 flex-1">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </div>
          
          {/* Contact info */}
          <div className="space-y-2 hidden sm:block">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-3 w-[120px]" />
          </div>
          
          {/* Status badge */}
          <Skeleton className="h-6 w-16 rounded-full" />
          
          {/* Loan activity */}
          <div className="space-y-2 hidden md:block">
            <Skeleton className="h-3 w-[60px]" />
            <Skeleton className="h-2 w-[80px] rounded-full" />
          </div>
          
          {/* Last visit */}
          <div className="space-y-2 hidden lg:block">
            <Skeleton className="h-3 w-[70px]" />
            <Skeleton className="h-3 w-[50px]" />
          </div>
          
          {/* Actions */}
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Statistics cards skeleton
function StatsCardSkeleton() {
  return (
    <div className="p-4 pt-5 border rounded-lg border-slate-200 dark:border-slate-700 relative overflow-hidden">
      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
      
      <div className="flex items-center">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="ml-3 space-y-2">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-7 w-[50px]" />
        </div>
      </div>
    </div>
  );
}

// Search section skeleton
function SearchSkeleton() {
  return (
    <div className="p-4 pt-5 border rounded-lg border-slate-200 dark:border-slate-700 space-y-4 relative overflow-hidden">
      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
      
      {/* Main search row */}
      <div className="flex flex-col lg:flex-row gap-4">
        <Skeleton className="flex-1 h-10 rounded-lg" />
        <Skeleton className="lg:w-48 h-10 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[80px] rounded-lg" />
          <Skeleton className="h-10 w-[80px] rounded-lg" />
        </div>
      </div>
      
      {/* Advanced search */}
      <div className="border-t pt-4">
        <Skeleton className="h-4 w-[120px] mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Customer detail sheet skeleton
function CustomerDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-[150px]" />
          <Skeleton className="h-4 w-[120px]" />
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1 rounded" />
        ))}
      </div>
      
      {/* Content cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg border-slate-200 dark:border-slate-700">
            <div className="space-y-3">
              <Skeleton className="h-5 w-[100px]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[60%]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Settings form skeleton loaders
function SettingsFormSkeleton({ sections = 1 }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: sections }).map((_, sectionIdx) => (
        <div key={sectionIdx} className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          {/* Card Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-6 w-6 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-[180px]" />
                <Skeleton className="h-4 w-[240px]" />
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-4">
            {/* Form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, fieldIdx) => (
                <div key={fieldIdx} className="space-y-2">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-3 w-[160px]" />
                </div>
              ))}
            </div>

            {/* Textarea field */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-3 w-[180px]" />
            </div>

            {/* Last updated */}
            <Skeleton className="h-3 w-[220px]" />

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Skeleton className="h-10 w-[100px] rounded-md" />
              <Skeleton className="h-10 w-[160px] rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanyInfoSkeleton() {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
      {/* Card Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-6 w-6 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-[160px]" />
            <Skeleton className="h-4 w-[220px]" />
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Company name */}
        <div className="md:col-span-2 space-y-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* Logo upload */}
        <div className="md:col-span-2 space-y-3">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-16 w-32 rounded" />
          <Skeleton className="h-10 w-64 rounded-md" />
        </div>

        {/* Address fields grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* Last updated */}
        <Skeleton className="h-3 w-[220px]" />

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-10 w-[200px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

function PrinterConfigSkeleton() {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
      {/* Card Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-6 w-6 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-[160px]" />
            <Skeleton className="h-4 w-[240px]" />
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-6">
        {/* Info box */}
        <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[80%]" />
          <Skeleton className="h-8 w-[180px] rounded-md" />
        </div>

        {/* Printer fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-[180px]" />
            </div>
          ))}
        </div>

        {/* Last updated */}
        <Skeleton className="h-3 w-[220px]" />

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-10 w-[200px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

export {
  Skeleton,
  CustomerTableSkeleton,
  StatsCardSkeleton,
  SearchSkeleton,
  CustomerDetailSkeleton,
  SettingsFormSkeleton,
  CompanyInfoSkeleton,
  PrinterConfigSkeleton
};