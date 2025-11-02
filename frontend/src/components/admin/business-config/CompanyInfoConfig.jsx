import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Building2, Loader2 } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';

const CompanyInfoConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
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

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await businessConfigService.getCompanyConfig();
      setConfig(data);
      setFormData({
        company_name: data.company_name || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || ''
      });
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
      setFormData({
        company_name: savedConfig.company_name || '',
        address_line1: savedConfig.address_line1 || '',
        address_line2: savedConfig.address_line2 || '',
        city: savedConfig.city || '',
        state: savedConfig.state || '',
        zip_code: savedConfig.zip_code || '',
        phone: savedConfig.phone || '',
        email: savedConfig.email || '',
        license_number: savedConfig.license_number || '',
        website: savedConfig.website || ''
      });
    } catch (error) {
      console.error('Error saving company config:', error);
      toast.error(error.detail || 'Failed to save company information');
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
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
                required
              />
            </div>

            <div>
              <Label htmlFor="zip_code">ZIP Code *</Label>
              <Input
                id="zip_code"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                placeholder="ZIP Code"
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

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="info@company.com"
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://www.company.com"
              />
            </div>
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
              'Save Company Information'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanyInfoConfig;
