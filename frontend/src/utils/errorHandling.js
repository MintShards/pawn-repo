import { toast } from "sonner"

// Error type classification
export const ERROR_TYPES = {
  VALIDATION: 'validation',
  NETWORK: 'network', 
  AUTH: 'authentication',
  BUSINESS: 'business',
  SERVER: 'server',
  UNKNOWN: 'unknown'
}

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

// Parse API errors into user-friendly messages
export const parseApiError = (error) => {
  if (!error) return { message: 'Unknown error occurred', type: ERROR_TYPES.UNKNOWN }

  // Network/connectivity errors
  if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
    return {
      message: 'Unable to connect to server. Please check your connection.',
      type: ERROR_TYPES.NETWORK,
      severity: ERROR_SEVERITY.HIGH,
      actions: ['retry', 'checkConnection']
    }
  }

  // Authentication errors
  if (error.status === 401 || error.status === 403) {
    // Check if it's an admin PIN error (not a session expiration)
    const errorMessage = error.response?.data?.message || error.message || '';
    const isAdminPinError = errorMessage.toLowerCase().includes('admin pin') ||
                           errorMessage.toLowerCase().includes('invalid pin');

    if (isAdminPinError) {
      return {
        message: errorMessage,
        type: ERROR_TYPES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        actions: ['fix']
      }
    }

    return {
      message: 'Session expired. Please log in again.',
      type: ERROR_TYPES.AUTH,
      severity: ERROR_SEVERITY.CRITICAL,
      actions: ['reauth']
    }
  }

  // Validation errors
  if (error.status === 422 || error.status === 400) {
    const details = error.response?.data?.detail || error.message || 'Invalid input provided'
    return {
      message: Array.isArray(details) ? details.map(d => d.msg).join(', ') : details,
      type: ERROR_TYPES.VALIDATION,
      severity: ERROR_SEVERITY.MEDIUM,
      actions: ['fix']
    }
  }

  // Business logic errors
  if (error.status === 409 || error.status === 412) {
    return {
      message: error.response?.data?.detail || 'Business rule violation occurred',
      type: ERROR_TYPES.BUSINESS,
      severity: ERROR_SEVERITY.HIGH,
      actions: ['review', 'contact']
    }
  }

  // Server errors
  if (error.status >= 500) {
    return {
      message: 'Server error occurred. Please try again later.',
      type: ERROR_TYPES.SERVER,
      severity: ERROR_SEVERITY.CRITICAL,
      actions: ['retry', 'contact']
    }
  }

  // Generic error fallback
  return {
    message: error.message || 'An unexpected error occurred',
    type: ERROR_TYPES.UNKNOWN,
    severity: ERROR_SEVERITY.MEDIUM,
    actions: ['retry']
  }
}

// Display error with appropriate UI feedback
export const handleError = (error, context = '') => {
  const parsedError = parseApiError(error)
  const contextMessage = context ? `${context}: ` : ''
  
  // Log for debugging
  console.error('Error:', {
    original: error,
    parsed: parsedError,
    context,
    timestamp: new Date().toISOString()
  })

  // Show user-friendly notification
  switch (parsedError.severity) {
    case ERROR_SEVERITY.CRITICAL:
      toast.error(`${contextMessage}${parsedError.message}`, {
        duration: 10000,
        action: {
          label: 'Reload Page',
          onClick: () => window.location.reload()
        }
      })
      break
    
    case ERROR_SEVERITY.HIGH:
      toast.error(`${contextMessage}${parsedError.message}`, {
        duration: 8000
      })
      break
    
    case ERROR_SEVERITY.MEDIUM:
      toast.warning(`${contextMessage}${parsedError.message}`, {
        duration: 5000
      })
      break
    
    default:
      toast.info(`${contextMessage}${parsedError.message}`, {
        duration: 3000
      })
  }

  return parsedError
}

// Success notification helper
export const handleSuccess = (message, action = null) => {
  toast.success(message, {
    duration: 4000,
    action: action && {
      label: action.label,
      onClick: action.onClick
    }
  })
}

// Loading toast helper
export const showLoadingToast = (message, promise) => {
  return toast.promise(promise, {
    loading: message,
    success: 'Operation completed successfully',
    error: 'Operation failed'
  })
}


// Confirmation dialog helper (simplified for .js file)
export const showConfirmation = (title, description, onConfirm) => {
  return new Promise((resolve) => {
    if (window.confirm(`${title}\n\n${description}`)) {
      onConfirm?.()
      resolve(true)
    } else {
      resolve(false)
    }
  })
}