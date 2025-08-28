import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Phone, Mail, Settings, FileText, AlertTriangle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { useAuth } from '../../context/AuthContext';
import customerService from '../../services/customerService';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';

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
  status: z.enum(['active', 'suspended', 'archived'], {
    errorMap: () => ({ message: 'Status must be active, suspended, or archived' })
  }),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

const CustomerDialog = ({ 
  open, 
  onOpenChange, 
  customer, 
  onSave, 
  onCancel 
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);

  const isAdmin = isAdminRole(user);
  const isEditing = !!customer;

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      status: 'active',
      notes: '',
    },
  });

  // Reset form when dialog opens/closes or customer changes
  useEffect(() => {
    if (open && customer) {
      form.reset({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone_number: customer.phone_number || '',
        email: customer.email || '',
        status: customer.status || 'active',
        notes: customer.notes || '',
      });
    } else if (open && !customer) {
      form.reset({
        first_name: '',
        last_name: '',
        phone_number: '',
        email: '',
        status: 'active',
        notes: '',
      });
    }
    setPhoneExists(false);
  }, [open, customer, form]);

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
      <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-slate-50/95 via-blue-50/30 to-indigo-50/40 dark:from-slate-950/95 dark:via-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl border-0 shadow-2xl">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
        
        <DialogHeader className="pb-6 pt-4">
          <div className="flex items-center space-x-4 mb-4">
            {/* Vault Logo */}
            <div className="w-12 h-12 rounded-full border-2 border-amber-500 bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 shadow-lg flex items-center justify-center">
              {/* Inner vault door */}
              <div className="w-7 h-7 rounded-full border border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                {/* Center square (vault handle) */}
                <div className="w-3 h-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-sm"></div>
              </div>
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Edit Customer' : 'Add New Customer'}
              </DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400 mt-1">
                {isEditing 
                  ? 'Update customer information in the secure PawnRepo system.' 
                  : 'Create a new customer profile with encrypted data storage.'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Personal Information Section */}
            <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <User className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Personal Information</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John" 
                          {...field} 
                          disabled={isLoading}
                          className="bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 backdrop-blur-sm"
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
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Doe" 
                          {...field} 
                          disabled={isLoading}
                          className="bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 backdrop-blur-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <Phone className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contact Information</h3>
              </div>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1234567890"
                          value={field.value}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          disabled={isLoading}
                          className={`${phoneExists ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200/50 dark:border-slate-600/50 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20'} bg-white/70 dark:bg-slate-700/70 backdrop-blur-sm`}
                        />
                      </FormControl>
                      {phoneExists && (
                        <div className="flex items-center space-x-2 mt-2 p-3 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <p className="text-sm text-red-600 dark:text-red-400">
                            A customer with this phone number already exists
                          </p>
                        </div>
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
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">Email (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <Input 
                            placeholder="john.doe@email.com" 
                            type="email"
                            {...field} 
                            disabled={isLoading}
                            className="pl-10 bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 backdrop-blur-sm"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Account Settings Section */}
            {isAdmin && (
              <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <Settings className="w-3 h-3 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account Settings</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</FormLabel>
                      <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-amber-500/20 backdrop-blur-sm">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50">
                        <SelectItem value="active" className="focus:bg-emerald-50 dark:focus:bg-emerald-950/50">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span>Active</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="suspended" className="focus:bg-amber-50 dark:focus:bg-amber-950/50">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            <span>Suspended</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="banned" className="focus:bg-red-50 dark:focus:bg-red-950/50">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span>Banned</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Notes Section */}
            <div className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Internal Notes</h3>
              </div>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes about this customer (confidential staff use only)..."
                        className="min-h-[100px] bg-white/70 dark:bg-slate-700/70 border-slate-200/50 dark:border-slate-600/50 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-violet-500/20 backdrop-blur-sm resize-none"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Error Display */}
            {form.formState.errors.root && (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 rounded-2xl border border-red-200 dark:border-red-800 shadow-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">Error</p>
                    <p className="text-sm text-red-700 dark:text-red-300">{form.formState.errors.root.message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Modern Action Buttons */}
            <DialogFooter className="gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="px-8 py-2 bg-white/70 dark:bg-slate-700/70 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 backdrop-blur-sm"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || phoneExists}
                className="px-8 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{isEditing ? 'Update Customer' : 'Create Customer'}</span>
                  </div>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;