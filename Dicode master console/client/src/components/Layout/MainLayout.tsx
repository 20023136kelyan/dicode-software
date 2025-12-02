'use client';

import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Floating Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto ml-80" data-scroll-container="true">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
