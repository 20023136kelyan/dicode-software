import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  X, 
  Send, 
  Sparkles, 
  Clock, 
  Maximize2,
  Minimize2,
  FileText,
  Lightbulb,
  HelpCircle,
  TrendingUp,
  Plus,
  Paperclip,
  Trash2,
  MessageSquare,
  ChevronLeft,
  PanelLeftClose,
  PanelLeft,
  Search,
  SquarePen,
  Folder,
} from 'lucide-react';
import { ChatMessage, CopilotContext } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import MarkdownRenderer from './MarkdownRenderer';
import {
  createChatSession,
  updateChatSession,
  getUserChatSessions,
  getChatSession,
  deleteChatSession,
} from '@/lib/firestore';

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotContext;
  initialSuggestions?: string[];
}

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
  color: string;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, context }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpandedVisible, setIsExpandedVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate contextual quick actions based on learning state
  const getContextualQuickActions = (): QuickAction[] => {
    const learningCtx = context.learningContext;
    
    if (context.userRole === 'admin') {
      return [
        { icon: TrendingUp, label: 'Analyze performance', prompt: 'Analyze our campaign performance and suggest improvements', color: 'from-amber-400 to-orange-500' },
        { icon: Lightbulb, label: 'Engagement ideas', prompt: 'Suggest ideas to improve employee engagement', color: 'from-violet-400 to-purple-500' },
        { icon: FileText, label: 'Draft description', prompt: 'Help me draft a compelling campaign description', color: 'from-emerald-400 to-teal-500' },
        { icon: HelpCircle, label: 'Explain analytics', prompt: 'Explain what our analytics data means', color: 'from-rose-400 to-pink-500' },
      ];
    }
    
    // Employee contextual actions
    const actions: QuickAction[] = [];
    
    // If just completed something, show relevant prompts
    if (learningCtx?.justCompleted) {
      const { type, title, score } = learningCtx.justCompleted;
      
      if (type === 'module') {
        actions.push({
          icon: HelpCircle,
          label: 'Explain concepts',
          prompt: `Explain the key concepts from "${title}" in a way I can apply at work`,
          color: 'from-blue-400 to-indigo-500'
        });
        
        if (score !== undefined && score < 70) {
          actions.push({
            icon: Lightbulb,
            label: 'Help me understand',
            prompt: `I scored ${score}% on "${title}". Can you explain the topic differently to help me understand better?`,
            color: 'from-amber-400 to-orange-500'
          });
        }
        
        actions.push({
          icon: FileText,
          label: 'Real-world examples',
          prompt: `Give me real-world examples of how to apply what I learned in "${title}"`,
          color: 'from-emerald-400 to-teal-500'
        });
      }
      
      if (type === 'campaign') {
        actions.push({
          icon: TrendingUp,
          label: 'Analyze my results',
          prompt: `I just completed the "${title}" campaign. Analyze my performance and suggest next steps`,
          color: 'from-violet-400 to-purple-500'
        });
      }
    }
    
    // If user has weak competencies, offer help
    if (learningCtx?.weakCompetencies && learningCtx.weakCompetencies.length > 0) {
      const weakComp = learningCtx.weakCompetencies[0];
      actions.push({
        icon: TrendingUp,
        label: `Improve ${weakComp}`,
        prompt: `I want to improve my ${weakComp} skills. What specific actions can I take?`,
        color: 'from-rose-400 to-pink-500'
      });
    }
    
    // If streak is at risk
    if (learningCtx?.streakStatus?.atRisk && learningCtx.streakStatus.current > 0) {
      actions.push({
        icon: Sparkles,
        label: 'Quick module',
        prompt: `Suggest a quick 5-minute learning activity to maintain my ${learningCtx.streakStatus.current}-day streak`,
        color: 'from-orange-400 to-red-500'
      });
    }
    
    // Add custom suggested prompts if provided
    if (learningCtx?.suggestedPrompts) {
      learningCtx.suggestedPrompts.forEach((prompt, idx) => {
        if (actions.length < 4) {
          actions.push({
            icon: idx % 2 === 0 ? Lightbulb : HelpCircle,
            label: prompt.slice(0, 20) + (prompt.length > 20 ? '...' : ''),
            prompt,
            color: idx % 2 === 0 ? 'from-cyan-400 to-blue-500' : 'from-purple-400 to-pink-500'
          });
        }
      });
    }
    
    // Fill with default actions if needed
    const defaultActions: QuickAction[] = [
      { icon: Lightbulb, label: 'Leadership advice', prompt: 'What should a leader do in this situation?', color: 'from-amber-400 to-orange-500' },
      { icon: TrendingUp, label: 'Improve scores', prompt: 'How can I improve my assessment scores?', color: 'from-violet-400 to-purple-500' },
      { icon: HelpCircle, label: 'Explain results', prompt: 'What do these results say about me?', color: 'from-emerald-400 to-teal-500' },
      { icon: FileText, label: 'Action plan', prompt: 'Create an action plan for my development', color: 'from-rose-400 to-pink-500' },
    ];
    
    while (actions.length < 4 && defaultActions.length > 0) {
      const action = defaultActions.shift();
      if (action && !actions.some(a => a.prompt === action.prompt)) {
        actions.push(action);
      }
    }
    
    return actions.slice(0, 4);
  };

  const quickActions = getContextualQuickActions();

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingHistory(true);
    try {
      const history = await getUserChatSessions(user.id);
      setChatHistory(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  // Save messages to current session (debounced)
  const saveMessages = useCallback(async (msgs: ChatMessage[], sessionId: string) => {
    if (!sessionId || msgs.length === 0) return;
    
    // Generate title from first user message
    const firstUserMsg = msgs.find(m => m.role === 'user');
    const title = firstUserMsg?.content.slice(0, 50) || 'New Chat';
    
    try {
      await updateChatSession(sessionId, msgs, title);
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }, []);

  // Create a new session when first message is sent
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    if (currentSessionId) return currentSessionId;
    
    try {
      const sessionId = await createChatSession({
        userId: user.id,
        organizationId: user.organization,
        title: 'New Chat',
        context: { userRole: context.userRole, currentPage: context.currentPage },
      });
      setCurrentSessionId(sessionId);
      return sessionId;
    } catch (error) {
      console.error('Error creating chat session:', error);
      return null;
    }
  }, [user?.id, user?.organization, currentSessionId, context.userRole, context.currentPage]);

  // Handle mount/unmount animations
  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setShouldRender(true);
      // Use double requestAnimationFrame for reliable animation on mobile
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      loadChatHistory();
    } else if (shouldRender) {
      setIsVisible(false);
      setIsExpandedVisible(false);
      closeTimeoutRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsExpanded(false);
        setShowHistory(false);
      }, 300);
    }
  }, [isOpen, loadChatHistory]);

  // Handle expand/collapse animations
  const handleExpand = () => {
    setIsExpanded(true);
    if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
    expandTimeoutRef.current = setTimeout(() => {
      setIsExpandedVisible(true);
    }, 10);
  };

  const handleCollapse = () => {
    setIsExpandedVisible(false);
    if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
    expandTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
    };
  }, []);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showHistory) {
          setShowHistory(false);
        } else if (isExpanded) {
          handleCollapse();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isExpanded, showHistory, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save messages when they change
  useEffect(() => {
    if (messages.length > 0 && currentSessionId) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveMessages(messages, currentSessionId);
      }, 1000);
    }
  }, [messages, currentSessionId, saveMessages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    await ensureSession();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const functions = getFunctions();
      const askCompanyBot = httpsCallable(functions, 'askCompanyBot');

      const result = await askCompanyBot({
        question: text,
        context,
      }) as { data: { answer: string, sources: any[] } };
      const { answer } = result.data;

      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling AI Copilot:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error while processing your request. Please try again later.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      const session = await getChatSession(sessionId);
      if (session) {
        setMessages(session.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
        setCurrentSessionId(sessionId);
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setChatHistory(prev => prev.filter(c => c.id !== sessionId));
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  if (!shouldRender) return null;

  const hasMessages = messages.length > 0;

  // History Panel Component
  const HistoryPanel = () => (
    <div className="h-full flex flex-col bg-dark-card">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-dark-border">
        <button
          onClick={() => setShowHistory(false)}
          className="p-1.5 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg rounded-lg transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold text-dark-text">Chat History</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 text-dark-text-muted mx-auto mb-3" />
            <p className="text-sm text-dark-text-muted">No chat history yet</p>
            <p className="text-xs text-dark-text-muted mt-1">Start a conversation to save it here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chatHistory.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleLoadSession(chat.id)}
                className={`group p-3 rounded-xl cursor-pointer transition ${
                  currentSessionId === chat.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-dark-bg hover:bg-dark-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-text truncate">{chat.title}</p>
                    {chat.lastMessage && (
                      <p className="text-xs text-dark-text-muted truncate mt-1">{chat.lastMessage}</p>
                    )}
                    <p className="text-xs text-dark-text-muted mt-2">
                      {new Date(chat.updatedAt).toLocaleDateString()} · {chat.messageCount} messages
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-dark-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-dark-border">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-dark-bg rounded-xl font-medium hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>
    </div>
  );

  // Full-screen expanded view
  if (isExpanded) {
    return (
      <div 
        className={`fixed inset-0 z-50 bg-dark-bg transition-all duration-300 ease-out ${
          isExpandedVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Unified Header + Sidebar Shell */}
        <div className="absolute inset-0">
          {/* Background shell - sidebar + header as one piece */}
          <div 
            className={`absolute top-0 left-0 h-full bg-dark-card transition-all duration-300 ${
              isSidebarCollapsed ? 'w-16' : 'w-72'
            }`} 
          />
          <div 
            className={`absolute top-0 right-0 h-[68px] bg-dark-card transition-all duration-300 ${
              isSidebarCollapsed ? 'left-16' : 'left-72'
            }`} 
          />
          
          {/* Curved corner piece - creates the arch effect */}
          <div 
            className={`absolute top-[68px] w-8 h-8 bg-dark-card transition-all duration-300 ${
              isSidebarCollapsed ? 'left-16' : 'left-72'
            }`}
          >
            <div className="w-full h-full bg-dark-bg rounded-tl-[32px]" />
          </div>
          
          {/* Content layout */}
          <div className="relative h-full flex">
            {/* Left Panel (Sidebar) */}
            <div 
              className={`flex flex-col transition-all duration-300 ${
                isSidebarCollapsed ? 'w-16' : 'w-72'
              }`}
            >
              {/* Sidebar Header - Logo & Collapse */}
              <div className={`flex items-center justify-between p-3 ${isSidebarCollapsed ? 'px-2 justify-center' : ''}`}>
                {!isSidebarCollapsed && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-dark-text">DI Copilot</span>
                  </div>
                )}
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-2 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg/50 rounded-lg transition"
                  title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isSidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </button>
              </div>

              {/* Navigation Items */}
              <div className={`px-2 space-y-0.5 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
                {/* New Chat */}
                <button
                  onClick={handleNewChat}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-dark-text hover:bg-dark-bg/50 transition ${
                    isSidebarCollapsed ? 'justify-center px-2' : ''
                  }`}
                  title={isSidebarCollapsed ? 'New chat' : undefined}
                >
                  <SquarePen className="h-5 w-5" />
                  {!isSidebarCollapsed && <span className="text-sm">New chat</span>}
                </button>

                {/* Search */}
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-dark-text-muted hover:bg-dark-bg/50 hover:text-dark-text transition ${
                    isSidebarCollapsed ? 'justify-center px-2' : ''
                  }`}
                  title={isSidebarCollapsed ? 'Search chats' : undefined}
                >
                  <Search className="h-5 w-5" />
                  {!isSidebarCollapsed && <span className="text-sm">Search chats</span>}
                </button>

                {/* Projects/Library */}
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-dark-text-muted hover:bg-dark-bg/50 hover:text-dark-text transition ${
                    isSidebarCollapsed ? 'justify-center px-2' : ''
                  }`}
                  title={isSidebarCollapsed ? 'Library' : undefined}
                >
                  <Folder className="h-5 w-5" />
                  {!isSidebarCollapsed && <span className="text-sm">Library</span>}
                </button>
              </div>

              {/* Divider */}
              <div className={`my-3 border-t border-dark-border/30 ${isSidebarCollapsed ? 'mx-2' : 'mx-3'}`} />
              
              {/* Chat History */}
              <div className={`flex-1 overflow-y-auto ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
                {!isSidebarCollapsed && (
                  <p className="px-3 mb-2 text-xs font-medium text-dark-text-muted">Your chats</p>
                )}
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                  </div>
                ) : chatHistory.length === 0 ? (
                  !isSidebarCollapsed && (
                    <p className="px-3 text-sm text-dark-text-muted">No chats yet</p>
                  )
                ) : (
                  <div className="space-y-0.5">
                    {chatHistory.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleLoadSession(chat.id)}
                        className={`group flex items-center rounded-lg cursor-pointer transition ${
                          isSidebarCollapsed ? 'p-2 justify-center' : 'px-3 py-2'
                        } ${
                          currentSessionId === chat.id
                            ? 'bg-dark-bg/70 text-dark-text'
                            : 'text-dark-text-muted hover:bg-dark-bg/40 hover:text-dark-text'
                        }`}
                        title={isSidebarCollapsed ? chat.title : undefined}
                      >
                        {isSidebarCollapsed ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <>
                            <span className="text-sm truncate flex-1">{chat.title}</span>
                            <button
                              onClick={(e) => handleDeleteSession(chat.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-dark-text-muted hover:text-red-400 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between h-[68px] px-6">
                <h1 className="text-lg font-semibold text-dark-text">AI Chat</h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCollapse}
                    className="p-2 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg rounded-lg transition"
                    title="Exit fullscreen"
                  >
                    <Minimize2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg rounded-lg transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col overflow-hidden bg-dark-bg rounded-tl-[32px]">
              {!hasMessages ? (
                /* Empty State - Full Screen */
                <div className="flex-1 flex flex-col items-center justify-center px-8">
                  <h2 className="text-4xl font-bold text-dark-text mb-4">
                    Welcome to DI Copilot
                  </h2>
                  <p className="text-lg text-dark-text-muted mb-12 max-w-lg text-center">
                    Get started by selecting a task and DI Copilot can do the rest. Not sure where to start?
                  </p>

                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-2 gap-4 max-w-xl w-full mb-12">
                    {quickActions.map((action, idx) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSend(action.prompt)}
                          className="group flex items-center gap-4 p-4 bg-dark-card border border-dark-border rounded-2xl hover:border-primary/50 hover:shadow-lg transition-all text-left"
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} flex-shrink-0`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <span className="text-base font-medium text-dark-text flex-1">{action.label}</span>
                          <Plus className="h-5 w-5 text-dark-text-muted opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Messages - Full Screen */
                <div className="flex-1 overflow-y-auto px-8 py-6">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((message) => (
                      <div key={message.id}>
                        {message.role === 'user' ? (
                          <div className="flex justify-end">
                            <div className="bg-primary text-dark-bg px-5 py-3 rounded-2xl rounded-br-md max-w-[70%]">
                              <p className="text-base">{message.content}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
                              <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 pt-1 min-w-0">
                              <MarkdownRenderer content={message.content} className="text-base" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                     {isTyping && (
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex items-center gap-1.5 pt-2">
                            <div className="w-2 h-2 bg-dark-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-dark-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-dark-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                     )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}

              {/* Input - Full Screen */}
              <div className="px-8 pb-6 pt-4">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden focus-within:border-primary/50 transition">
                    <div className="flex items-center gap-3 px-5 py-4">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                        placeholder="Ask DI Copilot anything..."
                        className="flex-1 bg-transparent border-none outline-none text-base text-dark-text placeholder:text-dark-text-muted"
                      />
                      <button
                        onClick={() => handleSend(input)}
                        disabled={!input.trim()}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-dark-bg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 border-t border-dark-border bg-dark-bg/50">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-sm text-dark-text-muted hover:text-dark-text transition">
                          <Paperclip className="h-4 w-4" />
                          Attach
                        </button>
                        <button className="flex items-center gap-2 text-sm text-dark-text-muted hover:text-dark-text transition">
                          <Sparkles className="h-4 w-4" />
                          Browse Prompts
                        </button>
                      </div>
                      <span className="text-xs text-dark-text-muted">{input.length} / 3,000</span>
                    </div>
                  </div>
                  <p className="text-xs text-dark-text-muted text-center mt-4">
                    DI Copilot may generate inaccurate information. Check important info.
                  </p>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Side panel view
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${
          isVisible && !isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Side Panel - Full width on mobile, max-w-md on larger screens */}
      <div className={`fixed inset-0 md:left-auto md:right-0 md:w-full md:max-w-md z-50 transform transition-all duration-300 ease-out ${
        isVisible && !isExpanded ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}>
        {showHistory ? (
          <HistoryPanel />
        ) : (
          <div className="h-full flex flex-col bg-dark-card border-l border-dark-border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
              <h2 className="text-base font-semibold text-dark-text">AI Chat</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg rounded-full text-sm font-medium text-dark-text hover:bg-dark-border transition"
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </button>
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg rounded-lg transition"
                  title="Chat history"
                >
                  <Clock className="h-5 w-5" />
                </button>
                <button
                  onClick={handleExpand}
                  className="hidden lg:flex p-2 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg rounded-lg transition"
                  title="Expand to fullscreen"
                >
                  <Maximize2 className="h-5 w-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-dark-text-muted hover:text-dark-text hover:bg-dark-bg rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {!hasMessages ? (
                /* Empty State */
                <div className="h-full flex flex-col items-center justify-center px-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 mb-6">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-dark-text mb-3">
                    Welcome to DI Copilot
                  </h3>
                  <p className="text-sm text-dark-text-muted mb-2">
                    DI Copilot can help answer questions or complete tasks.
                  </p>
                  <p className="text-sm text-dark-text-muted">
                    Select a quick action below or type your own question.
                  </p>
                </div>
              ) : (
                /* Messages */
                <div className="p-5 space-y-4">
                  {messages.map((message) => (
                    <div key={message.id}>
                      {message.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-primary text-dark-bg px-4 py-3 rounded-2xl rounded-br-md max-w-[85%]">
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 pt-0.5 min-w-0">
                            <MarkdownRenderer content={message.content} className="text-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <div className="w-1.5 h-1.5 bg-dark-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-dark-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-dark-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Quick Actions - Only show when no messages */}
            {!hasMessages && (
              <div className="px-5 pb-4">
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSend(action.prompt)}
                        className="flex-shrink-0 flex flex-col items-start gap-2 p-4 w-40 border border-dark-border bg-dark-bg rounded-xl hover:border-primary/50 hover:bg-dark-card transition text-left"
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="text-sm text-dark-text leading-snug">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-5 border-t border-dark-border">
              <div className="flex items-center gap-3 bg-dark-bg border border-dark-border rounded-full px-4 py-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                  placeholder="Write message..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-dark-text placeholder:text-dark-text-muted"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-dark-text-muted hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-dark-text-muted text-center mt-3">
                AI can make mistakes. Check important info.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AICopilot;
