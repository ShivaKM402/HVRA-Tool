/**
 * HVRA Command Palette (Ctrl/Cmd + K)
 * Global search & jump-to navigation for districts, modules, and reports.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDistrict } from '../../context/DistrictContext';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { districts, setActiveDistrictId } = useDistrict();

  const baseItems = [
    { id: 'dash', title: 'Dashboard Home', category: 'Navigation', icon: '📊', path: '/dashboard' },
    { id: 'hazard', title: 'New Hazard Assessment', category: 'Assessments', icon: '🌊', path: '/new-assessment?module=HAZARD' },
    { id: 'vuln', title: 'New Vulnerability Assessment', category: 'Assessments', icon: '👥', path: '/new-assessment?module=VULNERABILITY' },
    { id: 'expo', title: 'New Exposure Assessment', category: 'Assessments', icon: '🏘️', path: '/new-assessment?module=EXPOSURE' },
    { id: 'risk', title: 'Risk Assessment (H × V × E)', category: 'Assessments', icon: '⚖️', path: '/risk-builder' },
    { id: 'review', title: 'Task Force Review Queue', category: 'Governance', icon: '📋', path: '/review-queue' },
    { id: 'reports', title: 'Reports Gallery', category: 'Outputs', icon: '📄', path: '/reports' },
    { id: 'data', title: 'Data Library & Uploads', category: 'Data', icon: '🗃️', path: '/data-library' },
    { id: 'saved', title: 'Saved Queries & Templates', category: 'Data', icon: '🔖', path: '/saved-queries' },
    { id: 'compare', title: 'Compare Districts Dashboard', category: 'Analytics', icon: '⚖️', path: '/dashboard/compare' },
    { id: 'units', title: 'Administrative Unit Explorer', category: 'Spatial', icon: '🗺️', path: '/admin-units' },
    { id: 'settings', title: 'Admin & System Settings', category: 'Administration', icon: '⚙️', path: '/settings' },
    { id: 'help', title: 'Help & GIGW Guidelines', category: 'Support', icon: '❓', path: '/help' },
    { id: 'notifs', title: 'Notification Center', category: 'System', icon: '🔔', path: '/notifications' },
  ];

  // District jump-to items
  const districtItems = districts.map((d) => ({
    id: `dist-${d.id}`,
    title: `Switch Context to ${d.name} District`,
    category: 'Districts',
    icon: '📍',
    action: () => {
      setActiveDistrictId(d.id);
      navigate(`/new-assessment?district=${d.id}`);
    },
  }));

  const allItems = [...baseItems, ...districtItems];

  const filteredItems = query.trim()
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : allItems.slice(0, 10);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: (typeof allItems)[0]) => {
    onClose();
    if ('action' in item && typeof item.action === 'function') {
      item.action();
    } else if ('path' in item && item.path) {
      navigate(item.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command Palette">
        <div className="cmd-search-bar">
          <span className="cmd-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command, district, or page... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmd-kbd">ESC</kbd>
        </div>

        <div className="cmd-list">
          {filteredItems.length === 0 ? (
            <div className="cmd-empty">No results found for &ldquo;{query}&rdquo;</div>
          ) : (
            filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`cmd-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="cmd-item-icon">{item.icon}</span>
                <div className="cmd-item-content">
                  <div className="cmd-item-title">{item.title}</div>
                  <div className="cmd-item-cat">{item.category}</div>
                </div>
                <span className="cmd-item-enter">↵</span>
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <span>Navigate with <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span>Select with <kbd>Enter</kbd></span>
          <span>Close with <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>
  );
}
