/**
 * IncidentWorkflowHub.tsx
 * 3-Tier Field Incident Reporting & HVRA Publishing Pipeline Hub
 *
 * Tier 1 (Field Officer): Logs rapid incident reports, views revision feedback, and edits/resubmits.
 * Tier 2 (Senior Reviewer): Verifies field evidence, requests revisions with mandatory remarks, or endorses to Manager.
 * Tier 3 (Approving Manager): Final statutory authority. Reviews verified incident, requests revision, or triggers 1-Click Module 1 Draft Assessment & Publication.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useHazard } from '@/context/HazardContext';
import * as api from '@/services/api';
import type {
  IssueReportListItem,
  IssueReportDetail,
  IssueTemplate,
  IssueSeverity,
  WorkflowAssignmentRule,
  AdministrativeUnit,
} from '@/types';
import './IncidentWorkflowHub.css';

export const IncidentWorkflowHub: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { activeHazard } = useHazard();

  const toast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      showToast({ message, type });
    },
    [showToast]
  );

  // Navigation states
  const [activeTab, setActiveTab] = useState<'queue' | 'report' | 'dossier' | 'rules'>('queue');
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [hazardFilter, setHazardFilter] = useState<string>(activeHazard || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data states
  const [incidents, setIncidents] = useState<IssueReportListItem[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IssueReportDetail | null>(null);
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<WorkflowAssignmentRule[]>([]);
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modal dialog states
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [reviewActionType, setReviewActionType] = useState<'APPROVE' | 'REQUEST_REVISION'>('APPROVE');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [reviewRoleLevel, setReviewRoleLevel] = useState<'SENIOR' | 'MANAGER'>('SENIOR');

  // New incident form state
  const [newHazardType, setNewHazardType] = useState<'FLOOD' | 'LANDSLIDE'>('FLOOD');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<IssueSeverity>('HIGH');
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLat, setNewLat] = useState<number>(9.5915);
  const [newLon, setNewLon] = useState<number>(76.5222);
  const [newDistrictId, setNewDistrictId] = useState<number>(0);
  const [newDepartment, setNewDepartment] = useState<string>('Water Resources');
  const [hazardDataForm, setHazardDataForm] = useState<Record<string, any>>({});

  // Edit / Revision form state
  const [isEditingRevision, setIsEditingRevision] = useState<boolean>(false);
  const [editTelemetry, setEditTelemetry] = useState<Record<string, any>>({});
  const [editDescription, setEditDescription] = useState<string>('');
  const [resubmitComment, setResubmitComment] = useState<string>('');

  // Load baseline templates, administrative districts & assignment rules
  const loadInitialData = useCallback(async () => {
    try {
      const [tmplRes, rulesRes, distRes] = await Promise.all([
        api.getIssueTemplates(),
        api.getWorkflowAssignmentRules(),
        api.getDistricts(),
      ]);
      setTemplates(tmplRes.results || []);
      setAssignmentRules(rulesRes.results || []);
      const distList = distRes || [];
      setDistricts(distList);
      if (distList.length > 0 && !newDistrictId) {
        // Default to Kottayam or first district
        const kot = distList.find((d: AdministrativeUnit) => d.name.toLowerCase().includes('kottayam'));
        setNewDistrictId(kot ? kot.id : distList[0].id);
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }, [newDistrictId]);

  // Load incidents based on active queue filter
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (selectedQueue !== 'all') {
        params.queue = selectedQueue;
      }
      if (hazardFilter !== 'ALL') {
        params.hazard_type = hazardFilter;
      }
      const res = await api.getIssues(params);
      setIncidents(res.results || []);
    } catch (err) {
      toast('Failed to load incident reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedQueue, hazardFilter, toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Load full dossier when an incident is selected
  const openDossier = async (id: number) => {
    setActionLoading(true);
    try {
      const detail = await api.getIssueById(id);
      setSelectedIncident(detail);
      setEditTelemetry(detail.hazard_data || {});
      setEditDescription(detail.description);
      setActiveTab('dossier');
    } catch (err) {
      toast('Failed to load incident dossier details.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Review Modal Submission (Senior or Manager Decision)
  const handleConfirmReview = async () => {
    if (!selectedIncident) return;
    if (!reviewRemarks || reviewRemarks.trim().length < 5) {
      toast('Please provide detailed feedback remarks (minimum 5 characters).', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      let updated: IssueReportDetail;
      if (reviewRoleLevel === 'SENIOR') {
        updated = await api.seniorReviewIssue(selectedIncident.id, reviewActionType, reviewRemarks);
        toast(
          reviewActionType === 'APPROVE'
            ? 'Incident verified and endorsed to Manager!'
            : 'Incident returned to Field Officer with revision instructions.',
          'success'
        );
      } else {
        updated = await api.managerReviewIssue(selectedIncident.id, reviewActionType, reviewRemarks);
        toast(
          reviewActionType === 'APPROVE'
            ? 'Incident approved by Manager. Ready for draft HVRA generation!'
            : 'Incident returned for executive revision.',
          'success'
        );
      }
      setSelectedIncident(updated);
      setReviewModalOpen(false);
      setReviewRemarks('');
      fetchIncidents();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Review action failed.';
      toast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Manager 1-Click Draft Assessment Generation
  const handleGenerateDraftAssessment = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    try {
      const res = await api.generateDraftAssessmentFromIssue(
        selectedIncident.id,
        `Statutory Assessment: ${selectedIncident.title.slice(0, 60)}`
      );
      toast(`Draft Assessment #${res.assessment_id} generated successfully!`, 'success');
      setSelectedIncident(res.issue);
      fetchIncidents();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to generate draft assessment.';
      toast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Manager Official Statutory Report Publication
  const handlePublishHVRA = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    try {
      const res = await api.publishHVRAFromIssue(
        selectedIncident.id,
        'Statutory assessment endorsed and officially published following on-ground verification.'
      );
      toast('Official Statutory HVRA Report published to State Dashboard!', 'success');
      setSelectedIncident(res.issue);
      fetchIncidents();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Publication failed.';
      toast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Employee Resubmission after addressing revision comments
  const handleResubmitRevision = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    try {
      // 1. Update issue with revised telemetry & description
      await api.updateIssue(selectedIncident.id, {
        description: editDescription,
        hazard_data: editTelemetry,
      });

      // 2. Submit for senior review
      const updated = await api.submitIssue(
        selectedIncident.id,
        resubmitComment || 'Addressed supervisor revision remarks and updated telemetry.'
      );
      setSelectedIncident(updated);
      setIsEditingRevision(false);
      setResubmitComment('');
      toast('Revised incident resubmitted to Senior Officer for verification!', 'success');
      fetchIncidents();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to resubmit revision.';
      toast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle New Incident Creation
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocationName.trim()) {
      toast('Please enter an incident title and landmark location.', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const template = templates.find((t) => t.hazard_type === newHazardType);
      const stateObj = districts.find((d) => d.id === newDistrictId);

      const payload = {
        hazard_type: newHazardType,
        template: template ? template.id : null,
        title: newTitle,
        description: newDescription,
        incident_datetime: new Date().toISOString(),
        severity: newSeverity,
        department: newDepartment,
        location_name: newLocationName,
        latitude: Number(newLat),
        longitude: Number(newLon),
        state: stateObj?.parent_id || 1,
        district: newDistrictId,
        hazard_data: hazardDataForm,
        is_cross_departmental: false,
      };

      const created = await api.createIssue(payload);
      toast(`Incident ${created.incident_number} logged and submitted for Senior Review!`, 'success');
      setSelectedIncident(created);
      setActiveTab('dossier');
      // Reset form
      setNewTitle('');
      setNewDescription('');
      setHazardDataForm({});
      fetchIncidents();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to register incident.';
      toast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Active template based on chosen hazard
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.hazard_type === newHazardType);
  }, [templates, newHazardType]);

  // Filter incidents by search query
  const filteredIncidents = useMemo(() => {
    if (!searchQuery.trim()) return incidents;
    const q = searchQuery.toLowerCase();
    return incidents.filter(
      (inc) =>
        inc.title.toLowerCase().includes(q) ||
        inc.incident_number.toLowerCase().includes(q) ||
        inc.location_name.toLowerCase().includes(q) ||
        inc.department.toLowerCase().includes(q)
    );
  }, [incidents, searchQuery]);

  return (
    <div className="incident-hub-container">

      {/* =========================================================================
          Visual 3-Tier Workflow Architecture Pipeline
          ========================================================================= */}
      <div className="pipeline-stepper-container">
        <div className={`pipeline-step-card ${user?.profile?.is_field_officer ? 'active' : ''}`}>
          <span className="step-tier-tag tier-1-tag">Tier 1: Field Employee</span>
          <div className="step-title">
            <span>Ground Incident Report</span>
            <span className="step-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              Field Collector
            </span>
          </div>
          <div className="step-desc">
            Logs ground evidence, GPS telemetry, damage checklists &amp; photos. Receives revision feedback directly if changes are required.
          </div>
        </div>

        <div className={`pipeline-step-card ${user?.profile?.is_senior_officer ? 'active' : ''}`}>
          <span className="step-tier-tag tier-2-tag">Tier 2: Senior Reviewer</span>
          <div className="step-title">
            <span>Technical Verification</span>
            <span className="step-badge" style={{ background: '#fefce8', color: '#854d0e' }}>
              Supervisor
            </span>
          </div>
          <div className="step-desc">
            Reviews field evidence within authorized department/district. <strong>Requests revision</strong> with mandatory remarks OR <strong>endorses</strong> to Manager.
          </div>
        </div>

        <div className={`pipeline-step-card ${user?.profile?.is_manager ? 'active' : ''}`}>
          <span className="step-tier-tag tier-3-tag">Tier 3: Approving Manager</span>
          <div className="step-title">
            <span>Executive Authority</span>
            <span className="step-badge" style={{ background: '#ecfdf5', color: '#065f46' }}>
              District DDMA
            </span>
          </div>
          <div className="step-desc">
            Evaluates verified dossier. Triggers <strong>1-Click Module 1 Draft Assessment</strong> &amp; official statutory publication with immutable audit history.
          </div>
        </div>
      </div>

      {/* =========================================================================
          Hub Navigation Tabs
          ========================================================================= */}
      <div className="hub-nav-tabs">
        <button
          className={`hub-nav-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <span>📋</span> Incident Queues &amp; Desks
          <span className="tab-count-pill">{incidents.length}</span>
        </button>

        <button
          className={`hub-nav-tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <span>🚨</span> Report Ground Incident
        </button>

        {selectedIncident && (
          <button
            className={`hub-nav-tab ${activeTab === 'dossier' ? 'active' : ''}`}
            onClick={() => setActiveTab('dossier')}
          >
            <span>🔍</span> Incident Dossier: {selectedIncident.incident_number}
            {selectedIncident.status.includes('REVISION_REQUESTED') && (
              <span className="tab-count-pill" style={{ background: '#fee2e2', color: '#991b1b' }}>
                ⚠️ Needs Rework
              </span>
            )}
          </button>
        )}

        {isAdmin && (
          <button
            className={`hub-nav-tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <span>⚙️</span> Jurisdiction Assignment Rules
            <span className="tab-count-pill">{assignmentRules.length}</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          TAB 1: INCIDENT QUEUES & REVIEW DESKS
          ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="incidents-table-container">
          <div className="incidents-filter-bar">
            {/* Filter by Queue / Role Desk */}
            <div className="filter-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Queue Desk:</label>
              <select
                className="filter-select"
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
              >
                <option value="all">🌐 All Incidents in District</option>
                <option value="my_reports">👷 My Field Reports (Employee)</option>
                <option value="revisions">⚠️ Revision Feedback Queue (Needs Employee Rework)</option>
                <option value="senior_review">🔍 Senior Review Desk (Pending Verification)</option>
                <option value="manager_review">🏛️ Manager Approval Desk (Executive Queue)</option>
              </select>

              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginLeft: '0.75rem' }}>
                Hazard:
              </label>
              <select
                className="filter-select"
                value={hazardFilter}
                onChange={(e) => setHazardFilter(e.target.value)}
              >
                <option value="ALL">All Hazards</option>
                <option value="FLOOD">🌊 Flood Only</option>
                <option value="LANDSLIDE">⛰️ Landslide Only</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="filter-group">
              <input
                type="text"
                className="search-input"
                placeholder="Search incident #, title, locality..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '260px' }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setActiveTab('report')}
                style={{ whiteSpace: 'nowrap' }}
              >
                + New Incident
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div>⏳ Loading incident telemetry...</div>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                No incidents found in this queue.
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Switch to "All Incidents" or click "+ New Incident" to file a report.
              </div>
            </div>
          ) : (
            <table className="incidents-table">
              <thead>
                <tr>
                  <th>Incident Code</th>
                  <th>Hazard Domain</th>
                  <th>Title &amp; Locality</th>
                  <th>Department</th>
                  <th>Severity</th>
                  <th>Current Workflow Status</th>
                  <th>Reporting Officer</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((inc) => (
                  <tr key={inc.id} onClick={() => openDossier(inc.id)}>
                    <td>
                      <span className="incident-number-badge">{inc.incident_number}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {inc.hazard_type === 'FLOOD' ? '🌊 Flood' : '⛰️ Landslide'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{inc.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        📍 {inc.location_name} ({inc.district_name})
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#334155' }}>{inc.department}</span>
                    </td>
                    <td>
                      <span className={`severity-badge sev-${inc.severity}`}>{inc.severity}</span>
                    </td>
                    <td>
                      <span className={`status-chip stat-${inc.status}`}>
                        {inc.status === 'REVISION_REQUESTED_BY_SENIOR' && '⚠️ '}
                        {inc.status === 'HVRA_PUBLISHED' && '📜 '}
                        {inc.status_label}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#475569' }}>@{inc.reported_by_name}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDossier(inc.id);
                        }}
                      >
                        Inspect Dossier →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: REPORT GROUND INCIDENT FORM (EMPLOYEE TIER 1)
          ========================================================================= */}
      {activeTab === 'report' && (
        <div className="dossier-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🚨 Report Ground Disaster Incident
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem', marginBottom: 0 }}>
              Tier 1 Field Entry — This registers an operational incident report. It will be routed to your department's
              Senior Technical Officer for review before official HVRA synthesis.
            </p>
          </div>

          <form onSubmit={handleCreateIncident}>
            {/* Hazard Selector */}
            <div className="form-group">
              <label className="form-label">Hazard Type *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn ${newHazardType === 'FLOOD' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.95rem', fontWeight: 700 }}
                  onClick={() => {
                    setNewHazardType('FLOOD');
                    setNewDepartment('Water Resources');
                  }}
                >
                  🌊 Flood Hazard Checklist
                </button>
                <button
                  type="button"
                  className={`btn ${newHazardType === 'LANDSLIDE' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.95rem', fontWeight: 700 }}
                  onClick={() => {
                    setNewHazardType('LANDSLIDE');
                    setNewDepartment('Public Works Department (PWD)');
                  }}
                >
                  ⛰️ Landslide &amp; Slope Checklist
                </button>
              </div>
            </div>

            {/* Title & Department */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Incident Summary / Headline *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Meenachil Embankment Overtopping near Pazhukkanila"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Originating Department *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Severity & District */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Initial Field Severity *</label>
                <select
                  className="form-control"
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as IssueSeverity)}
                >
                  <option value="CRITICAL">🔴 Critical (Catastrophic breach / immediate evacuation)</option>
                  <option value="HIGH">🟠 High (Major inundation / lifeline severed)</option>
                  <option value="MEDIUM">🟡 Medium (Moderate waterlogging / localized damage)</option>
                  <option value="LOW">🟢 Low (Monitoring alert / localized puddling)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Administrative District *</label>
                <select
                  className="form-control"
                  value={newDistrictId}
                  onChange={(e) => setNewDistrictId(Number(e.target.value))}
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Landmark & GPS */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Landmark / Riverbank / Bridge Location *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Pazhukkanila Riverbank Km 12"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-control"
                  value={newLat}
                  onChange={(e) => setNewLat(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-control"
                  value={newLon}
                  onChange={(e) => setNewLon(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Detailed Ground Narrative *</label>
              <textarea
                className="form-control form-textarea"
                placeholder="Describe factual observations: water level rise rate, damaged structures, road closure, population marooned..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                required
              />
            </div>

            {/* Hazard-Specific Dynamic Checklist from Template */}
            {activeTemplate && activeTemplate.fields_schema.length > 0 && (
              <div className="dossier-section" style={{ background: '#f1f5f9', marginTop: '1.25rem' }}>
                <div className="dossier-section-title">
                  <span>📊</span> Dynamic {activeTemplate.name}
                </div>

                <div className="telemetry-grid">
                  {activeTemplate.fields_schema.map((f) => (
                    <div key={f.id} className="form-group" style={{ marginBottom: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        {f.label} {f.required && '*'}
                      </label>

                      {f.type === 'boolean' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(hazardDataForm[f.id])}
                            onChange={(e) =>
                              setHazardDataForm((prev) => ({ ...prev, [f.id]: e.target.checked }))
                            }
                          />
                          <span style={{ fontSize: '0.85rem' }}>Yes / Confirmed on ground</span>
                        </label>
                      ) : f.type === 'select' ? (
                        <select
                          className="form-control"
                          value={hazardDataForm[f.id] || ''}
                          onChange={(e) =>
                            setHazardDataForm((prev) => ({ ...prev, [f.id]: e.target.value }))
                          }
                        >
                          <option value="">-- Select option --</option>
                          {f.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          className="form-control"
                          placeholder={f.placeholder || ''}
                          value={hazardDataForm[f.id] ?? ''}
                          onChange={(e) =>
                            setHazardDataForm((prev) => ({
                              ...prev,
                              [f.id]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab('queue')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading}
                style={{ padding: '0.65rem 1.75rem', fontWeight: 700 }}
              >
                {actionLoading ? 'Logging Incident...' : '🚀 Submit Report for Senior Review'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: INCIDENT DOSSIER & REVIEW ACTION CENTER
          ========================================================================= */}
      {activeTab === 'dossier' && selectedIncident && (
        <div className="dossier-card">
          {/* Prominent Revision Alert Banner if returned to Employee */}
          {selectedIncident.status.includes('REVISION_REQUESTED') && (
            <div className="revision-alert-banner">
              <div className="revision-alert-header">
                <span>⚠️</span>
                <span>
                  REVISION REQUIRED BY{' '}
                  {selectedIncident.status === 'REVISION_REQUESTED_BY_SENIOR' ? 'SENIOR OFFICER' : 'MANAGER'}:
                </span>
              </div>
              <div className="revision-alert-body">
                "{selectedIncident.latest_feedback || 'Please update and clarify telemetry observations.'}"
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsEditingRevision((v) => !v)}
                  style={{ background: '#e11d48', borderColor: '#e11d48', fontWeight: 700 }}
                >
                  {isEditingRevision ? '✖ Close Revision Editor' : '✏️ Address Feedback & Rework Submission'}
                </button>
              </div>
            </div>
          )}

          {/* Inline Revision Editor */}
          {isEditingRevision && (
            <div
              className="dossier-section"
              style={{ background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: '1.5rem' }}
            >
              <div className="dossier-section-title" style={{ color: '#9f1239' }}>
                <span>✏️</span> Field Officer Revision Desk — Address Feedback
              </div>

              <div className="form-group">
                <label className="form-label">Updated Description &amp; Field Narrative</label>
                <textarea
                  className="form-control form-textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              {/* Dynamic Telemetry Editing */}
              <div className="telemetry-grid">
                {Object.entries(editTelemetry).map(([key, val]) => (
                  <div key={key} className="form-group">
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={String(val)}
                      onChange={(e) =>
                        setEditTelemetry((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Explanation of Changes Made (Sent to Supervisor)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Added upper slope chainage and confirmed boulder stability."
                  value={resubmitComment}
                  onChange={(e) => setResubmitComment(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditingRevision(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleResubmitRevision}
                  disabled={actionLoading}
                  style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}
                >
                  {actionLoading ? 'Resubmitting...' : '🚀 Resubmit for Senior Review'}
                </button>
              </div>
            </div>
          )}

          {/* Dossier Header */}
          <div className="dossier-header">
            <div className="dossier-title-area">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="incident-number-badge">{selectedIncident.incident_number}</span>
                <span className={`severity-badge sev-${selectedIncident.severity}`}>
                  {selectedIncident.severity}
                </span>
                <span className={`status-chip stat-${selectedIncident.status}`}>
                  {selectedIncident.status_label}
                </span>
              </div>
              <h2>{selectedIncident.title}</h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                📍 {selectedIncident.location_name} • {selectedIncident.district_name} District • Dept:{' '}
                <strong>{selectedIncident.department}</strong> • Reported by:{' '}
                <strong>@{selectedIncident.reported_by_name}</strong> on{' '}
                {new Date(selectedIncident.incident_datetime).toLocaleString()}
              </div>
            </div>

            {/* Action Buttons based on Role & State */}
            <div className="dossier-actions">
              {/* Senior Officer Actions (When in SUBMITTED status) */}
              {selectedIncident.status === 'SUBMITTED' && (
                <>
                  <button
                    className="btn-action btn-revise"
                    onClick={() => {
                      setReviewRoleLevel('SENIOR');
                      setReviewActionType('REQUEST_REVISION');
                      setReviewModalOpen(true);
                    }}
                    title="Send back with mandatory rework instructions"
                  >
                    ↩️ Request Revision
                  </button>
                  <button
                    className="btn-action btn-approve"
                    onClick={() => {
                      setReviewRoleLevel('SENIOR');
                      setReviewActionType('APPROVE');
                      setReviewModalOpen(true);
                    }}
                    title="Verify evidence and escalate to Manager"
                  >
                    ✅ Endorse to Manager
                  </button>
                </>
              )}

              {/* Manager Actions (When Senior Approved) */}
              {selectedIncident.status === 'SENIOR_APPROVED' && (
                <>
                  <button
                    className="btn-action btn-revise"
                    onClick={() => {
                      setReviewRoleLevel('MANAGER');
                      setReviewActionType('REQUEST_REVISION');
                      setReviewModalOpen(true);
                    }}
                  >
                    ↩️ Manager Return
                  </button>
                  <button
                    className="btn-action btn-approve"
                    onClick={() => {
                      setReviewRoleLevel('MANAGER');
                      setReviewActionType('APPROVE');
                      setReviewModalOpen(true);
                    }}
                  >
                    ✅ Approve Incident
                  </button>
                </>
              )}

              {/* 1-Click Module 1 Draft Assessment Generation */}
              {(selectedIncident.status === 'MANAGER_APPROVED' ||
                selectedIncident.status === 'DRAFT_ASSESSMENT_GENERATED') && (
                <button
                  className="btn-action btn-generate-hvra"
                  onClick={handleGenerateDraftAssessment}
                  disabled={actionLoading}
                >
                  ⚡ Generate Module 1 Draft Assessment
                </button>
              )}

              {/* Statutory Publication Action */}
              {selectedIncident.derived_assessment_info &&
                !selectedIncident.derived_assessment_info.is_published && (
                  <button
                    className="btn-action"
                    style={{ background: '#059669', color: 'white' }}
                    onClick={handlePublishHVRA}
                    disabled={actionLoading}
                  >
                    📜 Authorize &amp; Publish Statutory HVRA Report
                  </button>
                )}

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveTab('queue')}
              >
                Back to Queues
              </button>
            </div>
          </div>

          {/* Dossier Body Grid */}
          <div className="dossier-grid">
            <div>
              {/* Ground Observations */}
              <div className="dossier-section">
                <div className="dossier-section-title">
                  <span>📝</span> Field Narrative &amp; Observations
                </div>
                <div style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.6 }}>
                  {selectedIncident.description}
                </div>
              </div>

              {/* Telemetry Observations */}
              <div className="dossier-section">
                <div className="dossier-section-title">
                  <span>📊</span> Ground Telemetry &amp; Hazard Checklist
                </div>
                {Object.keys(selectedIncident.hazard_data || {}).length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    No additional template telemetry logged.
                  </div>
                ) : (
                  <div className="telemetry-grid">
                    {Object.entries(selectedIncident.hazard_data).map(([k, v]) => (
                      <div key={k} className="telemetry-item">
                        <div className="telemetry-label">{k.replace(/_/g, ' ')}</div>
                        <div className="telemetry-value">
                          {typeof v === 'boolean'
                            ? v
                              ? 'YES'
                              : 'NO'
                            : Array.isArray(v)
                            ? v.join(', ')
                            : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked HVRA Assessment Card if generated */}
              {selectedIncident.derived_assessment_info && (
                <div
                  className="dossier-section"
                  style={{
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                  }}
                >
                  <div className="dossier-section-title" style={{ color: '#5b21b6' }}>
                    <span>🏛️</span> Derived Module 1 Assessment (Provenance Linked)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#3b0764' }}>
                        {selectedIncident.derived_assessment_info.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6d28d9', marginTop: '3px' }}>
                        Assessment ID: #{selectedIncident.derived_assessment_info.id} • Status:{' '}
                        <strong>{selectedIncident.derived_assessment_info.status}</strong> • Module:{' '}
                        <strong>{selectedIncident.derived_assessment_info.module_type}</strong>
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        {selectedIncident.derived_assessment_info.is_published ? (
                          <span
                            className="badge badge-success"
                            style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700 }}
                          >
                            ✓ Officially Published Statutory Report
                          </span>
                        ) : (
                          <span
                            className="badge badge-warning"
                            style={{ background: '#fef3c7', color: '#92400e' }}
                          >
                            Draft Assessment — Pending Validation Sign-off
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={`/assessments/${selectedIncident.derived_assessment_info.id}/results`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ background: '#6366f1', borderColor: '#6366f1' }}
                    >
                      Open Assessment Workbench ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Geographic & Audit History Timeline */}
            <div>
              {/* Geographic Coordinates */}
              <div className="dossier-section">
                <div className="dossier-section-title">
                  <span>📍</span> Geographic Coordinates
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  <div>
                    <strong>Latitude:</strong> {selectedIncident.latitude.toFixed(4)}° N
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Longitude:</strong> {selectedIncident.longitude.toFixed(4)}° E
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <strong>District:</strong> {selectedIncident.district_name}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Locality:</strong> {selectedIncident.location_name}
                  </div>
                </div>
              </div>

              {/* Immutable Audit Ledger */}
              <div className="dossier-section">
                <div className="dossier-section-title">
                  <span>📜</span> Immutable Audit History Ledger
                </div>
                <div className="audit-timeline">
                  {selectedIncident.workflow_logs.map((log) => (
                    <div key={log.id} className="timeline-event">
                      <div className="timeline-dot" />
                      <div className="timeline-event-header">
                        <span className="timeline-action">{log.action.replace(/_/g, ' ')}</span>
                        <span className="timeline-time">
                          {new Date(log.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        By: <strong>@{log.actor_name}</strong> ({log.actor_role})
                      </div>
                      {log.comments && <div className="timeline-comment">{log.comments}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: CONFIGURABLE JURISDICTION RULES
          ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="incidents-table-container">
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              ⚙️ Configurable Workflow Assignment Rules
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Maps department, district, and hazard type to authorized Senior Reviewers and Approving Managers without hardcoding.
            </p>
          </div>

          <table className="incidents-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Department</th>
                <th>Hazard Scope</th>
                <th>District Jurisdiction</th>
                <th>Assigned Senior Reviewer</th>
                <th>Assigned Approving Manager</th>
                <th>Cross-Dept Coordinator</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assignmentRules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.department || 'All Departments'}</td>
                  <td>
                    <span className="badge badge-info">{r.hazard_type}</span>
                  </td>
                  <td>{r.district_name || 'Statewide'}</td>
                  <td>
                    <span>🔍 @{r.senior_reviewer_name || 'Role-Based Fallback'}</span>
                  </td>
                  <td>
                    <span>🏛️ @{r.manager_approver_name || 'Role-Based Fallback'}</span>
                  </td>
                  <td>
                    <span>⚡ @{r.coordinator_name || 'DDMA DEOC'}</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Active Rule</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
          REVIEW DECISION MODAL (Senior Officer / Manager Action)
          ========================================================================= */}
      {reviewModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title">
                {reviewRoleLevel === 'SENIOR' ? 'Senior Technical Review Desk' : 'Executive Manager Approval Desk'}
              </div>
              <button
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                onClick={() => setReviewModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '1rem', fontSize: '0.88rem', color: '#334155' }}>
                Incident: <strong>{selectedIncident?.incident_number}</strong> — {selectedIncident?.title}
              </div>

              <div className="form-group">
                <label className="form-label">Review Decision *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className={`btn ${reviewActionType === 'APPROVE' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      background: reviewActionType === 'APPROVE' ? '#10b981' : undefined,
                      borderColor: reviewActionType === 'APPROVE' ? '#10b981' : undefined,
                    }}
                    onClick={() => setReviewActionType('APPROVE')}
                  >
                    ✅ {reviewRoleLevel === 'SENIOR' ? 'Endorse & Escalate' : 'Approve Incident'}
                  </button>

                  <button
                    type="button"
                    className={`btn ${reviewActionType === 'REQUEST_REVISION' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      background: reviewActionType === 'REQUEST_REVISION' ? '#f43f5e' : undefined,
                      borderColor: reviewActionType === 'REQUEST_REVISION' ? '#f43f5e' : undefined,
                    }}
                    onClick={() => setReviewActionType('REQUEST_REVISION')}
                  >
                    ↩️ Request Revision
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {reviewActionType === 'REQUEST_REVISION'
                    ? 'Mandatory Revision Instructions (Sent directly to Submitting Employee) *'
                    : 'Endorsement / Authorization Remarks *'}
                </label>
                <textarea
                  className="form-control form-textarea"
                  placeholder={
                    reviewActionType === 'REQUEST_REVISION'
                      ? 'Specify exactly what needs to be changed (e.g. check chainage between Km 14.2-14.8, attach upper slope photos)...'
                      : 'Technical concurrence remarks confirming field verification...'
                  }
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  required
                />
                <div className="form-hint">Minimum 5 characters required for audit trail provenance.</div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setReviewModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{
                  background: reviewActionType === 'REQUEST_REVISION' ? '#f43f5e' : '#10b981',
                  borderColor: reviewActionType === 'REQUEST_REVISION' ? '#f43f5e' : '#10b981',
                }}
                onClick={handleConfirmReview}
                disabled={actionLoading}
              >
                {actionLoading ? 'Recording Decision...' : 'Confirm & Record Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentWorkflowHub;
