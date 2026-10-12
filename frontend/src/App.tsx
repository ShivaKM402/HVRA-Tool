/**
 * HVRA Digital Platform — Main Application Routing (HVRA Section 3 & 6)
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DistrictProvider } from './context/DistrictContext';
import { AIKeyProvider } from './context/AIKeyContext';
import Layout from './components/Layout/Layout';
import AICopilot from './components/AI/AICopilot';

// Domain Pages
import { Login, Register } from '@/pages/auth';
import { Dashboard, CompareDashboards } from '@/pages/dashboard';
import { NewAssessment, ProcessingState, AssessmentResults, ReportView } from '@/pages/assessments';
import { RiskBuilder, RiskResults, RiskReportView } from '@/pages/risk';
import {
  AdminUnitExplorer,
  DataLibrary,
  FloodData,
  Reports,
  ReviewQueue,
  SavedQueries,
  SharedQueryView,
  Libraries,
} from '@/pages/data-governance';
import { Profile, Settings, Notifications, Help } from '@/pages/portal';

function App() {
  return (
    <AIKeyProvider>
      <AuthProvider>
        <ToastProvider>
          <DistrictProvider>
            <BrowserRouter>
              <Routes>
                {/* Standalone (no chrome) routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/saved-queries/shared/:token" element={<SharedQueryView />} />

                {/* Application routes wrapped in persistent shell */}
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

                  {/* Composite Risk Builder & Shell */}
                  <Route path="/risk-builder" element={<RiskBuilder />} />
                  <Route path="/risk-assessments/new" element={<RiskBuilder />} />
                  <Route path="/risk-assessments/:id/results" element={<RiskResults />} />
                  <Route path="/risk-assessments/:id/report" element={<RiskReportView />} />

                  {/* Governance, Data, & Spatial */}
                  <Route path="/review-queue" element={<ReviewQueue />} />
                  <Route path="/saved-queries" element={<SavedQueries />} />
                  <Route path="/data-library" element={<DataLibrary />} />
                  <Route path="/flood-data" element={<FloodData />} />
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

                {/* 404 / Catch-all redirect */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>

              {/* Global AI Copilot — floating across all pages */}
              <AICopilot />
            </BrowserRouter>
          </DistrictProvider>
        </ToastProvider>
      </AuthProvider>
    </AIKeyProvider>
  );
}

export default App;