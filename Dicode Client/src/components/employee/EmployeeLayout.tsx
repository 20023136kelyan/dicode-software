import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import AICopilot from '@/components/shared/AICopilot';

const EmployeeLayout: React.FC = () => {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg relative">
      {/* Main Content */}
      <main className="pb-20">
        <Outlet />
      </main>

      {/* Floating Copilot Button (mobile only) */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center hover:bg-primary-dark transition-colors z-40 lg:hidden"
      >
        <MessageSquare size={24} className="text-dark-bg" />
      </button>

      {/* AI Copilot */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          context={{ userRole: 'employee' }}
        />
      )}
    </div>
  );
};

export default EmployeeLayout;
