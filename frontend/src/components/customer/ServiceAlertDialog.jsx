import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '../ui/select';
import { Badge } from '../ui/badge';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from '../ui/form';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import { User, CheckCircle, Bell, AlertCircle, Plus, X, Zap, Calendar, Phone, Clock, FileText, Star } from 'lucide-react';
import serviceAlertService from '../../services/serviceAlertService';
import { useToast } from '../ui/toast';
import { formatLocalDate } from '../../utils/timezoneUtils';

const ServiceAlertDialog = ({ 
  isOpen, 
  onClose, 
  customerPhone, 
  customerName, 
  onAlertResolved 
}) => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [customerItems, setCustomerItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);

  const form = useForm({
    defaultValues: {
      alert_type: 'general_note',
      description: '',
      item_reference: ''
    }
  });

  const fetchAlerts = useCallback(async (forceFresh = false) => {
    try {
      setLoading(true);
      const response = forceFresh 
        ? await serviceAlertService.getCustomerAlertsFresh(customerPhone, 'active')
        : await serviceAlertService.getCustomerAlerts(customerPhone, 'active');
      setAlerts(response.alerts || []);
    } catch (error) {
      console.error('Failed to fetch alerts for customer:', customerPhone, error);
      toast({
        title: 'Error',
        description: 'Failed to load service alerts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [customerPhone, toast]);

  // Debounced cache refresh function to prevent rate limiting
  const handleCacheRefresh = useCallback(async () => {
    // Clear cache BEFORE fetching for immediate responsiveness
    serviceAlertService.clearCacheByPattern(`alert_count_${customerPhone}`);
    serviceAlertService.clearCacheByPattern(`alerts_${customerPhone}`);
    
    // Small delay to ensure backend consistency
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await fetchAlerts(true); // Force fresh fetch
    
    // Trigger callback (but reduce event frequency)
    onAlertResolved?.();
    
    // Debounce global refresh events to prevent spam
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refreshAlertCounts'));
      window.dispatchEvent(new CustomEvent('refreshCustomerAlerts', {
        detail: { customerPhone }
      }));
    }, 500);
  }, [customerPhone, fetchAlerts, onAlertResolved]);

  const fetchCustomerItems = useCallback(async () => {
    try {
      const items = await serviceAlertService.getCustomerItems(customerPhone);
      setCustomerItems(items || []);
    } catch (error) {
      console.error('Failed to fetch customer items:', customerPhone, error);
    }
  }, [customerPhone]);

  useEffect(() => {
    if (isOpen && customerPhone) {
      fetchAlerts();
      fetchCustomerItems();
    }
  }, [isOpen, customerPhone, fetchAlerts, fetchCustomerItems]);

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      await serviceAlertService.createAlert({
        customer_phone: customerPhone,
        ...data
      });
      
      toast({
        title: 'Success',
        description: 'Service alert created successfully'
      });
      
      form.reset();
      setShowCreateForm(false);
      
      // Handle cache clearing and refresh
      await handleCacheRefresh();
    } catch (error) {
      console.error('Failed to create alert:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create service alert',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId, resolutionNotes = null) => {
    try {
      setResolving(prev => new Set(prev).add(alertId));
      await serviceAlertService.resolveAlert(alertId, resolutionNotes);
      
      toast({
        title: 'Success',
        description: 'Alert resolved successfully'
      });
      
      // Handle cache clearing and refresh
      await handleCacheRefresh();
    } catch (error) {
      console.error('Failed to resolve alert:', alertId, error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to resolve alert',
        variant: 'destructive'
      });
    } finally {
      setResolving(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    }
  };

  const handleResolveAll = async () => {
    try {
      setLoading(true);
      await serviceAlertService.resolveAllCustomerAlerts(
        customerPhone,
        'Bulk resolution by staff member'
      );
      
      toast({
        title: 'Success',
        description: `All alerts resolved for ${customerName}`
      });
      
      // Handle cache clearing and refresh
      await handleCacheRefresh();
    } catch (error) {
      console.error('Failed to resolve all alerts for customer:', customerPhone, error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to resolve all alerts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };


  const getAlertTypeLabel = (type) => {
    const types = serviceAlertService.getAlertTypes();
    return types.find(t => t.value === type)?.label || type;
  };

  const handleDialogClose = () => {
    setShowCreateForm(false);
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/30 rounded-2xl">
        {/* Enhanced gradient overlay with subtle shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-indigo-50/10 to-purple-50/20 dark:from-slate-800/40 dark:via-slate-900/30 dark:to-slate-800/40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent dark:via-white/3 pointer-events-none" />
        
        <div className="relative z-10">
          <DialogHeader className="border-b border-slate-200/60 dark:border-slate-700/60 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Enhanced Service Alert Icon with modern styling */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-500" />
                  <div className="relative w-14 h-14 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/80 dark:via-indigo-950/80 dark:to-purple-950/80 shadow-lg shadow-blue-500/10 flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                    <Bell className="w-7 h-7 text-blue-600 dark:text-blue-400 group-hover:rotate-12 transition-transform duration-300" />
                  </div>
                  {alerts.length > 0 && (
                    <div className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-gradient-to-r from-red-500 to-rose-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-white px-1">{alerts.length > 99 ? '99+' : alerts.length}</span>
                    </div>
                  )}
                </div>
                
                {/* Title and description */}
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                    <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                      Service Alerts
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-600 dark:text-slate-400 mt-2 text-sm flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Manage service alerts for enhanced customer service
                  </DialogDescription>
                </div>
              </div>
              
              {/* Customer info badges with spacing from X button */}
              <div className="flex flex-col gap-2 items-end mr-8">
                <Badge variant="outline" className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1 text-sm font-medium shadow-sm">
                  <User className="w-3 h-3 mr-2" />
                  {customerName}
                </Badge>
                <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-3 py-1 text-sm font-medium shadow-sm">
                  <Phone className="w-3 h-3 mr-2" />
                  {customerPhone}
                </Badge>
              </div>
            </div>
          </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-1">
            {/* Create Alert Form */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl transition-all duration-300 hover:shadow-2xl">
            {showCreateForm ? (
            <>
              <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Create New Alert
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Add a new service alert for {customerName}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowCreateForm(false)}
                    size="sm"
                    variant="ghost"
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="alert_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Alert Type
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all">
                                <SelectValue placeholder="Select alert type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
                              {serviceAlertService.getAlertTypes().map((type) => (
                                <SelectItem key={type.value} value={type.value} className="hover:bg-blue-50 dark:hover:bg-blue-950/50">
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Description
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Provide a detailed description of the service alert..."
                              rows={4}
                              className="min-h-[100px] bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs text-red-500" />
                        </FormItem>
                      )}
                    />

                    {customerItems.length > 0 && (
                      <FormField
                        control={form.control}
                        name="item_reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Related Item (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select related item (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">No specific item</SelectItem>
                                {customerItems.map((item) => (
                                  <SelectItem key={item.id} value={item.description}>
                                    {item.description} - {item.category} ({item.status})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Link this alert to a specific pawn item
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <Separator className="my-6" />
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Alert will be visible to all staff members
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowCreateForm(false)}
                          className="bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={loading}
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {loading ? (
                            <>
                              <Zap className="w-4 h-4 mr-2 animate-pulse" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Create Alert
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/50 dark:to-teal-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
                Ready to Create Alert
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                Click the "Create Alert" button in the alerts section to add a new service alert for this customer.
              </p>
              <div className="text-xs text-slate-500 dark:text-slate-500 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/50">
                <Star className="w-4 h-4 inline mr-2 text-blue-500" />
                <strong>Tip:</strong> Use alerts to track customer requests, special instructions, or important service notes.
              </div>
            </div>
          )}
            </div>

            {/* Active Alerts Section */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl transition-all duration-300 hover:shadow-2xl">
            <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Active Alerts
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'} requiring attention
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => setShowCreateForm(true)}
                    size="sm"
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 relative z-10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Alert
                  </Button>
                  {alerts.length > 0 && (
                    <Button
                      onClick={handleResolveAll}
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/50 transition-all hover:scale-105"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {loading ? 'Resolving...' : 'Resolve All'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4">
              {loading && alerts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="w-8 h-8 rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                          <Skeleton className="h-8 w-16 rounded-lg" />
                        </div>
                        <Skeleton className="h-3 w-full mt-3" />
                        <Skeleton className="h-3 w-3/4 mt-2" />
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-6 flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4 animate-pulse" />
                    Loading alerts...
                  </p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/50 dark:to-teal-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
                    🎉 All Clear!
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    No service alerts requiring attention.
                  </p>
                  <div className="text-xs text-slate-400 dark:text-slate-500 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-800/50">
                    <Star className="w-4 h-4 inline mr-2 text-emerald-500" />
                    Use the "Create Alert" button above to add new alerts when needed.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <div key={alert.id} className="group bg-gradient-to-r from-white/90 to-slate-50/90 dark:from-slate-800/90 dark:to-slate-700/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                      <div className="p-5">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge 
                                variant="secondary" 
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-sm px-3 py-1 font-medium"
                              >
                                {getAlertTypeLabel(alert.alert_type)}
                              </Badge>
                              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                #{index + 1}
                              </span>
                            </div>
                            <Button
                              onClick={() => handleResolveAlert(alert.id)}
                              size="sm"
                              disabled={resolving.has(alert.id)}
                              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md disabled:opacity-50 text-sm px-4 py-2 transition-all hover:scale-105"
                            >
                              {resolving.has(alert.id) ? (
                                <>
                                  <Zap className="h-3 w-3 mr-2 animate-pulse" />
                                  Resolving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-2" />
                                  Resolve
                                </>
                              )}
                            </Button>
                          </div>
                          
                          <div className="space-y-3">
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/50 dark:border-slate-700/50">
                              {alert.description}
                            </p>
                            
                            {alert.item_reference && (
                              <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                                <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  <strong className="font-semibold">Related Item:</strong> {alert.item_reference}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <Separator className="my-3" />
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                <Calendar className="h-3 w-3" />
                                {formatLocalDate(alert.created_at)}
                              </span>
                              <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                <User className="h-3 w-3" />
                                Staff #{alert.created_by}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Footer */}
        <div className="border-t border-slate-200/60 dark:border-slate-700/60 p-4 bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="font-medium">Organized alerts improve customer service</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDialogClose}
              className="bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 backdrop-blur-sm transition-all hover:scale-105"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
        
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceAlertDialog;