'use client';

import App from '@/components/App';
import MainLayout from '@/components/Layout/MainLayout';

export default function GeneratePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <App />
      </div>
    </MainLayout>
  );
}
