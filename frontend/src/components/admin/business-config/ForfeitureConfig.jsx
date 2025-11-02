import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Calendar, Loader2 } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';

const ForfeitureConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    forfeiture_days: 97,
    grace_period_days: 0,
    notification_days_before: 7,
    enable_notifications: false,
    reason: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await businessConfigService.getForfeitureConfig();
      setConfig(data);
      setFormData({
        forfeiture_days: data.forfeiture_days || 97,
        grace_period_days: data.grace_period_days || 0,
        notification_days_before: data.notification_days_before || 7,
        enable_notifications: data.enable_notifications || false,
        reason: ''
      });
    } catch (error) {
      if (error.status !== 404) {
        console.error('Error fetching forfeiture config:', error);
        toast.error('Failed to load forfeiture configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.reason || formData.reason.length < 5) {
      toast.error('Please provide a reason for this configuration change (min 5 characters)');
      return;
    }

    // Convert string values to numbers
    const payload = {
      ...formData,
      forfeiture_days: parseInt(formData.forfeiture_days),
      grace_period_days: parseInt(formData.grace_period_days),
      notification_days_before: parseInt(formData.notification_days_before),
    };

    try {
      setSaving(true);
      const savedConfig = await businessConfigService.createForfeitureConfig(payload);
      toast.success('Forfeiture configuration saved successfully');

      // Use the save response directly instead of fetching again
      setConfig(savedConfig);
      setFormData({
        forfeiture_days: savedConfig.forfeiture_days?.toString() || '97',
        grace_period_days: savedConfig.grace_period_days?.toString() || '0',
        notification_days_before: savedConfig.notification_days_before?.toString() || '7',
        auto_forfeit_enabled: savedConfig.auto_forfeit_enabled ?? true,
        reason: '' // Clear reason field after save
      });
    } catch (error) {
      console.error('Error saving forfeiture config:', error);
      toast.error(error.detail || 'Failed to save forfeiture configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          <div>
            <CardTitle>Forfeiture Rules</CardTitle>
            <CardDescription>Automatic item forfeiture thresholds and grace periods</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="forfeiture_days">Forfeiture Threshold (days) *</Label>
              <Input
                id="forfeiture_days"
                name="forfeiture_days"
                type="number"
                value={formData.forfeiture_days}
                onChange={handleChange}
                min="30"
                max="365"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Days after loan date before automatic forfeiture (30-365)</p>
            </div>

            <div>
              <Label htmlFor="grace_period_days">Grace Period (days)</Label>
              <Input
                id="grace_period_days"
                name="grace_period_days"
                type="number"
                value={formData.grace_period_days}
                onChange={handleChange}
                min="0"
                max="30"
              />
              <p className="text-xs text-slate-500 mt-1">Additional days after threshold (0-30)</p>
            </div>

            <div>
              <Label htmlFor="notification_days_before">Notification Days Before</Label>
              <Input
                id="notification_days_before"
                name="notification_days_before"
                type="number"
                value={formData.notification_days_before}
                onChange={handleChange}
                min="0"
                max="30"
              />
              <p className="text-xs text-slate-500 mt-1">Days before forfeiture to notify (0-30)</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable_notifications"
              name="enable_notifications"
              checked={formData.enable_notifications}
              onCheckedChange={(checked) => setFormData({ ...formData, enable_notifications: checked })}
            />
            <Label htmlFor="enable_notifications" className="font-normal cursor-pointer">
              Enable customer notifications before forfeiture
            </Label>
          </div>

          {/* Reason for Change */}
          <div>
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Explain why you are updating this configuration..."
              rows={3}
              required
              className="resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 5 characters required</p>
          </div>

          {config && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Last updated: {formatBusinessDateTime(config.updated_at)} by {config.updated_by}
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full md:w-auto">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Forfeiture Configuration'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ForfeitureConfig;
