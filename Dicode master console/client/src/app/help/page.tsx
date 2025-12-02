'use client';

import { useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import {
  HelpCircle,
  Book,
  MessageCircle,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  Film,
  LayoutGrid,
  Shield,
  Zap,
  FileQuestion,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface QuickLink {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const faqs: FAQItem[] = [
  {
    question: 'How do I create a new campaign?',
    answer:
      'Navigate to Campaigns from the sidebar, then click the "New Campaign" button. You can start from scratch or use one of our pre-built templates. Follow the step-by-step wizard to configure your campaign settings, select competencies, and add videos.',
  },
  {
    question: 'How does AI video generation work?',
    answer:
      'Our AI video generator uses advanced machine learning models to create engaging videos based on your prompts. Simply describe what you want, select any assets to include, and the system will generate a video. You can then save it to your library or regenerate with different parameters.',
  },
  {
    question: 'What video formats are supported?',
    answer:
      'We support most common video formats including MP4, MOV, and WebM. For best results, we recommend MP4 with H.264 encoding. Uploaded videos are automatically processed and optimized for playback across all devices.',
  },
  {
    question: 'How do I manage team access?',
    answer:
      'Go to Access Control in the sidebar to manage user permissions. You can view all users with access, modify their roles, and control what actions they can perform. Only users with @di-code.de email addresses can access the platform.',
  },
  {
    question: 'Can I edit videos after generation?',
    answer:
      'Currently, generated videos cannot be edited directly in the platform. However, you can regenerate videos with modified prompts, or download them to edit in external video editing software.',
  },
  {
    question: 'How are campaigns assigned to organizations?',
    answer:
      'Campaigns can be assigned to specific client organizations during creation. Navigate to the campaign settings to select target organizations. Assigned campaigns will appear in the client portal for that organization\'s users.',
  },
];

const quickLinks: QuickLink[] = [
  {
    title: 'Campaign Manager',
    description: 'Learn how to create and manage behavior campaigns',
    icon: LayoutGrid,
    href: '/campaigns',
  },
  {
    title: 'Video Generator',
    description: 'Generate AI-powered videos for your campaigns',
    icon: Sparkles,
    href: '/generate',
  },
  {
    title: 'Video Library',
    description: 'Browse and manage your video collection',
    icon: Film,
    href: '/videos',
  },
  {
    title: 'Access Control',
    description: 'Manage user permissions and roles',
    icon: Shield,
    href: '/access',
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const filteredFAQs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 shadow-lg shadow-violet-500/20">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Help & Support
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Find answers, learn how to use the platform, or get in touch
            </p>
          </div>

          {/* Search */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for help..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>

          {/* Quick Links */}
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Quick Links
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.title}
                    href={link.href}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {link.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                        {link.description}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {filteredFAQs.length > 0 ? (
                filteredFAQs.map((faq, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedFAQ(expandedFAQ === index ? null : index)
                      }
                      className="flex w-full items-center justify-between p-4 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <FileQuestion className="h-4 w-4 text-slate-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                          {faq.question}
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                          expandedFAQ === index ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedFAQ === index && (
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="pl-11 text-sm text-slate-600 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <FileQuestion className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600">
                    No results found for "{searchQuery}"
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try a different search term or browse the categories below
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contact Section */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100">
                <Mail className="h-6 w-6 text-sky-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Email Support
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Get help from our team via email
              </p>
              <a
                href="mailto:support@di-code.de"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700"
              >
                support@di-code.de
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                <MessageCircle className="h-6 w-6 text-violet-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                IT Team
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Contact the DiCode IT team for technical issues
              </p>
              <a
                href="mailto:it@di-code.de"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                it@di-code.de
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Documentation Link */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                  <Book className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Documentation</h3>
                  <p className="mt-0.5 text-sm text-slate-300">
                    Detailed guides and API documentation
                  </p>
                </div>
              </div>
              <button className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
                View Docs
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Version Info */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              DiCode Master Console • Version 1.0.0
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

