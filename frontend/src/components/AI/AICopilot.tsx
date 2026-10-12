/**
 * AI Disaster Copilot — Floating Chat Panel (Feature 1)
 * A persistent chat widget that answers NL questions about flood risk data.
 */
import React, { useState, useRef, useEffect } from 'react';
import { aiCopilotChat, type ChatMessage } from '../../services/aiService';
import { useAIKey } from '../../context/AIKeyContext';

interface AICopilotProps {
  contextData?: Record<string, unknown>;
}

interface DisplayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'Which blocks have the highest flood hazard?',
  'What are the main risk drivers in Thiruvananthapuram?',
  'Explain the HVRA scoring methodology',
  'What mitigation actions are recommended for HIGH risk zones?',
  'How is the composite risk score calculated?',
];

const AICopilot: React.FC<AICopilotProps> = ({ contextData }) => {
  const { apiKey, isKeySet } = useAIKey();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      content: '👋 Hello! I\'m your **AI Disaster Risk Copilot**. I can help you understand flood risk assessments, interpret scores, and recommend mitigation strategies.\n\nWhat would you like to know?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: DisplayMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError('');

    // Build history for OpenAI (last 5 turns only)
    const history: ChatMessage[] = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await aiCopilotChat(apiKey, { message: text, context_data: contextData, history });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
      }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (msg: DisplayMessage, idx: number) => {
    const isUser = msg.role === 'user';
    return (
      <div key={idx} style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '10px',
        marginBottom: '16px',
        alignItems: 'flex-start',
      }}>
        {/* Avatar */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: isUser
            ? 'linear-gradient(135deg, #c8742a, #e09a4a)'
            : 'linear-gradient(135deg, #1a4a6e, #2d7dd2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', color: '#fff', fontWeight: 700,
        }}>
          {isUser ? '👤' : '🤖'}
        </div>
        {/* Bubble */}
        <div style={{
          maxWidth: '78%',
          background: isUser
            ? 'linear-gradient(135deg, #c8742a, #d4854a)'
            : 'rgba(255,255,255,0.08)',
          color: '#f5e6c8',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          padding: '10px 14px',
          fontSize: '13px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          border: isUser ? 'none' : '1px solid rgba(200,116,42,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
          <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: isUser ? 'right' : 'left' }}>
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      <button
        id="ai-copilot-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Disaster Copilot"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          width: '56px', height: '56px', borderRadius: '50%',
          background: isKeySet
            ? 'linear-gradient(135deg, #1a4a6e 0%, #2d7dd2 100%)'
            : 'linear-gradient(135deg, #5a4a35 0%, #8a6a45 100%)',
          border: '2px solid rgba(200,116,42,0.5)',
          color: '#fff', fontSize: '22px',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s ease',
          animation: !isKeySet ? 'none' : 'aiPulse 2s infinite',
        }}
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '92px', right: '24px', zIndex: 9998,
          width: '380px', height: '520px',
          background: 'linear-gradient(160deg, #1e1a14 0%, #2a2218 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(200,116,42,0.35)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUpIn 0.3s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(90deg, #1a3a5c, #1e4870)',
            borderBottom: '1px solid rgba(200,116,42,0.3)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #2d7dd2, #1a4a6e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
            }}>🤖</div>
            <div>
              <div style={{ color: '#f5e6c8', fontWeight: 700, fontSize: '14px' }}>AI Disaster Copilot</div>
              <div style={{ color: '#c8953a', fontSize: '11px' }}>
                {isKeySet ? '● Connected' : '○ API Key Required'}
              </div>
            </div>
            {contextData && (
              <div style={{
                marginLeft: 'auto', fontSize: '10px', color: '#7a9ec2',
                background: 'rgba(45,125,210,0.15)', padding: '2px 8px', borderRadius: '10px',
              }}>
                📊 Context Loaded
              </div>
            )}
          </div>

          {!isKeySet ? (
            /* No API Key Warning */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
              <div style={{ color: '#f5e6c8', fontWeight: 600, marginBottom: '8px' }}>API Key Required</div>
              <div style={{ color: '#9a8a70', fontSize: '13px', marginBottom: '16px' }}>
                Please set your OpenAI API key in the AI Settings panel to use the Copilot.
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', scrollbarWidth: 'thin', scrollbarColor: '#5a4a35 transparent' }}>
                {messages.map(renderMessage)}
                {isLoading && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #1a4a6e, #2d7dd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🤖</div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px 16px 16px 16px', padding: '12px 16px', border: '1px solid rgba(200,116,42,0.2)' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: '#c8742a', animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {error && (
                  <div style={{
                    background: 'rgba(180,30,30,0.2)', border: '1px solid rgba(220,60,60,0.4)',
                    borderRadius: '8px', padding: '10px 14px', color: '#ff9a9a', fontSize: '12px', marginBottom: '12px',
                  }}>
                    ⚠️ {error}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Questions */}
              {messages.length === 1 && (
                <div style={{ padding: '0 12px 8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      style={{
                        background: 'rgba(200,116,42,0.1)', border: '1px solid rgba(200,116,42,0.3)',
                        color: '#d4953a', borderRadius: '12px', padding: '4px 10px', fontSize: '11px',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{
                padding: '12px', borderTop: '1px solid rgba(200,116,42,0.2)',
                display: 'flex', gap: '8px', alignItems: 'flex-end',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about flood risk, scores, or mitigation..."
                  rows={2}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(200,116,42,0.3)', borderRadius: '10px',
                    color: '#f5e6c8', padding: '8px 12px', fontSize: '13px',
                    resize: 'none', outline: 'none', fontFamily: 'inherit',
                    scrollbarWidth: 'thin',
                  }}
                />
                <button
                  id="ai-copilot-send-btn"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: input.trim() && !isLoading
                      ? 'linear-gradient(135deg, #c8742a, #e09a4a)'
                      : 'rgba(255,255,255,0.08)',
                    border: 'none', color: '#fff', fontSize: '16px',
                    cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 4px 30px rgba(45,125,210,0.5), 0 0 0 4px rgba(45,125,210,0.1); }
        }
      `}</style>
    </>
  );
};

export default AICopilot;
