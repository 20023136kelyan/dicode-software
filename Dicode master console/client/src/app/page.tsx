'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutGrid, Sparkles, ArrowRight, LogOut } from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  bgGradient: string;
}

const tools: Tool[] = [
  {
    id: 'campaign-manager',
    name: 'Campaign Manager',
    description: 'Shape DiCode programs with the same polish as creation. Browse, filter, and activate your behavior campaigns.',
    icon: <LayoutGrid className="h-6 w-6" />,
    path: '/campaigns',
    color: 'text-sky-600',
    bgGradient: 'from-sky-50 to-blue-50',
  },
  {
    id: 'video-generator',
    name: 'Video Generator',
    description: 'Create amazing videos with AI using OpenAI\'s Sora 2 API. Generate, remix, and enhance your video content.',
    icon: <Sparkles className="h-6 w-6" />,
    path: '/generate',
    color: 'text-purple-600',
    bgGradient: 'from-purple-50 to-pink-50',
  },
];

export default function Home() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleToolClick = (path: string) => {
    router.push(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-sky-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/dicode_logo.png"
                alt="DiCode logo"
                width={56}
                height={56}
                priority
                className="rounded-2xl"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">DiCode Suite</p>
                <p className="text-base font-semibold text-slate-900">Workspace</p>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2">
                  <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-sm font-semibold text-white">
                    {(user.displayName || user.email)?.[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="space-y-12">
          {/* Hero Section */}
          <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-xl shadow-slate-100">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">DiCode Suite</p>
              <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Welcome to your DiCode workspace
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl">
                Access all your DiCode tools in one place. From campaign management to video generation, 
                everything you need to create and manage your programs is right here.
              </p>
            </div>
          </section>

          {/* Tools Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">Available Tools</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.path)}
                  className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-slate-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.bgGradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                  
                  <div className="relative z-10">
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tool.bgGradient} ${tool.color} shadow-sm`}>
                      {tool.icon}
                    </div>
                    
                    <h3 className="mb-2 text-lg font-semibold text-slate-900 group-hover:text-slate-900">
                      {tool.name}
                    </h3>
                    
                    <p className="mb-4 text-sm text-slate-600 line-clamp-3">
                      {tool.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 transition group-hover:text-slate-900">
                      <span>Open tool</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
