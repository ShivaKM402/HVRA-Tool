/**
 * HVRA Digital Platform — Main Application Routing (HVRA Section 3 & 6)
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DistrictProvider } from './context/DistrictContext';
import { HazardProvider } from './context/HazardContext';
import Layout from './components/Layout/Layout';

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
import { LiveWeather } from '@/pages/weather';

function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.70) 100%), url("/kerala-command-backdrop.jpg") center/cover no-repeat fixed',
          color: '#38bdf8',
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div className="radar-command-loader">
          <div className="radar-screen">
            <div className="radar-beam" />
            <div className="radar-ping-ring" />
            <div className="radar-center-blip" />
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '0.25rem 0.85rem',
                borderRadius: '999px',
              }}
            >
              🛰️ KSDMA State Emergency Operations Center
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
              Initializing Multi-Hazard Risk Command Grid
            </div>
            <div style={{ fontSize: '0.84rem', color: '#94a3b8', maxWidth: 420 }}>
              Calibrating 14 District telemetry feeds, spatial boundaries, and analytical modules…
            </div>
          </div>
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
                  <Route path="/weather" element={<LiveWeather />} />
                  <Route path="/live-weather" element={<Navigate to="/weather" replace />} />
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

            </BrowserRouter>
          </HazardProvider>
        </DistrictProvider>
        </ToastProvider>
      </AuthProvider>
  );
}

export default App;