/**
 * AI Panel — Master container for all 3 AI features.
 * Shown as a slide-in side drawer from a toolbar button.
 * Includes: API Key Settings, Copilot, Report Generator, Weight Calibrator
 */
import React, { useState } from 'react';
import { useAIKey } from '../../context/AIKeyContext';
import AIReportGenerator from './AIReportGenerator';
import AIWeightCalibrator from './AIWeightCalibrator';

interface AIPanelProps {
  assessmentData?: Record<string, unknown>;
  assessmentName?: string;
  currentIndicators?: Array<{ name: string; current_weight: number; description?: string }>;
  districtName?: string;
  stateName?: string;
}

type ActiveTab = 'settings' | 'report' | 'weights';

const AIPanel: React.FC<AIPanelProps> = ({
  assessmentData,
  assessmentName,
  currentIndicators,
  districtName = 'Thiruvananthapuram',
  stateName = 'Kerala',
}) => {
  const { apiKey, isKeySet, setApiKey, clearApiKey } = useAIKey();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('settings');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const handleSaveKey = () => {
    if (keyInput.trim().startsWith('sk-')) {
      setApiKey(keyInput.trim());
      setKeySaved(true);
      setKeyInput('');
      setTimeout(() => { setKeySaved(false); setActiveTab('report'); }, 1500);
    }
  };

  const handleClearKey = () => {
    clearApiKey();
    setKeyInput('');
  };

  const tabs: Array<{ id: ActiveTab; label: string; icon: string; badge?: string }> = [
    { id: 'settings', label: 'API Key', icon: '🔑' },
    { id: 'report', label: 'AI Report', icon: '📄', badge: !isKeySet ? undefined : '✨' },
    { id: 'weights', label: 'Calibrate', icon: '⚖️', badge: !isKeySet ? undefined : '🧠' },
  ];

  return (
    <>
      {/* Trigger Button */}
      <button
        id="ai-panel-open-btn"
        onClick={() => setIsOpen(true)}
        title="AI Features"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: isKeySet
            ? 'linear-gradient(135deg, #1a3a5c, #2d6aaa)'
            : 'rgba(200,116,42,0.15)',
          border: `1px solid ${isKeySet ? 'rgba(45,125,210,0.5)' : 'rgba(200,116,42,0.4)'}`,
          color: isKeySet ? '#7ab4d4' : '#c8953a',
          borderRadius: '8px', padding: '7px 14px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <span>🤖</span>
        <span>AI Tools</span>
        {isKeySet && <span style={{ color: '#50c878', fontSize: '10px' }}>●</span>}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: isOpen ? 0 : '-440px',
        width: '440px', height: '100vh', zIndex: 9991,
        background: 'linear-gradient(160deg, #1a1610 0%, #241e16 100%)',
        borderLeft: '1px solid rgba(200,116,42,0.35)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        transition: 'right 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px',
          background: 'linear-gradient(90deg, #1a2e45, #1e3855)',
          borderBottom: '1px solid rgba(200,116,42,0.3)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #1a4a6e, #2d7dd2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          }}>🤖</div>
          <div>
            <div style={{ color: '#f5e6c8', fontWeight: 700, fontSize: '15px' }}>HVRA AI Tools</div>
            <div style={{ color: '#7a9ec2', fontSize: '12px' }}>
              {isKeySet ? '● OpenAI Connected' : '○ Setup Required'}
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              marginLeft: 'auto', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              color: '#9a8a70', width: '32px', height: '32px',
              cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px', padding: '12px 16px',
          borderBottom: '1px solid rgba(200,116,42,0.2)', flexShrink: 0,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '9px 4px',
                background: activeTab === tab.id ? 'rgba(200,116,42,0.2)' : 'rgba(255,255,255,0.04)',
                border: activeTab === tab.id ? '1px solid rgba(200,116,42,0.5)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: activeTab === tab.id ? '#e09a4a' : '#9a8a70',
                fontSize: '12px', fontWeight: activeTab === tab.id ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', scrollbarWidth: 'thin', scrollbarColor: '#5a4a35 transparent' }}>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div>
              <div style={{ color: '#c8953a', fontWeight: 700, marginBottom: '16px', fontSize: '14px' }}>
                🔑 OpenAI API Key Configuration
              </div>

              {isKeySet && (
                <div style={{
                  background: 'rgba(80,200,120,0.1)', border: '1px solid rgba(80,200,120,0.3)',
                  borderRadius: '10px', padding: '12px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  <div>
                    <div style={{ color: '#50c878', fontWeight: 600, fontSize: '13px' }}>API Key Active</div>
                    <div style={{ color: '#7a9a80', fontSize: '12px' }}>
                      {apiKey.substring(0, 7)}...{apiKey.substring(apiKey.length - 4)}
                    </div>
                  </div>
                  <button
                    onClick={handleClearKey}
                    style={{
                      marginLeft: 'auto', background: 'rgba(255,80,80,0.15)',
                      border: '1px solid rgba(255,80,80,0.3)', color: '#ff8080',
                      borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
                    }}
                  >Remove</button>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#9a8a70', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  Enter your OpenAI API Key (starts with <code style={{ color: '#c8953a' }}>sk-</code>)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                    placeholder="sk-proj-..."
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(200,116,42,0.3)', borderRadius: '8px',
                      color: '#f5e6c8', padding: '10px 40px 10px 12px',
                      fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
                    }}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#9a8a70', cursor: 'pointer', fontSize: '14px',
                    }}
                  >{showKey ? '🙈' : '👁️'}</button>
                </div>
              </div>

              <button
                id="ai-save-key-btn"
                onClick={handleSaveKey}
                disabled={!keyInput.trim().startsWith('sk-')}
                style={{
                  width: '100%', padding: '11px',
                  background: keyInput.trim().startsWith('sk-')
                    ? 'linear-gradient(135deg, #1a4a6e, #2d7dd2)'
                    : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(200,116,42,0.3)',
                  color: '#f5e6c8', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  cursor: keyInput.trim().startsWith('sk-') ? 'pointer' : 'not-allowed',
                  marginBottom: '20px', transition: 'all 0.3s',
                }}
              >
                {keySaved ? '✅ Key Saved!' : '💾 Save API Key'}
              </button>

              {/* Security Note */}
              <div style={{
                background: 'rgba(200,116,42,0.08)', border: '1px solid rgba(200,116,42,0.2)',
                borderRadius: '10px', padding: '14px',
              }}>
                <div style={{ color: '#c8953a', fontWeight: 600, fontSize: '12px', marginBottom: '8px' }}>🔒 Security Notes</div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#9a8a70', fontSize: '12px' }}>
                  <li style={{ marginBottom: '4px' }}>Key is stored in session storage only (cleared on tab close)</li>
                  <li style={{ marginBottom: '4px' }}>Never stored in our database or logs</li>
                  <li style={{ marginBottom: '4px' }}>Sent securely via request header to our backend proxy</li>
                  <li>Use a usage-limited API key for added safety</li>
                </ul>
              </div>

              {/* AI Features Overview */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ color: '#c8953a', fontWeight: 700, marginBottom: '12px', fontSize: '13px' }}>🤖 Available AI Features</div>
                {[
                  { icon: '📄', title: 'AI Executive Report', desc: 'Auto-generate structured reports with mitigation plans' },
                  { icon: '⚖️', title: 'Smart Weight Calibrator', desc: 'AI-optimized indicator weights based on historical disasters' },
                  { icon: '🤖', title: 'Disaster Copilot', desc: 'Chat assistant for NL queries about risk data (floating button)' },
                ].map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '12px', marginBottom: '12px',
                    background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: '22px' }}>{f.icon}</div>
                    <div>
                      <div style={{ color: '#f5e6c8', fontSize: '13px', fontWeight: 600 }}>{f.title}</div>
                      <div style={{ color: '#9a8a70', fontSize: '12px' }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Generator Tab */}
          {activeTab === 'report' && (
            <AIReportGenerator
              assessmentData={assessmentData}
              assessmentName={assessmentName}
            />
          )}

          {/* Weight Calibrator Tab */}
          {activeTab === 'weights' && (
            <AIWeightCalibrator
              currentIndicators={currentIndicators}
              districtName={districtName}
              stateName={stateName}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default AIPanel;
