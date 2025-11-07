import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { MapPin, Loader2, CloudSun } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';
import { CompanyInfoSkeleton } from '../../ui/skeleton';

const LocationConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    location_name: '',
    city: '',
    state: '',
    country: '',
    latitude: '',
    longitude: '',
    timezone: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  // Track form changes
  useEffect(() => {
    if (initialFormData) {
      const changed = Object.keys(formData).some(
        key => formData[key] !== initialFormData[key]
      );
      setHasUnsavedChanges(changed);
    }
  }, [formData, initialFormData]);

  // Warn before closing/navigating with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await businessConfigService.getLocationConfig();
      setConfig(data);
      const formValues = {
        location_name: data.location_name || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        latitude: data.latitude?.toString() || '',
        longitude: data.longitude?.toString() || '',
        timezone: data.timezone || ''
      };
      setFormData(formValues);
      setInitialFormData(formValues); // Store initial values for change detection
    } catch (error) {
      // If not found, that's okay - we'll create new config
      if (error.status !== 404) {
        console.error('Error fetching location config:', error);
        toast.error('Failed to load location configuration');
      } else {
        // For new configs, initialize with empty state so changes are detected
        const emptyFormValues = {
          location_name: '',
          city: '',
          state: '',
          country: '',
          latitude: '',
          longitude: '',
          timezone: ''
        };
        setInitialFormData(emptyFormValues);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.location_name || !formData.city || !formData.latitude || !formData.longitude || !formData.timezone) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate coordinates
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error('Latitude must be a number between -90 and 90');
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      toast.error('Longitude must be a number between -180 and 180');
      return;
    }

    try {
      setSaving(true);

      // Convert coordinates to numbers
      const payload = {
        ...formData,
        latitude: lat,
        longitude: lon
      };

      await businessConfigService.updateLocationConfig(payload);

      toast.success('Location configuration updated successfully', {
        description: 'Weather will now use your business location'
      });

      // Refresh config and reset change tracking
      const updatedConfig = await businessConfigService.getLocationConfig();
      setConfig(updatedConfig);
      const updatedFormValues = {
        location_name: updatedConfig.location_name || '',
        city: updatedConfig.city || '',
        state: updatedConfig.state || '',
        country: updatedConfig.country || '',
        latitude: updatedConfig.latitude?.toString() || '',
        longitude: updatedConfig.longitude?.toString() || '',
        timezone: updatedConfig.timezone || ''
      };
      setFormData(updatedFormValues);
      setInitialFormData(updatedFormValues);
      setHasUnsavedChanges(false);

      // Clear weather cache to force refresh with new location
      localStorage.removeItem('weather_cache');

      // Reload page to refresh weather
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error saving location config:', error);
      toast.error('Failed to update location configuration', {
        description: error.response?.data?.detail || 'Please try again'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (initialFormData) {
      setFormData(initialFormData);
      setHasUnsavedChanges(false);
    }
  };

  if (loading) {
    return <CompanyInfoSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <CardTitle>Business Location</CardTitle>
            <CardDescription>
              Configure your business location for accurate weather display
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Name */}
          <div className="space-y-2">
            <Label htmlFor="location_name" className="required">
              Location Name
            </Label>
            <Input
              id="location_name"
              name="location_name"
              type="text"
              placeholder="Enter location name"
              value={formData.location_name}
              onChange={handleChange}
              required
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Friendly name for this location (e.g., Main Store, Downtown Branch)
            </p>
          </div>

          {/* City and State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="required">
                City
              </Label>
              <Input
                id="city"
                name="city"
                type="text"
                placeholder="Enter city name"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                name="state"
                type="text"
                placeholder="Enter state or province"
                value={formData.state}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              type="text"
              placeholder="Enter country"
              value={formData.country}
              onChange={handleChange}
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude" className="required">
                Latitude
              </Label>
              <Input
                id="latitude"
                name="latitude"
                type="text"
                placeholder="Enter latitude"
                value={formData.latitude}
                onChange={handleChange}
                required
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Range: -90 to 90 (e.g., 49.0469)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude" className="required">
                Longitude
              </Label>
              <Input
                id="longitude"
                name="longitude"
                type="text"
                placeholder="Enter longitude"
                value={formData.longitude}
                onChange={handleChange}
                required
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Range: -180 to 180 (e.g., -122.8761)
              </p>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="required">
              Timezone
            </Label>
            <Input
              id="timezone"
              name="timezone"
              type="text"
              placeholder="Enter timezone"
              value={formData.timezone}
              onChange={handleChange}
              required
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              IANA timezone format (e.g., America/Vancouver, America/Toronto)
            </p>
          </div>

          {/* How to find coordinates help */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-3">
              <CloudSun className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  How to find your coordinates:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Open Google Maps and search for your business address</li>
                  <li>Right-click on your location pin</li>
                  <li>Click the coordinates to copy them</li>
                  <li>First number is Latitude, second is Longitude</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Last Updated Info */}
          {config && (
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Last updated: {formatBusinessDateTime(config.updated_at)} by User #{config.updated_by}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            {hasUnsavedChanges && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={saving || !hasUnsavedChanges}
              className="min-w-32"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default LocationConfig;
