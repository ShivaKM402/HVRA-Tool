import React, { useState, useRef, useEffect } from 'react';
import { askHVRA } from '../../services/api';
import './AskHVRAPanel.css';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  query_type?: string;
  ai_generated?: boolean;
  timestamp: Date;
}

interface AskHVRAPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: object;
}

let msgId = 0;

export default function AskHVRAPanel({ isOpen, onClose, context }: AskHVRAPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: ++msgId,
      role: 'assistant',
      content:
        '👋 Hello! I am the **HVRA Assistant** — your AI copilot for Kerala flood risk intelligence.\n\nAsk me anything about hazard scores, vulnerable areas, mitigation priorities, or how to use this platform.',
      ai_generated: true,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = {
      id: ++msgId,
      role: 'user',
      content: q,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await askHVRA(q, context);
      const assistantMsg: Message = {
        id: ++msgId,
        role: 'assistant',
        content: result.answer,
        query_type: result.query_type,
        ai_generated: result.ai_generated,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgId,
          role: 'assistant',
          content: '⚠️ Connection error. Please check your network and try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const SUGGESTIONS = [
    'Which areas have the highest flood hazard?',
    'What does a High Hazard score mean?',
    'What actions should PWD take?',
    'How is the risk score calculated?',
  ];

  if (!isOpen) return null;

  return (
    <div className="hvra-panel-overlay" onClick={onClose}>
      <div className="hvra-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="hvra-panel-header">
          <div className="hvra-panel-title">
            <span className="hvra-icon">🌊</span>
            <div>
              <div className="hvra-title-text">Ask HVRA</div>
              <div className="hvra-subtitle">AI Flood Risk Intelligence Assistant</div>
            </div>
          </div>
          <button className="hvra-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* AI Disclaimer */}
        <div className="hvra-disclaimer">
          ✨ AI-powered — responses are advisory only. Verify critical decisions with official data.
        </div>

        {/* Messages */}
        <div className="hvra-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`hvra-msg hvra-msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="hvra-msg-avatar">🌊</div>
              )}
              <div className="hvra-msg-bubble">
                <div
                  className="hvra-msg-content"
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>'),
                  }}
                />
                {msg.query_type && msg.query_type !== 'general' && (
                  <span className={`hvra-badge hvra-badge--${msg.query_type}`}>
                    {msg.query_type === 'advisory' ? '📋 Advisory' : '🔍 Filter Query'}
                  </span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="hvra-msg hvra-msg--assistant">
              <div className="hvra-msg-avatar">🌊</div>
              <div className="hvra-msg-bubble hvra-msg-bubble--loading">
                <span className="hvra-dot" /><span className="hvra-dot" /><span className="hvra-dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion chips (shown when only greeting is present) */}
        {messages.length === 1 && (
          <div className="hvra-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="hvra-suggestion-chip"
                onClick={() => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="hvra-input-row">
          <textarea
            ref={inputRef}
            className="hvra-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about flood risk, hazard scores, priorities…"
            rows={2}
            disabled={loading}
          />
          <button
            className="hvra-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}

