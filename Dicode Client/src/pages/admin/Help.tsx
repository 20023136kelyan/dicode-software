import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createSupportTicket, type TicketPriority, type TicketCategory } from '@/lib/firestore';
import {
  Search,
  Plus,
  Minus,
  Send,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
} from 'lucide-react';

// FAQ Categories
type FAQCategory = 'general' | 'campaigns' | 'employees' | 'analytics' | 'security';

interface FAQItem {
  question: string;
  answer: string;
  category: FAQCategory;
}

const faqCategories: { id: FAQCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'employees', label: 'Employees' },
  { id: 'analytics', label: 'Analytics & Reports' },
  { id: 'security', label: 'Security' },
];

const faqs: FAQItem[] = [
  // General
  {
    question: 'How do I get started with DiCode?',
    answer: 'After logging in, you\'ll see your dashboard with an overview of your organization. Start by inviting employees from the Employees page, then create your first campaign to begin developing leadership competencies across your team.',
    category: 'general',
  },
  {
    question: 'Are there training resources available for new users?',
    answer: 'Absolutely! We provide a range of training resources including video tutorials, documentation, and in-app guidance to help new users get up to speed. You can also contact our support team for personalized onboarding assistance.',
    category: 'general',
  },
  {
    question: 'What are competencies and skills?',
    answer: 'Competencies are the main behavioral areas we focus on (e.g., "Foster Psychological Safety"). Each competency contains multiple skills (e.g., "Active Listening", "Encourage Participation"). Campaigns target specific competencies to develop leadership behaviors.',
    category: 'general',
  },
  {
    question: 'How do I contact support?',
    answer: 'You can reach our support team by clicking "Contact support" at the bottom of this page, or by emailing support@di-code.de directly. We typically respond within 24 business hours.',
    category: 'general',
  },
  // Campaigns
  {
    question: 'How do I create a new campaign?',
    answer: 'Navigate to Campaigns from the sidebar, then click "New Campaign". You can start from a template or create a custom campaign. Follow the step-by-step wizard to configure competencies, select videos, add participants, and set the schedule.',
    category: 'campaigns',
  },
  {
    question: 'How do I add employees to a campaign?',
    answer: 'When creating or editing a campaign, navigate to the "Participants" step. You can target all employees, specific departments, cohorts, or select individual employees. Use the filters to find specific employees.',
    category: 'campaigns',
  },
  {
    question: 'Can I edit a campaign after publishing?',
    answer: 'Yes, you can pause a campaign to make changes. However, some settings like target competencies cannot be changed once employees have started participating. You can always adjust the schedule and add more participants.',
    category: 'campaigns',
  },
  {
    question: 'How do employees access their campaigns?',
    answer: 'Employees receive email notifications when enrolled in campaigns. They can log in to their employee portal to view assigned campaigns, watch videos, complete assessments, and track their progress.',
    category: 'campaigns',
  },
  // Employees
  {
    question: 'How do I invite new employees?',
    answer: 'Go to the Employees page and click "Invite Employee". Enter their email address and select their department. An invitation email will be sent with instructions to create their account and join your organization.',
    category: 'employees',
  },
  {
    question: 'How do I import multiple employees at once?',
    answer: 'On the Employees page, click "Import" to bulk add employees. You can upload a CSV file with employee details (name, email, department) or paste data directly. The system will validate the data before import.',
    category: 'employees',
  },
  {
    question: 'What are cohorts and how do I use them?',
    answer: 'Cohorts help you group employees for targeted campaigns. You can create cohorts based on teams, locations, or any criteria. When creating a campaign, you can target entire cohorts instead of selecting individuals.',
    category: 'employees',
  },
  // Analytics
  {
    question: 'What metrics are tracked?',
    answer: 'We track completion rates, time spent on videos, assessment scores, competency development progress, and engagement trends over time. All data is aggregated to protect individual privacy while providing actionable insights.',
    category: 'analytics',
  },
  {
    question: 'Can I export analytics data?',
    answer: 'Yes, you can export analytics data from the Analytics page. Click the export button to download a CSV or PDF report with campaign performance data, completion rates, and competency scores.',
    category: 'analytics',
  },
  {
    question: 'How often is analytics data updated?',
    answer: 'Analytics data is updated in real-time as employees complete activities. Dashboard metrics refresh automatically, and you can always pull the latest data by refreshing the page.',
    category: 'analytics',
  },
  // Security
  {
    question: 'How is employee data protected?',
    answer: 'We use industry-standard encryption for all data in transit and at rest. Access is controlled through role-based permissions, and we comply with GDPR and other data protection regulations.',
    category: 'security',
  },
  {
    question: 'Can employees see each other\'s responses?',
    answer: 'No, individual responses are private. Administrators only see aggregated data and anonymized insights. Employees can only view their own progress and scores.',
    category: 'security',
  },
  {
    question: 'How do I manage user access and permissions?',
    answer: 'Administrators can manage access from the Company settings. You can invite other admins, remove access, and control what data each role can see.',
    category: 'security',
  },
];

const Help: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory>('general');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  
  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactPriority, setContactPriority] = useState<TicketPriority>('medium');
  const [contactCategory, setContactCategory] = useState<TicketCategory>('question');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Escape key to close panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showContactForm) {
        setShowContactForm(false);
        setContactError(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showContactForm]);

  // Filter FAQs by search query and category
  const filteredFAQs = useMemo(() => {
    return faqs.filter((faq) => {
      if (faq.category !== selectedCategory) {
        return false;
      }
      
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, selectedCategory]);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(prev => prev === index ? null : index);
  };

  const handleSubmitContact = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!contactSubject.trim() || !contactMessage.trim()) {
      setContactError('Please fill in all required fields');
      return;
    }

    setSubmittingContact(true);
    setContactError(null);

    try {
      await createSupportTicket({
        userId: user?.id || 'anonymous',
        userEmail: user?.email || 'unknown',
        userName: user?.name || undefined,
        organizationId: user?.organization,
        organizationName: undefined, // Organization name not available in auth context
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
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Header Section */}
      <div className="text-center mb-12">
        <span className="text-sm font-medium text-primary">FAQ</span>
        <h1 className="mt-2 text-3xl font-bold text-dark-text">Frequently Asked Questions</h1>
        <p className="mt-3 text-dark-text-muted max-w-lg mx-auto">
          We compiled a list of answers to address your most pressing questions regarding our platform.
        </p>
        
        {/* Centered Search Bar */}
        <div className="mt-8 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="h-10 w-full rounded-full border border-dark-border bg-dark-card pl-10 pr-4 text-sm text-dark-text placeholder:text-dark-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-dark-text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Categories + FAQ */}
      <div className="flex gap-12 mb-12">
        {/* Left Sidebar - Categories */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {faqCategories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setExpandedFAQ(null);
                  }}
                  className={`relative w-full text-left px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'text-primary'
                      : 'text-dark-text-muted hover:text-dark-text'
                  }`}
                >
                  {/* Left bracket */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-primary text-2xl font-light opacity-60">(</span>
                  )}
                  <span className="pl-2">{cat.label}</span>
                  {/* Right bracket */}
                  {isActive && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-primary text-2xl font-light opacity-60">)</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content - FAQ List */}
        <div className="flex-1">
          {filteredFAQs.length > 0 ? (
            <div className="divide-y divide-dark-border">
              {filteredFAQs.map((faq, index) => {
                const isExpanded = expandedFAQ === index;
                
                return (
                  <div key={index} className="py-4">
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="flex w-full items-center justify-between text-left group"
                    >
                      <span className={`text-sm font-medium pr-4 ${isExpanded ? 'text-dark-text' : 'text-dark-text group-hover:text-primary'}`}>
                        {faq.question}
                      </span>
                      <span className="flex-shrink-0 text-dark-text-muted">
                        {isExpanded ? (
                          <Minus className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-in-out ${
                        isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm text-dark-text-muted leading-relaxed pr-8">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-dark-text-muted">
                No questions found {searchQuery && `for "${searchQuery}"`}
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm font-medium text-primary hover:text-primary/80"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Still Have Questions Banner */}
      <div className="max-w-2xl mx-auto flex items-center justify-between py-8">
        <div>
          <h3 className="text-lg font-semibold text-dark-text">Still have questions?</h3>
          <p className="mt-1 text-sm text-dark-text-muted">
            Please connect with our support team, we're happy to help!
          </p>
        </div>
        <button
          onClick={() => setShowContactForm(true)}
          className="rounded-full border border-dark-border bg-dark-card px-6 py-2.5 text-sm font-medium text-dark-text transition hover:border-primary hover:text-primary"
        >
          Contact support
        </button>
      </div>

      {/* Contact Support Side Panel */}
      {showContactForm && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-50 transition-opacity duration-300"
            onClick={() => {
              setShowContactForm(false);
              setContactError(null);
            }}
          />
          
          {/* Side Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 transform transition-transform duration-300 ease-out">
            <div className="h-full flex flex-col bg-dark-card border-l border-dark-border shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-dark-border">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                    <Send className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-dark-text">Contact Support</h2>
                    <p className="text-sm text-dark-text-muted">We typically respond within 24 hours</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowContactForm(false);
                    setContactError(null);
                  }}
                  className="p-2 rounded-lg text-dark-text-muted hover:text-dark-text hover:bg-dark-bg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {contactSuccess ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-6">
                      <CheckCircle className="h-10 w-10 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-dark-text">Request Submitted!</h3>
                    <p className="mt-2 text-dark-text-muted max-w-xs">
                      Thanks for reaching out. Our team will review your request and get back to you soon.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitContact} className="space-y-6">
                    {/* Category & Priority */}
                    <div className="grid gap-4 grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-dark-text mb-2">
                          Category
                        </label>
                        <select
                          value={contactCategory}
                          onChange={(e) => setContactCategory(e.target.value as TicketCategory)}
                          className="h-11 w-full rounded-xl border border-dark-border bg-dark-bg px-4 text-sm text-dark-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="question">Question</option>
                          <option value="bug">Bug Report</option>
                          <option value="feature">Feature Request</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-text mb-2">
                          Priority
                        </label>
                        <select
                          value={contactPriority}
                          onChange={(e) => setContactPriority(e.target.value as TicketPriority)}
                          className="h-11 w-full rounded-xl border border-dark-border bg-dark-bg px-4 text-sm text-dark-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-2">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        placeholder="What do you need help with?"
                        className="h-11 w-full rounded-xl border border-dark-border bg-dark-bg px-4 text-sm text-dark-text placeholder:text-dark-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-2">
                        Message
                      </label>
                      <textarea
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Please describe your issue or question in detail. Include any relevant information that might help us assist you faster."
                        rows={6}
                        className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-dark-text placeholder:text-dark-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        required
                      />
                    </div>

                    {/* Error */}
                    {contactError && (
                      <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        {contactError}
                      </div>
                    )}

                    {/* Info Card */}
                    <div className="rounded-xl bg-dark-bg border border-dark-border p-4">
                      <p className="text-xs text-dark-text-muted">
                        Submitting as <span className="text-dark-text font-medium">{user?.email}</span>
                      </p>
                    </div>
                  </form>
                )}
              </div>

              {/* Footer */}
              {!contactSuccess && (
                <div className="p-6 border-t border-dark-border bg-dark-bg/50">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactForm(false);
                        setContactError(null);
                      }}
                      className="flex-1 rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-medium text-dark-text transition hover:bg-dark-bg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitContact}
                      disabled={submittingContact || !contactSubject.trim() || !contactMessage.trim()}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-dark-bg transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingContact ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Help;
