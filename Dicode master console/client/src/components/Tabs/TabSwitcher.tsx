'use client';

interface TabSwitcherProps {
  activeTab: 'generate' | 'remix';
  onTabChange: (tab: 'generate' | 'remix') => void;
}

export default function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <div className="card rounded-2xl p-1.5 mb-6 inline-flex w-full max-w-md mx-auto">
      <button
        onClick={() => onTabChange('generate')}
        className={`flex-1 py-2.5 px-6 rounded-xl font-medium text-sm transition-all duration-200 ${
          activeTab === 'generate'
            ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
            : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
        }`}
      >
        Generate
      </button>
      <button
        onClick={() => onTabChange('remix')}
        className={`flex-1 py-2.5 px-6 rounded-xl font-medium text-sm transition-all duration-200 ${
          activeTab === 'remix'
            ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
            : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
        }`}
      >
        Remix
      </button>
    </div>
  );
}
