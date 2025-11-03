import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Printer, Loader2, Search } from 'lucide-react';
import businessConfigService from '../../../services/businessConfigService';
import { toast } from 'sonner';
import { formatBusinessDateTime } from '../../../utils/timezoneUtils';

const PrinterConfig = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    default_receipt_printer: '',
    default_report_printer: ''
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
      const data = await businessConfigService.getPrinterConfig();

      setConfig(data);

      const newFormData = {
        default_receipt_printer: data.default_receipt_printer || '',
        default_report_printer: data.default_report_printer || ''
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
    } catch (error) {
      if (error.status !== 404) {
        console.error('Error fetching printer config:', error);
        toast.error('Failed to load printer configuration');
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

  const handleReset = () => {
    if (initialFormData) {
      setFormData(initialFormData);
      toast.info('Form reset to saved values');
    }
  };

  const handleBrowsePrinters = () => {
    // Create a hidden test page to trigger print dialog
    const testContent = `
      <html>
        <head>
          <title>Printer Selection - CashNow Solutions</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
            }
            h1 { color: #2563eb; margin-bottom: 20px; }
            p { font-size: 14px; color: #64748b; margin: 10px 0; }
            .info-box {
              background: #f1f5f9;
              border: 2px solid #2563eb;
              border-radius: 8px;
              padding: 20px;
              margin: 30px auto;
              max-width: 500px;
            }
          </style>
        </head>
        <body>
          <h1>Printer Configuration Test</h1>
          <div class="info-box">
            <p><strong>This is a test page to help you select your printer.</strong></p>
            <p>1. Look at the printer list in the print dialog</p>
            <p>2. Note the exact name of the printer you want to use</p>
            <p>3. Enter that name in the configuration form</p>
            <p>4. You can cancel this print - we're just browsing printers</p>
          </div>
        </body>
      </html>
    `;

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(testContent);
    iframeDoc.close();

    // Trigger print dialog after content loads
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();

      // Clean up after print dialog closes (or after 1 second)
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);

    toast.info('Opening print dialog to show available printers...');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      // Save and get the response
      const savedConfig = await businessConfigService.createPrinterConfig(formData);
      toast.success('Printer configuration saved successfully');

      // Use the save response directly instead of fetching again
      setConfig(savedConfig);
      const newFormData = {
        default_receipt_printer: savedConfig.default_receipt_printer || '',
        default_report_printer: savedConfig.default_report_printer || ''
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
    } catch (error) {
      console.error('Error saving printer config:', error);
      toast.error(error.detail || 'Failed to save printer configuration');
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
          <Printer className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div>
            <CardTitle>Printer Configuration</CardTitle>
            <CardDescription>Select default printers for receipts and reports</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Helper Button */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Not sure what your printer is called?
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                  Click below to open your system's print dialog and see all available printers.
                  Note the exact printer name and enter it in the fields below.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBrowsePrinters}
                  className="bg-white dark:bg-slate-800"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Browse Available Printers
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="default_receipt_printer">Receipt Printer</Label>
              <Input
                id="default_receipt_printer"
                name="default_receipt_printer"
                value={formData.default_receipt_printer}
                onChange={handleChange}
                placeholder="Leave blank for browser default"
              />
              <p className="text-xs text-slate-500 mt-1">Enter exact printer name or leave blank</p>
            </div>

            <div>
              <Label htmlFor="default_report_printer">Report Printer</Label>
              <Input
                id="default_report_printer"
                name="default_report_printer"
                value={formData.default_report_printer}
                onChange={handleChange}
                placeholder="Leave blank for browser default"
              />
              <p className="text-xs text-slate-500 mt-1">Enter exact printer name or leave blank</p>
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
            <div className="flex gap-2 md:ml-auto">
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
                  'Save Printer Configuration'
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PrinterConfig;
