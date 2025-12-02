import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, Upload, Save, Palette, Image as ImageIcon, Users, Plus, X } from 'lucide-react';
import { saveCompanyColors, getCompanyColors, getCompanyLogo, getContrastTextColor } from '@/utils/companyColors';
import { useAuth } from '@/contexts/AuthContext';
import { getOrganization, updateOrganization, getUsersByOrganization } from '@/lib/firestore';
import type { Organization } from '@/types';

const Company: React.FC = () => {
  const { user } = useAuth();
  const [logo, setLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [departments, setDepartments] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState('');

  // Load organization data and saved colors/logo on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user?.organization) {
        setIsLoading(false);
        return;
      }

      try {
        const [org, employees] = await Promise.all([
          getOrganization(user.organization),
          getUsersByOrganization(user.organization),
        ]);

        if (org) {
          setOrganization(org);
          setDepartments(org.departments);

          // Load logo from organization settings if available
          if (org.settings.logo) {
            setLogo(org.settings.logo);
          } else {
            // Fall back to localStorage
            const savedLogo = getCompanyLogo();
            if (savedLogo) {
              setLogo(savedLogo);
            }
          }
        }

        setEmployeeCount(employees.length);
      } catch (error) {
        console.error('[Company] Failed to load organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Load saved colors
    const savedColors = getCompanyColors();
    setColors(savedColors);
    setColorInputs(savedColors);
  }, [user?.organization]);

  const [colors, setColors] = useState({
    primary: '#F7F7F7',
    secondary: '#0E4191',
    background: '#191A1C',
  });

  const [colorInputs, setColorInputs] = useState({
    primary: '#F7F7F7',
    secondary: '#0E4191',
    background: '#191A1C',
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = (colorType: keyof typeof colors, value: string) => {
    setColors((prev) => ({
      ...prev,
      [colorType]: value,
    }));
    setColorInputs((prev) => ({
      ...prev,
      [colorType]: value,
    }));
  };

  const handleColorInputChange = (colorType: keyof typeof colors, value: string) => {
    // Always update the input field
    setColorInputs((prev) => ({
      ...prev,
      [colorType]: value,
    }));

    // Normalize the hex value (add # if missing, handle 3-char hex)
    let normalizedValue = value.trim();
    
    // Remove # if present to normalize
    if (normalizedValue.startsWith('#')) {
      normalizedValue = normalizedValue.slice(1);
    }
    
    // Validate hex characters only
    const hexCharPattern = /^[A-Fa-f0-9]+$/;
    if (normalizedValue === '' || hexCharPattern.test(normalizedValue)) {
      // If valid hex characters, format and update
      if (normalizedValue.length === 3) {
        // Expand 3-char hex to 6-char (e.g., fff -> ffffff)
        normalizedValue = normalizedValue.split('').map(char => char + char).join('');
      }
      
      if (normalizedValue.length === 6) {
        // Valid 6-character hex, add # and update color
        const fullHex = '#' + normalizedValue;
        setColors((prev) => ({
          ...prev,
          [colorType]: fullHex,
        }));
        // Update input to show the formatted value
        setColorInputs((prev) => ({
          ...prev,
          [colorType]: fullHex,
        }));
      } else if (normalizedValue === '') {
        // Empty input, keep current color
        return;
      }
      // If length is not 3 or 6, don't update color but keep input value
    }
  };

  const handleAddDepartment = () => {
    if (newDepartment.trim() && !departments.includes(newDepartment.trim())) {
      setDepartments([...departments, newDepartment.trim()]);
      setNewDepartment('');
    }
  };

  const handleRemoveDepartment = (dept: string) => {
    setDepartments(departments.filter(d => d !== dept));
  };

  const handleSave = async () => {
    if (!organization || !user?.organization) {
      alert('Organization not found');
      return;
    }

    try {
      // Save to Firestore
      await updateOrganization(user.organization, {
        departments,
        settings: {
          ...organization.settings,
          ...(logo ? { logo } : {}), // Only include logo if it exists
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          backgroundColor: colors.background,
        },
      });

      // Also save to localStorage for quick access
      saveCompanyColors({
        primary: colors.primary,
        secondary: colors.secondary,
        background: colors.background,
        logo: logo || null,
      });

      alert('Company settings saved successfully!');
    } catch (error) {
      console.error('[Company] Failed to save settings:', error);
      alert('Failed to save company settings. Please try again.');
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear saved logo from storage
    localStorage.removeItem('company_logo');
  };

  // Calculate dynamic text colors based on background colors
  const textColors = useMemo(() => {
    return {
      primary: getContrastTextColor(colors.primary),
      secondary: getContrastTextColor(colors.secondary),
      background: getContrastTextColor(colors.background),
    };
  }, [colors.primary, colors.secondary, colors.background]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-dark-text-muted">Loading company settings...</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-dark-text-muted">Organization not found</div>
      </div>
    );
  }

  const panelClass = 'rounded-2xl border border-dark-border/70 bg-dark-card/80 p-6';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-10 border-b border-dark-border/70 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-dark-text-muted">Organization Profile</p>
            <h1 className="mt-3 text-4xl font-semibold text-dark-text">Company Settings</h1>
            <p className="mt-2 max-w-2xl text-sm text-dark-text-muted">
              Fine-tune your company branding, departments, and visual system used across the DiCode suite.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-dark-text-muted">
              <span>
                <span className="text-dark-text font-semibold">{employeeCount}</span> employees
              </span>
              <span>
                <span className="text-dark-text font-semibold">{departments.length}</span> departments
              </span>
              <span>
                <span className="text-dark-text font-semibold">{organization.size || '—'}</span> org size
              </span>
            </div>
          </div>
          <div className="text-right max-w-sm text-xs text-dark-text-muted">
            Updates here power the employee and campaign experiences automatically. Review colors and logos before saving.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization Info Section */}
          <div className={panelClass}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={20} className="text-primary" />
                  <span className="text-xs uppercase tracking-wider text-dark-text-muted">Organization</span>
                </div>
                <h2 className="text-3xl font-bold text-dark-text mb-2">{organization.name}</h2>
                <p className="text-sm text-dark-text-muted mb-6">
                  {organization.industry || 'Technology'} • {organization.region || 'Global'} • {organization.size || 'Small'} company
                </p>

                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-xs text-dark-text-muted mb-1">URL Slug</p>
                    <p className="text-sm font-medium text-dark-text">{organization.slug}</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-text-muted mb-1">Total Employees</p>
                    <div className="flex items-center gap-1.5">
                      <Users size={16} className="text-primary" />
                      <p className="text-sm font-medium text-dark-text">{employeeCount}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-dark-text-muted mb-1">Departments</p>
                    <p className="text-sm font-medium text-dark-text">{departments.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Departments Section */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-dark-text">Departments</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">Add Department</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddDepartment()}
                    placeholder="e.g., Marketing, Engineering, Sales"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddDepartment}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
              </div>

              {departments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-dark-text mb-3">
                    Departments ({departments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {departments.map((dept) => (
                      <span
                        key={dept}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {dept}
                        <button
                          type="button"
                          onClick={() => handleRemoveDepartment(dept)}
                          className="hover:text-primary-light"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ImageIcon size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-dark-text">Company Logo</h2>
            </div>

            <div className="space-y-4">
              {/* Logo Preview */}
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 border-2 border-dashed border-dark-border rounded-lg flex items-center justify-center bg-dark-card relative overflow-hidden">
                  {logo ? (
                    <img
                      src={logo}
                      alt="Company Logo"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <img
                      src="/DI-Code-Logo.png"
                      alt="DI Code Logo"
                      className="w-full h-full object-contain p-2"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text hover:bg-dark-bg transition-colors cursor-pointer"
                    >
                      <Upload size={16} />
                      {logo ? 'Change Logo' : 'Upload Logo'}
                    </label>
                  </div>
                  {logo && (
                    <button
                      onClick={handleRemoveLogo}
                      className="px-4 py-2 bg-dark-card border border-red-500/50 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors text-sm"
                    >
                      Remove Logo
                    </button>
                  )}
                  <p className="text-xs text-dark-text-muted">
                    Recommended: PNG or SVG format, transparent background. Max 5MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Color Settings Section */}
          <div className={panelClass}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side - Color Palette Title and Selectors */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Palette size={24} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-dark-text">Color Palette</h2>
                </div>

                {/* Color Selectors */}
                <div className="space-y-6">
                  {/* Primary Color */}
                  <div>
                    <label className="block text-sm font-medium text-dark-text mb-3">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colors.primary}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="w-16 h-16 rounded-lg border-2 border-dark-border cursor-pointer"
                      />
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={colorInputs.primary}
                          onChange={(e) => handleColorInputChange('primary', e.target.value)}
                          placeholder="#000000"
                          className="input w-32 font-mono text-sm"
                          maxLength={7}
                        />
                        <p className="text-xs text-dark-text-muted">Hex code</p>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div>
                    <label className="block text-sm font-medium text-dark-text mb-3">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colors.secondary}
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="w-16 h-16 rounded-lg border-2 border-dark-border cursor-pointer"
                      />
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={colorInputs.secondary}
                          onChange={(e) => handleColorInputChange('secondary', e.target.value)}
                          placeholder="#000000"
                          className="input w-32 font-mono text-sm"
                          maxLength={7}
                        />
                        <p className="text-xs text-dark-text-muted">Hex code</p>
                      </div>
                    </div>
                  </div>

                  {/* Background Color */}
                  <div>
                    <label className="block text-sm font-medium text-dark-text mb-3">
                      Background Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colors.background}
                        onChange={(e) => handleColorChange('background', e.target.value)}
                        className="w-16 h-16 rounded-lg border-2 border-dark-border cursor-pointer"
                      />
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={colorInputs.background}
                          onChange={(e) => handleColorInputChange('background', e.target.value)}
                          placeholder="#000000"
                          className="input w-32 font-mono text-sm"
                          maxLength={7}
                        />
                        <p className="text-xs text-dark-text-muted">Hex code</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Live Preview */}
              <div className="pr-4">
                <div
                  className="rounded-lg border-2 border-dark-border overflow-hidden"
                  style={{ backgroundColor: colors.background }}
                >
                  {/* Header Preview */}
                  <div
                    className="pt-3 px-4 pb-8"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <div className="flex items-center justify-center mb-2 relative">
                      <div className="h-12 flex items-center">
                        {logo ? (
                          <img
                            src={logo}
                            alt="Logo"
                            className="h-full object-contain"
                          />
                        ) : (
                          <img
                            src="/DI-Code-Logo.png"
                            alt="DI Code Logo"
                            className="h-full object-contain"
                          />
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold mb-1" style={{ color: textColors.primary }}>
                      Welcome back, John
                    </h4>
                    <p className="text-xs" style={{ color: textColors.primary, opacity: 0.8 }}>
                      Continue your leadership journey
                    </p>
                  </div>

                  {/* Progress Card Preview */}
                  <div className="px-4 -mt-6 mb-3">
                    <div
                      className="rounded-lg p-3 shadow-lg"
                      style={{
                        backgroundColor: colors.secondary,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: textColors.secondary }}>
                          Your Progress
                        </span>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="text-2xl font-bold" style={{ color: textColors.secondary }}>
                          2/3
                        </div>
                        <div className="text-xs mb-1" style={{ color: textColors.secondary, opacity: 0.8 }}>
                          modules completed
                        </div>
                      </div>
                      <div 
                        className="mt-2 rounded-full h-1"
                        style={{ backgroundColor: `${textColors.secondary}33` }}
                      >
                        <div
                          className="rounded-full h-1 transition-all"
                          style={{ 
                            width: '67%',
                            backgroundColor: textColors.secondary,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Module Card Preview */}
                  <div className="px-4 mb-4">
                    <h5
                      className="text-xs font-semibold mb-2"
                      style={{ color: textColors.background }}
                    >
                      Your Learning Program
                    </h5>
                    <div
                      className="rounded-lg p-3 border"
                      style={{
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      }}
                    >
                      <div className="flex gap-2 mb-2">
                        <div
                          className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: colors.secondary,
                          }}
                        >
                          <span className="text-xs" style={{ color: textColors.secondary }}>▶</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h6 className="text-xs font-semibold mb-1 line-clamp-1" style={{ color: textColors.primary }}>
                            The Mentor Match
                          </h6>
                          <p className="text-xs line-clamp-1 mb-2" style={{ color: textColors.primary, opacity: 0.8 }}>
                            Learn how to provide constructive feedback
                          </p>
                          <div className="flex gap-1 mb-2">
                            <span 
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ 
                                backgroundColor: `${textColors.primary}33`,
                                color: textColors.primary,
                              }}
                            >
                              Empathy
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="w-full rounded text-xs font-medium py-1.5"
                        style={{
                          backgroundColor: colors.secondary,
                          color: textColors.secondary,
                        }}
                      >
                        Continue Module
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>

        {/* Sidebar - Brand Preview */}
        <div className="space-y-6">
          {/* Color Preview Card */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-primary/10 rounded-lg">
                <Building2 size={20} className="text-blue-primary" />
              </div>
              <h3 className="text-lg font-semibold text-dark-text">Brand Preview</h3>
            </div>

            <div className="space-y-4">
              {/* Logo Preview */}
              <div
                className="p-6 rounded-lg border border-dark-border flex items-center justify-center"
                style={{ backgroundColor: colors.background }}
              >
                {logo ? (
                  <img
                    src={logo}
                    alt="Logo Preview"
                    className="max-h-16 max-w-full object-contain"
                  />
                ) : (
                  <img
                    src="/DI-Code-Logo.png"
                    alt="DI Code Logo"
                    className="max-h-16 max-w-full object-contain"
                  />
                )}
              </div>

              {/* Color Swatches */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-dark-text-muted mb-2">Primary</p>
                  <div
                    className="h-8 rounded border border-dark-border"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <p className="text-xs font-mono text-dark-text-muted mt-1">{colors.primary}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-text-muted mb-2">Secondary</p>
                  <div
                    className="h-8 rounded border border-dark-border"
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <p className="text-xs font-mono text-dark-text-muted mt-1">{colors.secondary}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-text-muted mb-2">Background</p>
                  <div
                    className="h-8 rounded border border-dark-border"
                    style={{ backgroundColor: colors.background }}
                  />
                  <p className="text-xs font-mono text-dark-text-muted mt-1">{colors.background}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className={`${panelClass} bg-blue-primary/5 border-blue-primary/30`}>
            <h3 className="text-sm font-semibold text-dark-text mb-2">Tips</h3>
            <ul className="text-xs text-dark-text-muted space-y-1">
              <li>• Use high-contrast colors for accessibility</li>
              <li>• Test colors on different backgrounds</li>
              <li>• Ensure text is readable on background</li>
              <li>• Logo should work on light and dark themes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Company;

