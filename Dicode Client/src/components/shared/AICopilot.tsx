import React, { useState, useRef, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { X, ThumbsUp, ThumbsDown, RotateCcw, Lightbulb, Send, Sparkles } from 'lucide-react';
import { ChatMessage, CopilotContext } from '@/types';

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotContext;
  initialSuggestions?: string[];
}

const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, context, initialSuggestions }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const defaultSuggestions = context.userRole === 'admin'
    ? [
      'What is this data telling us?',
      'What should we do to improve?',
      'How is this impacting our outcomes?',
    ]
    : [
      'What should a leader do in this situation?',
      'What do these results say about me?',
      'What does healthy leadership look like in this situation?',
    ];

  const suggestions = initialSuggestions || defaultSuggestions;

  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      // Add welcome message
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! How may I assist you today?',
          timestamp: new Date(),
          suggestedQuestions: suggestions,
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

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
      const { answer, sources } = result.data;
      console.log('RAG Sources:', sources);

      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
        // Add sources to the message if you want to display them (requires UI update)
        // For now we just show the answer
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

  const handleUndo = (messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex > 0) {
      setMessages((prev) => prev.slice(0, messageIndex));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-4">
      <div className="bg-[#0f0f0f] border border-white/10 w-full sm:w-96 h-full sm:h-[600px] sm:rounded-xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            <h3 className="font-semibold text-white">DI Copilot</h3>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-white/5 rounded">
              <span className="text-white/60 text-sm">•••</span>
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0f0f0f]">
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-blue-primary text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-tl-sm text-white">
                    {message.content}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <button
                      onClick={() => handleUndo(message.id)}
                      className="flex items-center gap-1 px-2 py-1 hover:bg-white/5 rounded"
                    >
                      <RotateCcw size={14} />
                      Undo
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 hover:bg-white/5 rounded">
                      <Lightbulb size={14} />
                      Explain
                    </button>
                    <button className="p-1 hover:bg-white/5 rounded">
                      <ThumbsUp size={14} />
                    </button>
                    <button className="p-1 hover:bg-white/5 rounded">
                      <ThumbsDown size={14} />
                    </button>
                  </div>

                  {/* Suggested Questions */}
                    {message.suggestedQuestions && (
                    <div className="space-y-2 mt-4">
                      {message.suggestedQuestions.map((question, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(question)}
                          className="w-full text-left px-4 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-sm text-white"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-tl-sm w-20">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-[#0f0f0f]">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-4 py-2">
            <button className="text-white/70 hover:text-white">
              <Sparkles size={20} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="Or ask a specific question"
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim()}
              className="text-white/70 hover:text-primary disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default AICopilot;
