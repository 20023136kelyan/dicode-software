import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { SidebarProvider, useSidebar } from './Sidebar';
import Header from './Header';

const AdminLayoutContent: React.FC = () => {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <main 
        className={`min-h-screen transition-all duration-300 pt-14 ${
          isCollapsed ? 'ml-[72px]' : 'ml-64'
        }`}
        data-scroll-container
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const AdminLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <AdminLayoutContent />
    </SidebarProvider>
  );
};

export default AdminLayout;
