'use client';

import { useState, useMemo } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { createSupportTicket } from '@/lib/firestore';
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
  FileQuestion,
  Send,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
  FolderOpen,
  Settings,
  Users,
} from 'lucide-react';

// FAQ Categories
type FAQCategory = 'all' | 'campaigns' | 'videos' | 'access' | 'general';

interface FAQItem {
  question: string;
  answer: string;
  category: FAQCategory;
  keywords: string[];
}

interface QuickLink {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const faqCategories: { id: FAQCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All Topics', icon: HelpCircle },
  { id: 'campaigns', label: 'Campaigns', icon: LayoutGrid },
  { id: 'videos', label: 'Videos', icon: Film },
  { id: 'access', label: 'Access & Users', icon: Shield },
  { id: 'general', label: 'General', icon: Settings },
];

const faqs: FAQItem[] = [
  {
    question: 'How do I create a new campaign?',
    answer:
      'Navigate to Campaigns from the sidebar, then click the "New Campaign" button. You can start from scratch or use one of our pre-built templates. Follow the step-by-step wizard to configure your campaign settings, select competencies, and add videos.',
    category: 'campaigns',
    keywords: ['create', 'new', 'campaign', 'wizard', 'template', 'start'],
  },
  {
    question: 'How do I add videos to a campaign?',
    answer:
      'When creating or editing a campaign, navigate to the "Videos" step. You can select videos from your library by clicking on them. Use the search and filter options to find specific videos. Drag and drop to reorder videos within your campaign.',
    category: 'campaigns',
    keywords: ['add', 'video', 'campaign', 'select', 'library', 'drag', 'drop', 'order'],
  },
  {
    question: 'How do I publish a campaign?',
    answer:
      'After configuring your campaign, click the "Publish" button on the campaign detail page. Published campaigns become available to the assigned organizations. You can unpublish a campaign at any time to make changes.',
    category: 'campaigns',
    keywords: ['publish', 'campaign', 'live', 'available', 'unpublish'],
  },
  {
    question: 'How does AI video generation work?',
    answer:
      'Our AI video generator uses advanced machine learning models (Sora 2) to create engaging videos based on your prompts. Simply describe what you want, select any assets to include (characters, environments, lighting), and the system will generate a video. You can then save it to your library or regenerate with different parameters.',
    category: 'videos',
    keywords: ['AI', 'generate', 'sora', 'prompt', 'assets', 'create', 'machine learning'],
  },
  {
    question: 'What video formats are supported?',
    answer:
      'We support most common video formats including MP4, MOV, and WebM. For best results, we recommend MP4 with H.264 encoding. Uploaded videos are automatically processed and optimized for playback across all devices.',
    category: 'videos',
    keywords: ['format', 'MP4', 'MOV', 'WebM', 'upload', 'supported', 'encoding'],
  },
  {
    question: 'Can I edit videos after generation?',
    answer:
      'Currently, generated videos cannot be edited directly in the platform. However, you can regenerate videos with modified prompts, use the remix feature to create variations, or download them to edit in external video editing software.',
    category: 'videos',
    keywords: ['edit', 'modify', 'regenerate', 'remix', 'download', 'external'],
  },
  {
    question: 'How do I upload my own videos?',
    answer:
      'Go to the Video Library page and click "Upload Video". Select a video file from your computer (max 500MB). You\'ll be prompted to add metadata including title, description, competency tags, and assessment questions before the video is saved.',
    category: 'videos',
    keywords: ['upload', 'own', 'video', 'library', 'file', 'metadata'],
  },
  {
    question: 'How do I manage team access?',
    answer:
      'Go to Access Control in the sidebar to manage user permissions. You can view all users with access, modify their roles, and control what actions they can perform. Only users with @di-code.de email addresses can access the platform.',
    category: 'access',
    keywords: ['team', 'access', 'permission', 'role', 'user', 'manage'],
  },
  {
    question: 'How are campaigns assigned to organizations?',
    answer:
      'Campaigns can be assigned to specific client organizations during creation. In the campaign wizard, select target organizations from the "Access" step. Assigned campaigns will appear in the client portal for that organization\'s users.',
    category: 'access',
    keywords: ['assign', 'organization', 'client', 'target', 'access'],
  },
  {
    question: 'How do I view client organizations?',
    answer:
      'Navigate to the Clients page from the sidebar. Here you can see all registered organizations, their details, user counts, and active campaigns. Click on any organization to view more details and manage their settings.',
    category: 'access',
    keywords: ['client', 'organization', 'view', 'list', 'details'],
  },
  {
    question: 'What are competencies and skills?',
    answer:
      'Competencies are the main behavioral areas we focus on (e.g., "Foster Psychological Safety"). Each competency contains multiple skills (e.g., "Mitigate Bias", "Encourage Participation"). Videos and campaigns are tagged with competencies to help organize learning content.',
    category: 'general',
    keywords: ['competency', 'skill', 'behavior', 'tag', 'organize', 'learning'],
  },
  {
    question: 'How do I manage competencies?',
    answer:
      'Go to Main Settings from the sidebar. In the "Competencies & Skills" section, you can add, edit, or remove competencies and their associated skills. Changes are reflected across all campaigns and videos.',
    category: 'general',
    keywords: ['manage', 'competency', 'settings', 'add', 'edit', 'remove'],
  },
  {
    question: 'What are prompt assets?',
    answer:
      'Prompt assets are reusable elements for AI video generation. They include characters (people/personas), environments (locations/settings), lighting setups, and camera movements. Using consistent assets helps maintain visual coherence across your videos.',
    category: 'videos',
    keywords: ['asset', 'prompt', 'character', 'environment', 'lighting', 'camera', 'reusable'],
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can reach our support team by filling out the contact form on this page, or by emailing support@di-code.de directly. For technical issues, contact it@di-code.de. We typically respond within 24 business hours.',
    category: 'general',
    keywords: ['contact', 'support', 'email', 'help', 'technical', 'issue'],
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
  {
    title: 'Prompt Assets',
    description: 'Manage reusable video generation assets',
    icon: FolderOpen,
    href: '/assets',
  },
  {
    title: 'Client Organizations',
    description: 'View and manage client organizations',
    icon: Users,
    href: '/clients',
  },
];

// Highlight matching text in search results
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

type TicketPriority = 'low' | 'medium' | 'high';
type TicketCategory = 'bug' | 'feature' | 'question' | 'other';

export default function HelpPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory>('all');
  const [expandedFAQs, setExpandedFAQs] = useState<Set<number>>(new Set());
  
  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactPriority, setContactPriority] = useState<TicketPriority>('medium');
  const [contactCategory, setContactCategory] = useState<TicketCategory>('question');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Filter FAQs by search query and category
  const filteredFAQs = useMemo(() => {
    return faqs.filter((faq) => {
      // Category filter
      if (selectedCategory !== 'all' && faq.category !== selectedCategory) {
        return false;
      }
      
      // Search filter
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.keywords.some(kw => kw.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, selectedCategory]);

  const toggleFAQ = (index: number) => {
    setExpandedFAQs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactSubject.trim() || !contactMessage.trim()) {
      setContactError('Please fill in all required fields');
      return;
    }

    setSubmittingContact(true);
    setContactError(null);

    try {
      // Create support ticket in Firestore
      await createSupportTicket({
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || 'unknown',
        userName: user?.displayName || undefined,
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
        priority: contactPriority,
        category: contactCategory,
      });

      setContactSuccess(true);
      setContactSubject('');
      setContactMessage('');
      setContactPriority('medium');
      setContactCategory('question');
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setContactSuccess(false);
        setShowContactForm(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to submit support ticket:', error);
      setContactError('Failed to submit your request. Please try emailing us directly.');
    } finally {
      setSubmittingContact(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 p-6">
        <div className="mx-auto max-w-4xl">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for help topics, keywords..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-xs text-slate-500">
                Found {filteredFAQs.length} result{filteredFAQs.length !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Quick Links
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                    <p className="text-xs font-medium text-slate-900">
                      {link.title}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-8">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Frequently Asked Questions
              </h2>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {faqCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {filteredFAQs.length > 0 ? (
                filteredFAQs.map((faq, index) => {
                  const isExpanded = expandedFAQs.has(index);
                  const CategoryIcon = faqCategories.find(c => c.id === faq.category)?.icon || FileQuestion;
                  
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFAQ(index)}
                        className="flex w-full items-center justify-between p-4 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <CategoryIcon className="h-4 w-4 text-slate-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            {highlightText(faq.question, searchQuery)}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <div
                        className={`grid transition-all duration-200 ease-in-out ${
                          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="pl-11 text-sm text-slate-600 leading-relaxed">
                              {highlightText(faq.answer, searchQuery)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <FileQuestion className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600">
                    No results found {searchQuery && `for "${searchQuery}"`}
                    {selectedCategory !== 'all' && ` in ${faqCategories.find(c => c.id === selectedCategory)?.label}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try a different search term or category
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="mt-3 text-xs font-medium text-sky-600 hover:text-sky-700"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Contact Section */}
          <div className="mb-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Get in Touch
            </h2>
            
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Contact Form Card */}
              <div 
                className={`rounded-xl border bg-white p-6 transition-all ${
                  showContactForm ? 'sm:col-span-3 border-sky-200' : 'border-slate-200 cursor-pointer hover:border-slate-300 hover:shadow-sm'
                }`}
                onClick={() => !showContactForm && setShowContactForm(true)}
              >
                {!showContactForm ? (
                  <>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                      <Send className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Submit a Request
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Fill out a form and we'll get back to you
                    </p>
                    <p className="mt-4 text-sm font-medium text-emerald-600">
                      Open Form →
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                          <Send className="h-5 w-5 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Submit a Support Request
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowContactForm(false);
                          setContactError(null);
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {contactSuccess ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
                          <CheckCircle className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-slate-900">Request Submitted!</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          We'll get back to you within 24 hours.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitContact} onClick={(e) => e.stopPropagation()}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                              Category
                            </label>
                            <select
                              value={contactCategory}
                              onChange={(e) => setContactCategory(e.target.value as TicketCategory)}
                              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                            >
                              <option value="question">Question</option>
                              <option value="bug">Bug Report</option>
                              <option value="feature">Feature Request</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                              Priority
                            </label>
                            <select
                              value={contactPriority}
                              onChange={(e) => setContactPriority(e.target.value as TicketPriority)}
                              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Subject *
                          </label>
                          <input
                            type="text"
                            value={contactSubject}
                            onChange={(e) => setContactSubject(e.target.value)}
                            placeholder="Brief description of your issue or question"
                            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                            required
                          />
                        </div>

                        <div className="mt-4">
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Message *
                          </label>
                          <textarea
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            placeholder="Describe your issue or question in detail..."
                            rows={4}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100 resize-none"
                            required
                          />
                        </div>

                        {contactError && (
                          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {contactError}
                          </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            Logged in as {user?.email}
                          </p>
                          <button
                            type="submit"
                            disabled={submittingContact}
                            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                          >
                            {submittingContact ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Submit Request
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>

              {/* Email Support */}
              {!showContactForm && (
                <>
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
                      Contact IT for technical issues
                    </p>
                    <a
                      href="mailto:it@di-code.de"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      it@di-code.de
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Documentation Link */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
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
              <a 
                href="https://docs.di-code.de" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                View Docs
                <ChevronRight className="h-4 w-4" />
              </a>
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
