import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import customerService from '../../services/customerService';

const customerSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  phone_number: z
    .string()
    .min(10, 'Phone number must be exactly 10 digits')
    .max(10, 'Phone number must be exactly 10 digits')
    .regex(/^\d{10}$/, 'Phone number must contain only digits'),
  email: z.union([z.literal(''), z.string().email('Please enter a valid email address')]).optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

const CustomerDialog = ({
  open,
  onOpenChange,
  customer,
  prefilledData,
  onSave,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);

  const isEditing = !!customer;

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      notes: '',
    },
  });

  // Reset form when dialog opens/closes or customer changes
  useEffect(() => {
    if (open && customer) {
      // Editing existing customer
      form.reset({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone_number: customer.phone_number || '',
        email: customer.email || '',
        notes: customer.notes || '',
      });
    } else if (open && prefilledData) {
      // New customer with prefilled data
      form.reset({
        first_name: prefilledData.first_name || '',
        last_name: prefilledData.last_name || '',
        phone_number: prefilledData.phone_number || '',
        email: prefilledData.email || '',
        notes: prefilledData.notes || '',
      });
    } else if (open) {
      // New customer without prefilled data
      form.reset({
        first_name: '',
        last_name: '',
        phone_number: '',
        email: '',
        notes: '',
      });
    }
    setPhoneExists(false);
  }, [open, customer, prefilledData, form]);

  const checkPhoneExists = async (phoneNumber) => {
    // Use enhanced validation from service
    const validation = customerService.validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      setPhoneExists(false);
      return;
    }

    // Don't check if editing and phone hasn't changed
    if (isEditing && phoneNumber === customer?.phone_number) {
      setPhoneExists(false);
      return;
    }

    try {
      const existingCustomer = await customerService.getCustomerByPhone(validation.cleaned);
      setPhoneExists(!!existingCustomer);
    } catch (error) {
      // Only log if it's not a 404 (customer not found is expected)
      if (!error.message.includes('404')) {
        // Warning handled
      }
      setPhoneExists(false);
    }
  };

  const handlePhoneChange = (value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    form.setValue('phone_number', cleaned);
    
    if (cleaned.length === 10) {
      checkPhoneExists(cleaned);
    } else {
      setPhoneExists(false);
    }
  };

  const onSubmit = async (data) => {
    if (phoneExists) {
      form.setError('phone_number', {
        type: 'manual',
        message: 'A customer with this phone number already exists',
      });
      return;
    }

    setIsLoading(true);
    
    // Clean up data - remove empty fields and trim strings
    const cleanedData = { ...data };
    
    // Trim and clean string fields
    cleanedData.first_name = cleanedData.first_name?.trim();
    cleanedData.last_name = cleanedData.last_name?.trim();
    cleanedData.notes = cleanedData.notes?.trim();
    
    // Remove empty email field
    if (!cleanedData.email || cleanedData.email.trim() === '') {
      delete cleanedData.email;
    } else {
      cleanedData.email = cleanedData.email.trim().toLowerCase();
    }
    
    try {
      let result;
      if (isEditing) {
        result = await customerService.updateCustomer(customer.phone_number, cleanedData);
        // Clear specific customer cache
        customerService.clearCustomerCache(customer.phone_number);
      } else {
        result = await customerService.createCustomer(cleanedData);
      }
      
      // Clear general customer list cache to ensure fresh data
      customerService.clearCustomerCache();

      if (onSave) {
        onSave(result);
      }
      
      onOpenChange(false);
    } catch (error) {
      // Error handled
      
      // Handle specific error types
      let errorMessage = 'Failed to save customer';
      if (error.message.includes('409')) {
        errorMessage = 'A customer with this phone number already exists';
        form.setError('phone_number', {
          type: 'manual',
          message: errorMessage,
        });
      } else if (error.message.includes('400')) {
        errorMessage = 'Invalid customer data. Please check your inputs.';
      } else if (error.message.includes('403')) {
        errorMessage = 'You do not have permission to perform this action';
      } else if (error.message.includes('422')) {
        errorMessage = 'Validation error. Please check your inputs.';
      } else {
        errorMessage = error.message || 'Failed to save customer. Please try again.';
      }
      
      form.setError('root', {
        type: 'manual',
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Customer' : 'Add Customer'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Personal Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter first name"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter last name"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Contact Information</h3>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter 10-digit phone number"
                          value={field.value}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          disabled={isLoading || isEditing}
                          className={phoneExists ? 'border-red-500 focus:border-red-500' : ''}
                        />
                      </FormControl>
                      {isEditing && (
                        <p className="text-sm text-muted-foreground">
                          Phone number cannot be changed after creation
                        </p>
                      )}
                      {phoneExists && !isEditing && (
                        <p className="text-sm text-destructive flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          A customer with this phone number already exists
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter email address"
                          type="email"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes Section */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal staff notes"
                      className="min-h-[100px] resize-none"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Display */}
            {form.formState.errors.root && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || phoneExists}
              >
                {isLoading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;