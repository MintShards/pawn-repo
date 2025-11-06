// Comprehensive form validation utilities for the transaction module
import React from 'react';

// Validation result structure
export const createValidationResult = (isValid, message = null, suggestions = []) => ({
  isValid,
  message,
  suggestions
})

// Required field validation
export const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return createValidationResult(false, `${fieldName} is required`)
  }
  return createValidationResult(true)
}

// Financial amount validation (integers only)
export const validateAmount = (value, fieldName, options = {}) => {
  const { min = 1, max = 999999, allowZero = false } = options

  if (!value && value !== 0) {
    return createValidationResult(false, `${fieldName} is required`)
  }

  const numValue = parseInt(value, 10)

  if (isNaN(numValue)) {
    return createValidationResult(false, `${fieldName} must be a valid whole number`)
  }

  // Check if value contains decimals
  if (value.toString().includes('.')) {
    return createValidationResult(false, `${fieldName} must be a whole dollar amount (no cents)`)
  }

  if (!allowZero && numValue <= 0) {
    return createValidationResult(false, `${fieldName} must be greater than $0`)
  }

  if (numValue < min) {
    return createValidationResult(false, `${fieldName} must be at least $${min}`)
  }

  if (numValue > max) {
    return createValidationResult(false, `${fieldName} cannot exceed $${max}`)
  }

  return createValidationResult(true)
}

// Phone number validation
export const validatePhone = (value) => {
  if (!value) {
    return createValidationResult(false, 'Phone number is required')
  }
  
  const cleanPhone = value.replace(/\D/g, '')
  
  if (cleanPhone.length !== 10) {
    return createValidationResult(false, 'Phone number must be 10 digits')
  }
  
  return createValidationResult(true)
}

// Date validation
export const validateDate = (value, fieldName, options = {}) => {
  const { minDate, maxDate, required = true } = options
  
  if (!value) {
    return required 
      ? createValidationResult(false, `${fieldName} is required`)
      : createValidationResult(true)
  }
  
  const date = new Date(value)
  
  if (isNaN(date.getTime())) {
    return createValidationResult(false, `${fieldName} must be a valid date`)
  }
  
  if (minDate && date < minDate) {
    return createValidationResult(false, `${fieldName} cannot be before ${minDate.toLocaleDateString()}`)
  }
  
  if (maxDate && date > maxDate) {
    return createValidationResult(false, `${fieldName} cannot be after ${maxDate.toLocaleDateString()}`)
  }
  
  return createValidationResult(true)
}

// Item description validation
export const validateItemDescription = (value) => {
  if (!value || value.trim() === '') {
    return createValidationResult(false, 'Item description is required')
  }
  
  if (value.trim().length < 3) {
    return createValidationResult(false, 'Description must be at least 3 characters')
  }
  
  if (value.length > 200) {
    return createValidationResult(false, 'Description cannot exceed 200 characters')
  }
  
  return createValidationResult(true)
}

// Loan limit validation (integers only)
export const validateLoanLimit = (amount, customer, eligibilityData) => {
  if (!eligibilityData) {
    return createValidationResult(false, 'Unable to verify loan eligibility')
  }

  if (!eligibilityData.can_borrow) {
    return createValidationResult(false, eligibilityData.reason || 'Customer is not eligible for loans')
  }

  const requestedAmount = parseInt(amount, 10)
  const maxAmount = parseInt(eligibilityData.max_loan_amount || 0, 10)

  if (requestedAmount > maxAmount) {
    return createValidationResult(
      false,
      `Loan amount cannot exceed $${maxAmount}`,
      [`Customer has ${eligibilityData.active_loan_count || 0} active loans`]
    )
  }

  return createValidationResult(true)
}

// Payment validation (integers only)
export const validatePayment = (amount, balance) => {
  if (!balance) {
    return createValidationResult(false, 'Unable to verify balance')
  }

  const paymentAmount = parseInt(amount, 10)
  const currentBalance = parseInt(balance.current_balance || 0, 10)

  if (paymentAmount > currentBalance) {
    return createValidationResult(
      false,
      `Payment cannot exceed current balance of $${currentBalance}`,
      ['Consider processing a redemption instead']
    )
  }

  return createValidationResult(true)
}

// Extension validation
export const validateExtension = (months, transaction) => {
  const monthsNum = parseInt(months)
  
  if (isNaN(monthsNum) || monthsNum < 1) {
    return createValidationResult(false, 'Extension must be at least 1 month')
  }
  
  if (monthsNum > 12) {
    return createValidationResult(false, 'Extension cannot exceed 12 months')
  }
  
  // Check if transaction is already overdue
  if (transaction.status === 'overdue') {
    return createValidationResult(
      true,
      null,
      ['This transaction is overdue - extension will include grace period charges']
    )
  }
  
  return createValidationResult(true)
}

// Form validation aggregator
export const validateForm = (formData, validators) => {
  const errors = {}
  const suggestions = {}
  let isValid = true
  
  for (const [field, validator] of Object.entries(validators)) {
    const result = validator(formData[field], formData)
    
    if (!result.isValid) {
      errors[field] = result.message
      isValid = false
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
      suggestions[field] = result.suggestions
    }
  }
  
  return {
    isValid,
    errors,
    suggestions
  }
}

// Real-time validation hook
export const useFormValidation = (initialData, validators) => {
  const [data, setData] = React.useState(initialData)
  const [errors, setErrors] = React.useState({})
  const [suggestions, setSuggestions] = React.useState({})
  const [touched, setTouched] = React.useState({})
  
  // Validate single field
  const validateField = React.useCallback((field, value, allData = data) => {
    if (!validators[field]) return
    
    const result = validators[field](value, allData)
    
    setErrors(prev => ({
      ...prev,
      [field]: result.isValid ? null : result.message
    }))
    
    setSuggestions(prev => ({
      ...prev,
      [field]: result.suggestions || []
    }))
  }, [validators, data])
  
  // Update field value
  const updateField = React.useCallback((field, value) => {
    const newData = { ...data, [field]: value }
    setData(newData)

    // Only validate if field has been touched
    if (touched[field]) {
      validateField(field, value, newData)
    }
  }, [data, touched, validateField])

  // Update multiple fields at once (batched update)
  const updateFields = React.useCallback((updates) => {
    const newData = { ...data, ...updates }
    setData(newData)

    // Validate touched fields
    Object.keys(updates).forEach(field => {
      if (touched[field]) {
        validateField(field, updates[field], newData)
      }
    })
  }, [data, touched, validateField])

  // Mark field as touched
  const touchField = React.useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateField(field, data[field])
  }, [data, validateField])
  
  // Validate entire form
  const validateAll = React.useCallback(() => {
    const result = validateForm(data, validators)
    setErrors(result.errors)
    setSuggestions(result.suggestions)
    
    // Mark all fields as touched
    const allTouched = Object.keys(validators).reduce((acc, field) => {
      acc[field] = true
      return acc
    }, {})
    setTouched(allTouched)
    
    return result.isValid
  }, [data, validators])
  
  // Get field error
  const getFieldError = React.useCallback((field) => {
    return touched[field] ? errors[field] : null
  }, [errors, touched])
  
  // Get field suggestions
  const getFieldSuggestions = React.useCallback((field) => {
    return suggestions[field] || []
  }, [suggestions])
  
  // Check if form is valid
  const isFormValid = React.useMemo(() => {
    return Object.values(errors).every(error => !error)
  }, [errors])
  
  return {
    data,
    updateField,
    updateFields,
    touchField,
    validateAll,
    getFieldError,
    getFieldSuggestions,
    isFormValid,
    errors,
    touched
  }
}