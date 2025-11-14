// Shared sidebar card styles for Transaction Hub
// Used by Quick Actions, Cash Register, and other sidebar components

export const SIDEBAR_CARD_STYLES = {
  // Card wrapper
  card: "border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm",

  // CardContent wrapper
  cardContent: "py-4",

  // Main container
  container: "flex flex-col gap-4",

  // Section header container
  header: "flex items-center gap-2",

  // Icon wrapper (for relative positioning and consistent sizing)
  iconWrapper: "relative flex-shrink-0 pt-1",

  // Icon container
  iconContainer: "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm",
  iconContainerGradient: "bg-gradient-to-br", // Apply specific gradient colors separately

  // Icon
  icon: "w-4 h-4 text-white",

  // Text container
  textContainer: "flex flex-col gap-0.5",

  // Title
  title: "text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight",

  // Subtitle
  subtitle: "text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap leading-tight",

  // Status indicator (pulsing dot)
  statusIndicator: "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"
};

// Gradient color presets for different card types
export const SIDEBAR_GRADIENTS = {
  quickActions: "from-amber-500 to-orange-600",
  cashRegister: "from-emerald-500 to-green-600",
  cashRegisterOpen: "from-emerald-500 to-green-600",
  cashRegisterClosed: "from-orange-500 to-red-600",
  stats: "from-blue-500 to-indigo-600",
  alerts: "from-purple-500 to-pink-600"
};

// Helper function to combine class names
export const cn = (...classes) => classes.filter(Boolean).join(' ');
