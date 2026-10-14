/**
 * HVRA Digital Platform — Main Application Routing (HVRA Section 3 & 6)
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DistrictProvider } from './context/DistrictContext';
import { HazardProvider } from './context/HazardContext';
import { AIKeyProvider } from './context/AIKeyContext';
import Layout from './components/Layout/Layout';
import AICopilot from './components/AI/AICopilot';

// Domain Pages
import { Login, Register } from '@/pages/auth';
import { Dashboard, CompareDashboards } from '@/pages/dashboard';
import { NewAssessment, ProcessingState, AssessmentResults, ReportView, DepartmentCoordinationPage } from '@/pages/assessments';
import { RiskBuilder, RiskResults, RiskReportView } from '@/pages/risk';
import {
  AdminUnitExplorer,
  DataLibrary,
  Reports,
  ReviewQueue,
  SavedQueries,
  SharedQueryView,
  Libraries,
} from '@/pages/data-governance';
import { Profile, Settings, Notifications, Help } from '@/pages/portal';
import { IncidentWorkflowHub } from '@/pages/issues';

function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#38bdf8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading Command Center…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <AIKeyProvider>
      <AuthProvider>
        <ToastProvider>
          <DistrictProvider>
            <HazardProvider>
              <BrowserRouter>
              <Routes>
                {/* Standalone (no chrome) routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/saved-queries/shared/:token" element={<SharedQueryView />} />

                {/* Application routes protected by authentication */}
                <Route element={<RequireAuth />}>
                  <Route element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/dashboard/compare" element={<CompareDashboards />} />

                  {/* Query Builder */}
                  <Route path="/new-assessment" element={<NewAssessment />} />
                  <Route path="/assessments/new" element={<NewAssessment />} />

                  {/* Processing State */}
                  <Route path="/assessments/:id/processing" element={<ProcessingState />} />

                  {/* 3-Tab Connected Results Shell */}
                  <Route path="/assessments/:id/results" element={<AssessmentResults />} />
                  <Route path="/assessments/:id/map" element={<AssessmentResults />} />
                  <Route path="/assessments/:id/classification" element={<AssessmentResults />} />
                  <Route path="/assessments/:id/report" element={<ReportView />} />
                  <Route path="/assessments/:id/coordination" element={<DepartmentCoordinationPage />} />
                  <Route path="/department-coordination" element={<DepartmentCoordinationPage />} />

                  {/* Composite Risk Builder & Shell */}
                  <Route path="/risk-builder" element={<RiskBuilder />} />
                  <Route path="/risk-assessments/new" element={<RiskBuilder />} />
                  <Route path="/risk-assessments/:id/results" element={<RiskResults />} />
                  <Route path="/risk-assessments/:id/report" element={<RiskReportView />} />

                  {/* 3-Tier Operational Incident Reporting & Workflow Hub */}
                  <Route path="/issues" element={<IncidentWorkflowHub />} />
                  <Route path="/issues/new" element={<IncidentWorkflowHub />} />
                  <Route path="/issues/:id" element={<IncidentWorkflowHub />} />
                  <Route path="/incidents" element={<Navigate to="/issues" replace />} />

                  {/* Governance, Data, & Spatial */}
                  <Route path="/review-queue" element={<ReviewQueue />} />
                  <Route path="/saved-queries" element={<SavedQueries />} />
                  <Route path="/data-library" element={<DataLibrary />} />
                  <Route path="/flood-data" element={<Navigate to="/data-library" replace />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/assessments" element={<Reports />} />
                  <Route path="/admin-units" element={<AdminUnitExplorer />} />

                  {/* Administration & Libraries */}
                  <Route path="/libraries" element={<Libraries />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin" element={<Settings />} />

                  {/* Utilities */}
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/onboarding" element={<Help />} />
                </Route>
              </Route>

                {/* 404 / Catch-all redirect */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>

              {/* Global AI Copilot — floating across all pages */}
              <AICopilot />
            </BrowserRouter>
          </HazardProvider>
        </DistrictProvider>
        </ToastProvider>
      </AuthProvider>
    </AIKeyProvider>
  );
}

export default App;