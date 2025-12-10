import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CopilotContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export const CopilotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CopilotContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </CopilotContext.Provider>
  );
};

export const useCopilot = () => {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error('useCopilot must be used within a CopilotProvider');
  }
  return context;
};
