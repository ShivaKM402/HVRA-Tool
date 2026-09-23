import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAssessment, getAssessmentResults } from '../../services/api';
import type { Assessment, AssessmentResultsResponse } from '../../types';
import ResultsMap from '../../components/Map/ResultsMap';
import ResultsTable from './ResultsTable';

const CLASSIFICATION_COLORS: Record<string, string> = {
  "NH": "#22c55e",
  "LH": "#eab308",
  "MH": "#f97316",
  "HH": "#ef4444"
};

export default function AssessmentResults() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [resultsData, setResultsData] = useState<AssessmentResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sync state between map and table
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const assessmentId = parseInt(id, 10);
        
        // Fetch basic assessment details
        const details = await getAssessment(assessmentId);
        setAssessment(details);
        
        // Fetch processing results
        const res = await getAssessmentResults(assessmentId);
        setResultsData(res);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load assessment results.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading results dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>⚠️</span>
        <div>{error}</div>
      </div>
    );
  }

  if (!assessment || !resultsData) {
    return <div>No data found.</div>;
  }

  // Format data for the Recharts Bar Chart
  const chartData = [
    { name: 'HH', count: resultsData.classification_summary?.['HH'] || 0, color: CLASSIFICATION_COLORS['HH'], label: 'High' },
    { name: 'MH', count: resultsData.classification_summary?.['MH'] || 0, color: CLASSIFICATION_COLORS['MH'], label: 'Moderate' },
    { name: 'LH', count: resultsData.classification_summary?.['LH'] || 0, color: CLASSIFICATION_COLORS['LH'], label: 'Low' },
    { name: 'NH', count: resultsData.classification_summary?.['NH'] || 0, color: CLASSIFICATION_COLORS['NH'], label: 'No Hazard' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Info */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              Assessment Dashboard: {assessment.name}
              <span className={`badge ${assessment.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                {assessment.status}
              </span>
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              <strong>Kerala</strong> / <strong>{assessment.district_name || 'Kottayam'}</strong> / <strong>{assessment.administrative_level}</strong> / <strong>{assessment.hazard_type}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="badge badge-warning" style={{ fontSize: '0.85rem' }}>⚠️ DEMO DATA</div>
            <Link to={`/assessments/${assessment.id}/report`} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
              📄 View Report
            </Link>
          </div>
        </div>

        <div className="card-body">
          {/* Summary KPIs */}
          <div className="grid-5" style={{ gap: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>Total Blocks</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>{resultsData.total_units}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
              <div style={{ color: '#991b1b', fontSize: '0.8rem', fontWeight: 600 }}>High Hazard</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444' }}>{chartData[0].count}</div>
            </div>
            <div style={{ background: '#fff7ed', padding: '1rem', borderRadius: '8px', border: '1px solid #fed7aa', textAlign: 'center' }}>
              <div style={{ color: '#9a3412', fontSize: '0.8rem', fontWeight: 600 }}>Mod Hazard</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f97316' }}>{chartData[1].count}</div>
            </div>
            <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '8px', border: '1px solid #fef08a', textAlign: 'center' }}>
              <div style={{ color: '#854d0e', fontSize: '0.8rem', fontWeight: 600 }}>Low Hazard</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#eab308' }}>{chartData[2].count}</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <div style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 600 }}>No Hazard</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#22c55e' }}>{chartData[3].count}</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
             <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: '#64748b', fontWeight: 600 }}>Minimum Score:</span>
               <strong style={{ fontSize: '1.1rem' }}>{resultsData.min_score?.toFixed(2) || 0}</strong>
             </div>
             <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: '#64748b', fontWeight: 600 }}>Average Score:</span>
               <strong style={{ fontSize: '1.1rem' }}>{resultsData.average_score?.toFixed(2) || 0}</strong>
             </div>
             <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: '#64748b', fontWeight: 600 }}>Highest Score:</span>
               <strong style={{ fontSize: '1.1rem' }}>{resultsData.max_score?.toFixed(2) || 0}</strong>
             </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Dashboard Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: '600px' }}>
        
        {/* Left Column: Map & Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3 className="card-title">Interactive Hazard Map</h3>
            </div>
            <div className="card-body" style={{ padding: 0, flexGrow: 1 }}>
              <ResultsMap
                key={`map-${assessment.id}`}
                assessmentId={assessment.id}
                selectedBlockId={selectedBlockId}
                onBlockSelect={setSelectedBlockId}
                resultsData={resultsData.results}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Classification Summary</h3>
            </div>
            <div className="card-body" style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="label" type="category" width={80} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right Column: Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Block Results Details</h3>
          </div>
          <div className="card-body" style={{ height: '100%', overflow: 'hidden' }}>
            <ResultsTable 
              results={resultsData.results} 
              selectedBlockId={selectedBlockId}
              onBlockSelect={setSelectedBlockId}
            />
          </div>
        </div>

      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
        <Link to="/dashboard" className="btn btn-secondary">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
