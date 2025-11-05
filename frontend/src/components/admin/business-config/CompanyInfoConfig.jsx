import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Building2, Loader2, X } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';
import { CompanyInfoSkeleton } from '../../ui/skeleton';

const CompanyInfoConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    logo_url: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: ''
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
      const data = await businessConfigService.getCompanyConfig();
      setConfig(data);
      const formValues = {
        company_name: data.company_name || '',
        logo_url: data.logo_url || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || ''
      };
      setFormData(formValues);
      setInitialFormData(formValues); // Store initial values for change detection
      if (data.logo_url) {
        setLogoPreview(data.logo_url);
      }
    } catch (error) {
      // If not found, that's okay - we'll create new config
      if (error.status !== 404) {
        console.error('Error fetching company config:', error);
        toast.error('Failed to load company information');
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPEG, GIF, or WEBP images');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    try {
      setUploading(true);
      const response = await businessConfigService.uploadLogo(file);
      setFormData({
        ...formData,
        logo_url: response.logo_url
      });
      setLogoPreview(response.logo_url);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(error.detail || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData({
      ...formData,
      logo_url: ''
    });
    setLogoPreview(null);
  };

  const handleReset = () => {
    if (initialFormData) {
      setFormData(initialFormData);
      setLogoPreview(initialFormData.logo_url || null);
      toast.info('Form reset to saved values');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.company_name || !formData.address_line1 || !formData.city || !formData.state || !formData.zip_code || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      const savedConfig = await businessConfigService.createCompanyConfig(formData);
      toast.success('Company information saved successfully');

      // Use the save response directly instead of fetching again
      setConfig(savedConfig);
      const formValues = {
        company_name: savedConfig.company_name || '',
        logo_url: savedConfig.logo_url || '',
        address_line1: savedConfig.address_line1 || '',
        address_line2: savedConfig.address_line2 || '',
        city: savedConfig.city || '',
        state: savedConfig.state || '',
        zip_code: savedConfig.zip_code || '',
        phone: savedConfig.phone || '',
        email: savedConfig.email || '',
        website: savedConfig.website || ''
      };
      setFormData(formValues);
      setInitialFormData(formValues); // Reset initial values after save
      if (savedConfig.logo_url) {
        setLogoPreview(savedConfig.logo_url);
      }
    } catch (error) {
      console.error('Error saving company config:', error);
      toast.error(error.detail || 'Failed to save company information');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CompanyInfoSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <div>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Business details for receipts and documents</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Enter company name"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label>Company Logo</Label>
              <div className="space-y-3">
                {logoPreview ? (
                  <div className="flex items-center space-x-4">
                    <img
                      src={logoPreview}
                      alt="Company logo"
                      className="h-16 w-auto object-contain border border-slate-200 dark:border-slate-700 rounded p-2"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveLogo}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove Logo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start space-y-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No logo uploaded. Company name will be displayed instead.
                    </p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="max-w-xs"
                  />
                  {uploading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supported formats: PNG, JPEG, GIF, WEBP (max 5MB)
                </p>
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="address_line1">Address Line 1 *</Label>
              <Input
                id="address_line1"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleChange}
                placeholder="Street address"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleChange}
                placeholder="Suite, unit, etc. (optional)"
              />
            </div>

            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                required
              />
            </div>

            <div>
              <Label htmlFor="state">Province *</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Province"
                required
              />
            </div>

            <div>
              <Label htmlFor="zip_code">Postal Code *</Label>
              <Input
                id="zip_code"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                placeholder="Postal Code"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
                required
              />
            </div>
          </div>

          {config && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Last updated: {formatBusinessDateTime(config.updated_at)} by {config.updated_by}
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {hasUnsavedChanges && (
              <div className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                ⚠️ You have unsaved changes
              </div>
            )}
            {!hasUnsavedChanges && <div></div>}
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              )}
              <Button type="submit" disabled={saving || !hasUnsavedChanges}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Company Information'
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanyInfoConfig;
