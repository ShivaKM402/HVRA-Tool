/**
 * AI Smart Weight Calibrator — Panel (Feature 3)
 * Analyzes current indicator weights and recommends AI-optimized values
 * based on historical disaster patterns.
 */
import React, { useState } from 'react';
import { aiCalibrateWeights, type WeightCalibrationResult, type IndicatorInput } from '../../services/aiService';
import { useAIKey } from '../../context/AIKeyContext';

interface AIWeightCalibratorProps {
  currentIndicators?: IndicatorInput[];
  districtName?: string;
  stateName?: string;
  onWeightsApplied?: (weights: Record<string, number>) => void;
}

const AIWeightCalibrator: React.FC<AIWeightCalibratorProps> = ({
  currentIndicators = [],
  districtName = 'Thiruvananthapuram',
  stateName = 'Kerala',
  onWeightsApplied,
}) => {
  const { apiKey, isKeySet } = useAIKey();
  const [result, setResult] = useState<WeightCalibrationResult | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [error, setError] = useState('');
  const [appliedWeights, setAppliedWeights] = useState<Record<string, number>>({});

  const HISTORICAL_EVENTS = [
    { year: 2018, severity: 'extreme', cause: 'unprecedented monsoon rainfall', affected: 'statewide' },
    { year: 2019, severity: 'severe', cause: 'heavy monsoon + dam releases', affected: 'multiple districts' },
    { year: 2021, severity: 'moderate', cause: 'intense monsoon depression rainfall', affected: 'coastal districts' },
  ];

  const handleCalibrate = async () => {
    if (!isKeySet) return;

    const indicatorsToUse = currentIndicators.length > 0 ? currentIndicators : [
      { name: 'Flood Prone Area %', current_weight: 5, description: 'Percentage of area prone to flooding' },
      { name: 'Rainfall Intensity', current_weight: 5, description: 'Average annual rainfall intensity' },
      { name: 'River Proximity', current_weight: 5, description: 'Distance to nearest major river' },
      { name: 'Drainage Density', current_weight: 5, description: 'Density of drainage network' },
      { name: 'Historical Flood Events', current_weight: 5, description: 'Number of historical flood events' },
    ];

    setIsCalibrating(true);
    setError('');
    setResult(null);

    try {
      const res = await aiCalibrateWeights(
        apiKey,
        indicatorsToUse,
        {
          district: districtName,
          state: stateName,
          country: 'India',
          geography: 'coastal_western_ghats',
          avg_annual_rainfall_mm: 2000,
          population_density: 'high',
          key_risks: ['riverine_flood', 'flash_flood', 'urban_flood'],
        },
        HISTORICAL_EVENTS
      );
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Calibration failed';
      setError(msg);
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleApplyWeights = () => {
    if (!result?.recommended_weights) return;
    setAppliedWeights(result.recommended_weights);
    onWeightsApplied?.(result.recommended_weights);
  };

  const getWeightBar = (value: number) => {
    const pct = (value / 10) * 100;
    const color = value >= 8 ? '#ff6b6b' : value >= 6 ? '#f5a623' : value >= 4 ? '#50c878' : '#7a9ec2';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ color, fontWeight: 700, fontSize: '13px', minWidth: '24px', textAlign: 'right' }}>{value.toFixed(1)}</span>
      </div>
    );
  };

  const confidenceColor = (score: number) => {
    if (score >= 0.8) return '#50c878';
    if (score >= 0.6) return '#f5a623';
    return '#ff6b6b';
  };

  return (
    <div style={{ color: '#f5e6c8' }}>
      {/* Intro */}
      {!result && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚖️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: '#f5e6c8' }}>
            AI Smart Weight Calibrator
          </div>
          <div style={{ color: '#9a8a70', fontSize: '13px', marginBottom: '20px', maxWidth: '340px', margin: '0 auto 20px' }}>
            AI analyzes historical disaster patterns for <strong style={{ color: '#c8953a' }}>{districtName}, {stateName}</strong> and recommends optimized indicator weights for more accurate risk scoring.
          </div>

          {/* Historical Events Preview */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,116,42,0.2)',
            borderRadius: '10px', padding: '12px', marginBottom: '20px', textAlign: 'left',
          }}>
            <div style={{ color: '#c8953a', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
              📚 Historical Reference Events
            </div>
            {HISTORICAL_EVENTS.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9a8a70', marginBottom: '4px', alignItems: 'center' }}>
                <span style={{
                  background: ev.severity === 'extreme' ? 'rgba(255,80,80,0.15)' : ev.severity === 'severe' ? 'rgba(245,166,35,0.15)' : 'rgba(80,200,120,0.15)',
                  color: ev.severity === 'extreme' ? '#ff6b6b' : ev.severity === 'severe' ? '#f5a623' : '#50c878',
                  padding: '1px 8px', borderRadius: '8px', fontWeight: 600, minWidth: '60px', textAlign: 'center',
                }}>
                  {ev.year}
                </span>
                <span style={{ textTransform: 'capitalize' }}>{ev.severity}</span>
                <span>— {ev.cause}</span>
              </div>
            ))}
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

          <button
            id="ai-calibrate-weights-btn"
            onClick={handleCalibrate}
            disabled={!isKeySet || isCalibrating}
            style={{
              background: isKeySet ? 'linear-gradient(135deg, #1a4a6e, #2d7dd2)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(200,116,42,0.4)',
              color: '#f5e6c8', padding: '12px 28px',
              borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              cursor: isKeySet ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s',
            }}
          >
            {isCalibrating ? '⏳ Calibrating...' : '🧠 Run AI Calibration'}
          </button>
        </div>
      )}

      {/* Loading */}
      {isCalibrating && (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧠</div>
          <div style={{ color: '#c8953a', fontWeight: 600, marginBottom: '8px' }}>Analyzing Historical Patterns...</div>
          <div style={{ color: '#9a8a70', fontSize: '12px' }}>Matching disaster events to indicator weights</div>
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

      {/* Results */}
      {result && !isCalibrating && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ color: '#50c878', fontSize: '13px', fontWeight: 600 }}>✅ Calibration Complete</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setResult(null); setError(''); }} style={{
                background: 'rgba(200,116,42,0.15)', border: '1px solid rgba(200,116,42,0.3)',
                color: '#d4853a', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer',
              }}>↺ Redo</button>
              {onWeightsApplied && (
                <button
                  id="ai-apply-weights-btn"
                  onClick={handleApplyWeights}
                  style={{
                    background: 'linear-gradient(135deg, #1a6e3a, #2daa64)',
                    border: 'none', color: '#fff', borderRadius: '8px',
                    padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  ✓ Apply Weights
                </button>
              )}
            </div>
          </div>

          {/* Confidence Score */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,116,42,0.2)',
            borderRadius: '10px', padding: '14px', marginBottom: '12px',
            display: 'flex', gap: '16px', alignItems: 'center',
          }}>
            <div style={{ textAlign: 'center', minWidth: '70px' }}>
              <div style={{
                fontSize: '24px', fontWeight: 800,
                color: confidenceColor(result.confidence_score),
              }}>
                {Math.round(result.confidence_score * 100)}%
              </div>
              <div style={{ fontSize: '10px', color: '#9a8a70' }}>Confidence</div>
            </div>
            <div>
              <div style={{ color: '#c8953a', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Historical Match</div>
              <div style={{ color: '#b8a888', fontSize: '12px', lineHeight: 1.5 }}>{result.historical_match}</div>
            </div>
          </div>

          {/* Analysis Summary */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,116,42,0.2)',
            borderRadius: '10px', padding: '14px', marginBottom: '12px',
          }}>
            <div style={{ color: '#c8953a', fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>📊 Calibration Analysis</div>
            <p style={{ color: '#b8a888', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>{result.analysis_summary}</p>
          </div>

          {/* Weight Comparison Table */}
          {result.calibration_rationale?.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,116,42,0.2)',
              borderRadius: '10px', padding: '14px', marginBottom: '12px',
            }}>
              <div style={{ color: '#c8953a', fontWeight: 600, marginBottom: '12px', fontSize: '13px' }}>⚖️ Weight Adjustments</div>
              {result.calibration_rationale.map((item, i) => {
                const diff = item.recommended - item.original;
                const diffColor = diff > 0 ? '#ff6b6b' : diff < 0 ? '#50c878' : '#9a8a70';
                return (
                  <div key={i} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ color: '#f5e6c8', fontSize: '13px', fontWeight: 500 }}>{item.indicator}</span>
                      <span style={{ color: diffColor, fontSize: '12px', fontWeight: 700 }}>
                        {diff > 0 ? `↑ +${diff.toFixed(1)}` : diff < 0 ? `↓ ${diff.toFixed(1)}` : '= No change'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#9a8a70', minWidth: '60px' }}>Current:</span>
                      {getWeightBar(item.original)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#9a8a70', minWidth: '60px' }}>Suggested:</span>
                      {getWeightBar(item.recommended)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9a8070', fontStyle: 'italic', paddingLeft: '68px', lineHeight: 1.4 }}>
                      {item.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div style={{
              background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)',
              borderRadius: '10px', padding: '12px',
            }}>
              <div style={{ color: '#f5a623', fontWeight: 600, marginBottom: '8px', fontSize: '12px' }}>⚠️ Warnings</div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ color: '#c8b870', fontSize: '12px', marginBottom: '4px' }}>• {w}</div>
              ))}
            </div>
          )}

          {/* Applied confirmation */}
          {Object.keys(appliedWeights).length > 0 && (
            <div style={{
              background: 'rgba(80,200,120,0.1)', border: '1px solid rgba(80,200,120,0.3)',
              borderRadius: '10px', padding: '12px', marginTop: '12px',
              color: '#50c878', fontSize: '13px', textAlign: 'center', fontWeight: 600,
            }}>
              ✅ AI-recommended weights applied successfully!
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AIWeightCalibrator;
