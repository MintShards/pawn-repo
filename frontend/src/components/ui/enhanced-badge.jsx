import * as React from "react";
import { cva } from "class-variance-authority";
import { CheckCircle, AlertCircle, Archive, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Semantic variants for customer management
        success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/30",
        warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30",
        danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30",
        info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30",
        neutral: "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const EnhancedBadge = React.forwardRef(({ className, variant, children, icon: Icon, ...props }, ref) => {
  return (
    <div className={cn(badgeVariants({ variant }), className)} ref={ref} {...props}>
      {Icon && <Icon className="w-3 h-3 mr-1" />}
      {children}
    </div>
  );
});
EnhancedBadge.displayName = "EnhancedBadge";

// Semantic status badge component
const StatusBadge = ({ status, className, ...props }) => {
  const statusConfig = {
    active: {
      variant: "success",
      icon: CheckCircle,
      label: "Active"
    },
    suspended: {
      variant: "warning", 
      icon: AlertCircle,
      label: "Suspended"
    },
    archived: {
      variant: "neutral",
      icon: Archive,
      label: "Archived"
    },
    banned: {
      variant: "danger",
      icon: XCircle,
      label: "Banned"
    },
    pending: {
      variant: "info",
      icon: Clock,
      label: "Pending"
    }
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;

  return (
    <EnhancedBadge
      variant={config.variant}
      icon={config.icon}
      className={className}
      {...props}
    >
      {config.label}
    </EnhancedBadge>
  );
};

// Risk level indicator component
const RiskBadge = ({ level, className, ...props }) => {
  const riskConfig = {
    low: {
      variant: "success",
      icon: TrendingUp,
      label: "Low Risk",
      description: "Excellent payment history"
    },
    medium: {
      variant: "warning",
      icon: Clock,
      label: "Medium Risk", 
      description: "Some payment delays"
    },
    high: {
      variant: "danger",
      icon: TrendingDown,
      label: "High Risk",
      description: "Multiple payment issues"
    }
  };

  const config = riskConfig[level?.toLowerCase()] || riskConfig.low;

  return (
    <EnhancedBadge
      variant={config.variant}
      icon={config.icon}
      className={className}
      title={config.description}
      {...props}
    >
      {config.label}
    </EnhancedBadge>
  );
};

// Loan activity badge
const LoanActivityBadge = ({ count, maxLoans = 5, className, ...props }) => {
  const getVariant = (count, max) => {
    const ratio = count / max;
    if (ratio >= 0.8) return "danger";
    if (ratio >= 0.6) return "warning";
    if (ratio >= 0.3) return "info";
    return "success";
  };

  return (
    <EnhancedBadge
      variant={count > 0 ? getVariant(count, maxLoans) : "neutral"}
      className={className}
      {...props}
    >
      {count} Active
    </EnhancedBadge>
  );
};

export { EnhancedBadge, StatusBadge, RiskBadge, LoanActivityBadge, badgeVariants };