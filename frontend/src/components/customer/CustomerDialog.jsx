import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const customerSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  phone_number: z
    .string()
    .min(10, 'Phone number must be exactly 10 digits')
    .max(10, 'Phone number must be exactly 10 digits')
    .regex(/^\d{10}$/, 'Phone number must contain only digits'),
  email: z.union([z.literal(''), z.string().email()]).optional(),
  status: z.enum(['active', 'suspended', 'banned']),
  notes: z.string().optional(),
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

  const isAdmin = user?.role === 'admin';
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
    if (!phoneNumber || phoneNumber.length !== 10) {
      setPhoneExists(false);
      return;
    }

    // Don't check if editing and phone hasn't changed
    if (isEditing && phoneNumber === customer?.phone_number) {
      setPhoneExists(false);
      return;
    }

    try {
      const existingCustomer = await customerService.getCustomerByPhone(phoneNumber);
      setPhoneExists(!!existingCustomer);
    } catch (error) {
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
    
    // Clean up data - remove empty email
    const cleanedData = { ...data };
    if (!cleanedData.email || cleanedData.email.trim() === '') {
      delete cleanedData.email;
    }
    
    try {
      let result;
      if (isEditing) {
        result = await customerService.updateCustomer(customer.phone_number, cleanedData);
      } else {
        result = await customerService.createCustomer(cleanedData);
      }

      if (onSave) {
        onSave(result);
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Save customer error:', error);
      form.setError('root', {
        type: 'manual',
        message: error.message || 'Failed to save customer',
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Customer' : 'Add New Customer'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update customer information below.' 
              : 'Enter customer details to create a new customer profile.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John" 
                        {...field} 
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
                        placeholder="Doe" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1234567890"
                      value={field.value}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      disabled={isLoading}
                      className={phoneExists ? 'border-destructive' : ''}
                    />
                  </FormControl>
                  {phoneExists && (
                    <p className="text-sm text-destructive">
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
                      placeholder="john.doe@email.com" 
                      type="email"
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isAdmin && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal notes about this customer..."
                      className="min-h-[80px]"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
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
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : (
                  isEditing ? 'Update Customer' : 'Create Customer'
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