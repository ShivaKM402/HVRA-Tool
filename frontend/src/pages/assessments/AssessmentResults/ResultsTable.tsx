import { useState, useMemo } from 'react';

interface ResultsTableProps {
  results: any[];
  selectedBlockId: number | null;
  onBlockSelect: (blockId: number | null) => void;
}

type SortField = 'unit_name' | 'final_score';
type SortOrder = 'asc' | 'desc';
type FilterClass = 'ALL' | 'NH' | 'LH' | 'MH' | 'HH';

export default function ResultsTable({ results, selectedBlockId, onBlockSelect }: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('final_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterClass, setFilterClass] = useState<FilterClass>('ALL');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'final_score' ? 'desc' : 'asc');
    }
  };

  const processedResults = useMemo(() => {
    let filtered = results;
    
    // Filtering
    if (filterClass !== 'ALL') {
      filtered = filtered.filter(r => r.classification === filterClass);
    }
    
    // Sorting
    return [...filtered].sort((a, b) => {
      if (sortField === 'unit_name') {
        const nameA = a.unit_name || '';
        const nameB = b.unit_name || '';
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else {
        const scoreA = a.final_score !== null ? a.final_score : -1;
        const scoreB = b.final_score !== null ? b.final_score : -1;
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
    });
  }, [results, sortField, sortOrder, filterClass]);

  const getBadgeClass = (classification: string) => {
    if (classification === 'HH') return 'badge-error';
    if (classification === 'MH') return 'badge-warning';
    if (classification === 'LH') return 'badge-info';
    if (classification === 'NH') return 'badge-success';
    return 'badge-draft';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
          Showing {processedResults.length} Blocks
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Filter:</label>
          <select 
            value={filterClass} 
            onChange={(e) => setFilterClass(e.target.value as FilterClass)}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Classifications</option>
            <option value="HH">High Hazard (HH)</option>
            <option value="MH">Moderate Hazard (MH)</option>
            <option value="LH">Low Hazard (LH)</option>
            <option value="NH">No Hazard (NH)</option>
          </select>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="table-responsive" style={{ flexGrow: 1, maxHeight: '600px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <table className="data-table" style={{ margin: 0, width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th 
                style={{ cursor: 'pointer', padding: '1rem' }} 
                onClick={() => handleSort('unit_name')}
              >
                Block Name {sortField === 'unit_name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ textAlign: 'right', padding: '1rem' }}>Flood-prone %</th>
              <th style={{ textAlign: 'right', padding: '1rem' }}>Events</th>
              <th style={{ textAlign: 'right', padding: '1rem' }}>Freq (yr)</th>
              <th 
                style={{ cursor: 'pointer', textAlign: 'right', padding: '1rem' }} 
                onClick={() => handleSort('final_score')}
              >
                Score {sortField === 'final_score' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ textAlign: 'center', padding: '1rem' }}>Classification</th>
            </tr>
          </thead>
          <tbody>
            {processedResults.map((r: any) => {
              const meta = r.metadata || {};
              const fp = meta.flood_prone_percentage !== undefined ? meta.flood_prone_percentage.toFixed(1) : '-';
              const ev = meta.event_count !== undefined ? meta.event_count : '-';
              const fq = meta.event_frequency !== undefined ? meta.event_frequency.toFixed(2) : '-';
              const score = r.final_score !== null ? r.final_score.toFixed(2) : '-';
              const isSelected = selectedBlockId === r.administrative_unit;

              return (
                <tr 
                  key={r.id} 
                  onClick={() => onBlockSelect(isSelected ? null : r.administrative_unit)}
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ fontWeight: 500, padding: '0.8rem 1rem' }}>{r.unit_name}</td>
                  <td style={{ textAlign: 'right', padding: '0.8rem 1rem' }}>{fp}%</td>
                  <td style={{ textAlign: 'right', padding: '0.8rem 1rem' }}>{ev}</td>
                  <td style={{ textAlign: 'right', padding: '0.8rem 1rem' }}>{fq}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '0.8rem 1rem' }}>{score}</td>
                  <td style={{ textAlign: 'center', padding: '0.8rem 1rem' }}>
                    <span className={`badge ${getBadgeClass(r.classification)}`}>{r.classification}</span>
                  </td>
                </tr>
              );
            })}
            {processedResults.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No blocks match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
