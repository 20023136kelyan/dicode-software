import { useState, useEffect } from 'react';
import { getCompanyColors, CompanyColors } from '@/utils/companyColors';

export const useCompanyColors = () => {
  const [colors, setColors] = useState<CompanyColors>(getCompanyColors());

  useEffect(() => {
    const handleColorUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<CompanyColors>;
      setColors(customEvent.detail);
    };

    window.addEventListener('companyColorsUpdated', handleColorUpdate);
    return () => {
      window.removeEventListener('companyColorsUpdated', handleColorUpdate);
    };
  }, []);

  return colors;
};

