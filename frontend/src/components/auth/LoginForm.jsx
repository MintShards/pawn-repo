import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { useAuth } from '../../context/AuthContext';

const loginSchema = z.object({
  user_id: z
    .string()
    .length(2, 'User ID must be exactly 2 digits')
    .regex(/^\d{2}$/, 'User ID must be 2 digits'),
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

const LoginForm = ({ onLoginSuccess }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      user_id: '',
      pin: '',
    },
  });

  const onSubmit = async (data) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await login(data);
      
      if (result.success) {
        // Login successful
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login form error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserIdChange = (value) => {
    // Only allow numeric input and limit to 2 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 2);
    form.setValue('user_id', numericValue);
  };

  const handlePinChange = (value) => {
    // Only allow numeric input and limit to 4 characters
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    form.setValue('pin', numericValue);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="user_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>User ID</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  placeholder="Enter 2-digit User ID"
                  maxLength={2}
                  onChange={(e) => handleUserIdChange(e.target.value)}
                  className="text-center text-lg font-mono"
                  autoComplete="username"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PIN</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  onChange={(e) => handlePinChange(e.target.value)}
                  className="text-center text-lg font-mono"
                  autoComplete="current-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>
    </Form>
  );
};

export default LoginForm;