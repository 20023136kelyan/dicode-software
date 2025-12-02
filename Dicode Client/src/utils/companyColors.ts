export interface CompanyColors {
  primary: string;
  secondary: string;
  background: string;
  logo?: string | null;
}

const DEFAULT_COLORS: CompanyColors = {
  primary: '#F7F7F7',
  secondary: '#0E4191',
  background: '#191A1C',
};

const STORAGE_KEY = 'company_colors';
const LOGO_STORAGE_KEY = 'company_logo';

export const getCompanyColors = (): CompanyColors => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const logo = getCompanyLogo();
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        primary: parsed.primary || DEFAULT_COLORS.primary,
        secondary: parsed.secondary || DEFAULT_COLORS.secondary,
        background: parsed.background || DEFAULT_COLORS.background,
        logo: logo,
      };
    }
  } catch (e) {
    console.error('Failed to load company colors:', e);
  }
  return { ...DEFAULT_COLORS, logo: getCompanyLogo() };
};

export const saveCompanyColors = (colors: CompanyColors): void => {
  try {
    // Save colors (without logo data URL to keep storage size manageable)
    const { logo, ...colorsToSave } = colors;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colorsToSave));
    
    // Save logo separately if provided
    if (logo) {
      localStorage.setItem(LOGO_STORAGE_KEY, logo);
    } else {
      localStorage.removeItem(LOGO_STORAGE_KEY);
    }
    
    // Trigger a custom event to notify components of color changes
    window.dispatchEvent(new CustomEvent('companyColorsUpdated', { detail: colors }));
  } catch (e) {
    console.error('Failed to save company colors:', e);
  }
};

export const getCompanyLogo = (): string | null => {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to load company logo:', e);
    return null;
  }
};

export const applyCompanyColors = (colors: CompanyColors): void => {
  const root = document.documentElement;
  
  // Calculate a lighter version of secondary color for gradients
  const secondaryLight = adjustBrightness(colors.secondary, 30);
  
  // Calculate text colors based on background colors
  const primaryTextColor = getContrastTextColor(colors.primary);
  const secondaryTextColor = getContrastTextColor(colors.secondary);
  const backgroundTextColor = getContrastTextColor(colors.background);
  
  // Set CSS variables for employee theme on root element
  root.style.setProperty('--company-primary', colors.primary);
  root.style.setProperty('--company-secondary', colors.secondary);
  root.style.setProperty('--company-secondary-light', secondaryLight);
  root.style.setProperty('--company-background', colors.background);
  root.style.setProperty('--company-primary-text', primaryTextColor);
  root.style.setProperty('--company-secondary-text', secondaryTextColor);
  root.style.setProperty('--company-background-text', backgroundTextColor);
  
  // Also apply directly to employee theme elements if they exist
  const employeeThemes = document.querySelectorAll('.employee-theme');
  employeeThemes.forEach((theme) => {
    (theme as HTMLElement).style.setProperty('--company-primary', colors.primary);
    (theme as HTMLElement).style.setProperty('--company-secondary', colors.secondary);
    (theme as HTMLElement).style.setProperty('--company-secondary-light', secondaryLight);
    (theme as HTMLElement).style.setProperty('--company-background', colors.background);
    (theme as HTMLElement).style.setProperty('--company-primary-text', primaryTextColor);
    (theme as HTMLElement).style.setProperty('--company-secondary-text', secondaryTextColor);
    (theme as HTMLElement).style.setProperty('--company-background-text', backgroundTextColor);
  });
};

// Helper function to adjust color brightness (positive = lighter, negative = darker)
const adjustBrightness = (color: string, percent: number): string => {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
};

// Calculate relative luminance of a color (WCAG formula)
const getLuminance = (color: string): number => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Determine if text should be white or black based on background color
export const getContrastTextColor = (backgroundColor: string): string => {
  const luminance = getLuminance(backgroundColor);
  // If background is light (luminance > 0.5), use dark text, otherwise use light text
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

// Initialize colors on load
if (typeof window !== 'undefined') {
  const colors = getCompanyColors();
  applyCompanyColors(colors);
  
  // Listen for color updates
  window.addEventListener('companyColorsUpdated', ((e: CustomEvent<CompanyColors>) => {
    applyCompanyColors(e.detail);
  }) as EventListener);
}

