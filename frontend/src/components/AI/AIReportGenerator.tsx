/**
 * AI Executive Report Generator — Panel (Feature 2)
 * Generates structured executive report + mitigation action plan from assessment data.
 */
import React, { useState } from 'react';
import { aiGenerateReport, type AIReport, type MitigationAction } from '../../services/aiService';
import { useAIKey } from '../../context/AIKeyContext';

interface AIReportGeneratorProps {
  assessmentData?: Record<string, unknown>;
  assessmentName?: string;
  onReportGenerated?: (report: AIReport) => void;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  IMMEDIATE: { color: '#ff6b6b', bg: 'rgba(255,80,80,0.12)', icon: '🚨' },
  SHORT_TERM: { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', icon: '⏳' },
  LONG_TERM: { color: '#50c878', bg: 'rgba(80,200,120,0.12)', icon: '📋' },
};

const RISK_CLASS_COLOR: Record<string, string> = {
  VERY_HIGH: '#ff4444',
  HIGH: '#ff8800',
  MODERATE: '#f5c518',
  LOW: '#50c878',
};

const AIReportGenerator: React.FC<AIReportGeneratorProps> = ({
  assessmentData,
  assessmentName,
  onReportGenerated,
}) => {
  const { apiKey, isKeySet } = useAIKey();
  const [report, setReport] = useState<AIReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'zones' | 'actions' | 'recommendations'>('summary');

  const handleGenerate = async () => {
    if (!isKeySet || !assessmentData) return;
    setIsGenerating(true);
    setError('');
    setReport(null);

    try {
      const result = await aiGenerateReport(apiKey, {
        ...assessmentData,
        assessment_name: assessmentName || 'HVRA Assessment',
      });
      setReport(result.report);
      onReportGenerated?.(result.report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(200,116,42,0.2)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  };

  const tabBtnStyle = (tab: string): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: activeTab === tab ? '1px solid rgba(200,116,42,0.6)' : '1px solid transparent',
    background: activeTab === tab ? 'rgba(200,116,42,0.18)' : 'transparent',
    color: activeTab === tab ? '#e09a4a' : '#9a8a70',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: activeTab === tab ? 600 : 400,
    transition: 'all 0.2s',
  });

  const renderActions = (actions: MitigationAction[]) => (
    <div>
      {(['IMMEDIATE', 'SHORT_TERM', 'LONG_TERM'] as const).map(priority => {
        const items = actions.filter(a => a.priority === priority);
        if (items.length === 0) return null;
        const cfg = PRIORITY_CONFIG[priority];
        return (
          <div key={priority} style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '10px', color: cfg.color, fontWeight: 700, fontSize: '13px',
            }}>
              <span>{cfg.icon}</span>
              <span>{priority.replace('_', ' ')} ACTIONS</span>
              <span style={{ marginLeft: 'auto', background: cfg.bg, color: cfg.color, padding: '2px 10px', borderRadius: '10px', fontSize: '12px' }}>
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            {items.map((action, i) => (
              <div key={i} style={{
                background: cfg.bg, border: `1px solid ${cfg.color}30`,
                borderLeft: `3px solid ${cfg.color}`,
                borderRadius: '0 8px 8px 0',
                padding: '12px 14px', marginBottom: '8px',
              }}>
                <div style={{ fontWeight: 600, color: '#f5e6c8', fontSize: '13px', marginBottom: '4px' }}>{action.action}</div>
                <div style={{ color: '#b8a888', fontSize: '12px', marginBottom: '8px', lineHeight: 1.5 }}>{action.description}</div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#9a8a70' }}>🏛️ {action.responsible_agency}</span>
                  <span style={{ color: '#9a8a70' }}>📅 {action.estimated_timeline}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ color: '#f5e6c8' }}>
      {/* Generate Button */}
      {!report && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#f5e6c8' }}>
            AI Executive Report Generator
          </div>
          <div style={{ color: '#9a8a70', fontSize: '13px', marginBottom: '24px', maxWidth: '340px', margin: '0 auto 24px' }}>
            Generate a structured executive report with key findings, high-risk zones analysis, and a prioritized mitigation action plan.
          </div>
          {!isKeySet && (
            <div style={{
              background: 'rgba(180,80,30,0.15)', border: '1px solid rgba(200,116,42,0.4)',
              borderRadius: '10px', padding: '12px', marginBottom: '16px',
              color: '#e09a4a', fontSize: '13px',
            }}>
              🔑 Please configure your OpenAI API key in AI Settings first.
            </div>
          )}
          {!assessmentData && (
            <div style={{
              background: 'rgba(80,80,180,0.1)', border: '1px solid rgba(120,120,220,0.3)',
              borderRadius: '10px', padding: '12px', marginBottom: '16px',
              color: '#9ab4d4', fontSize: '13px',
            }}>
              ℹ️ Open this panel from an assessment results page to auto-load data.
            </div>
          )}
          <button
            id="ai-generate-report-btn"
            onClick={handleGenerate}
            disabled={!isKeySet || !assessmentData || isGenerating}
            style={{
              background: isKeySet && assessmentData
                ? 'linear-gradient(135deg, #1a4a6e, #2d7dd2)'
                : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(200,116,42,0.4)',
              color: '#f5e6c8', padding: '12px 28px',
              borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              cursor: isKeySet && assessmentData ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s',
            }}
          >
            {isGenerating ? '⏳ Generating...' : '✨ Generate AI Report'}
          </button>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>🤖</div>
          <div style={{ color: '#c8953a', fontWeight: 600, marginBottom: '8px' }}>Analyzing Assessment Data...</div>
          <div style={{ color: '#9a8a70', fontSize: '12px' }}>AI is reviewing results and generating recommendations</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#c8742a', animation: `bounce 1.4s ${i * 0.2}s infinite ease-in-out`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(180,30,30,0.2)', border: '1px solid rgba(220,60,60,0.4)',
          borderRadius: '10px', padding: '14px', marginBottom: '16px',
          color: '#ff9a9a', fontSize: '13px',
        }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#ff9a9a', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Report Content */}
      {report && !isGenerating && (
        <div>
          {/* Re-generate button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ color: '#50c878', fontSize: '13px', fontWeight: 600 }}>✅ Report Generated</div>
            <button
              onClick={() => { setReport(null); setError(''); }}
              style={{
                background: 'rgba(200,116,42,0.15)', border: '1px solid rgba(200,116,42,0.3)',
                color: '#d4853a', borderRadius: '8px', padding: '6px 14px',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              ↺ Regenerate
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['summary', 'zones', 'actions', 'recommendations'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={tabBtnStyle(tab)}>
                {{ summary: '📋 Summary', zones: '🗺️ Risk Zones', actions: '⚡ Actions', recommendations: '💡 Recommendations' }[tab]}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <div>
              <div style={cardStyle}>
                <div style={{ color: '#c8953a', fontWeight: 700, marginBottom: '10px', fontSize: '14px' }}>📋 Executive Summary</div>
                <p style={{ color: '#c8b890', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{report.executive_summary}</p>
              </div>
              <div style={cardStyle}>
                <div style={{ color: '#c8953a', fontWeight: 700, marginBottom: '10px', fontSize: '14px' }}>🔍 Key Findings</div>
                <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
                  {report.key_findings.map((f, i) => (
                    <li key={i} style={{ color: '#c8b890', fontSize: '13px', marginBottom: '6px', lineHeight: 1.5 }}>{f}</li>
                  ))}
                </ul>
              </div>
              {report.conclusion && (
                <div style={cardStyle}>
                  <div style={{ color: '#c8953a', fontWeight: 700, marginBottom: '10px', fontSize: '14px' }}>📌 Conclusion</div>
                  <p style={{ color: '#c8b890', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{report.conclusion}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'zones' && (
            <div>
              {report.high_risk_zones.map((zone, i) => (
                <div key={i} style={{
                  ...cardStyle,
                  borderLeft: `3px solid ${RISK_CLASS_COLOR[zone.risk_class] || '#9a8a70'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#f5e6c8', fontSize: '14px' }}>{zone.zone}</div>
                    <div style={{
                      background: `${RISK_CLASS_COLOR[zone.risk_class]}22`,
                      color: RISK_CLASS_COLOR[zone.risk_class] || '#9a8a70',
                      padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                    }}>
                      {zone.risk_class?.replace('_', ' ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#9a8a70' }}>
                    <span>Score: <strong style={{ color: '#e09a4a' }}>{zone.score?.toFixed?.(2) ?? zone.score}</strong></span>
                    <span>Driver: <strong style={{ color: '#c8b890' }}>{zone.primary_driver}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'actions' && renderActions(report.mitigation_action_plan)}

          {activeTab === 'recommendations' && (
            <div>
              <div style={cardStyle}>
                <div style={{ color: '#c8953a', fontWeight: 700, marginBottom: '10px', fontSize: '14px' }}>💡 Capacity Building</div>
                <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
                  {report.capacity_building_recommendations.map((r, i) => (
                    <li key={i} style={{ color: '#c8b890', fontSize: '13px', marginBottom: '8px', lineHeight: 1.5 }}>{r}</li>
                  ))}
                </ul>
              </div>
              {report.data_gaps_and_limitations?.length > 0 && (
                <div style={{ ...cardStyle, borderColor: 'rgba(245,166,35,0.3)' }}>
                  <div style={{ color: '#f5a623', fontWeight: 700, marginBottom: '10px', fontSize: '14px' }}>⚠️ Data Gaps & Limitations</div>
                  <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
                    {report.data_gaps_and_limitations.map((g, i) => (
                      <li key={i} style={{ color: '#c8b890', fontSize: '13px', marginBottom: '6px' }}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AIReportGenerator;
