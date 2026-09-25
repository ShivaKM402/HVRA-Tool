/**
 * HVRA Digital Tool — Main App with routing
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import NewAssessment from './pages/NewAssessment/NewAssessment';
import AssessmentResults from './pages/AssessmentResults/AssessmentResults';
import ReportView from './pages/AssessmentResults/ReportView';
import RiskResults from './pages/RiskResults/RiskResults';
import RiskReportView from './pages/RiskResults/RiskReportView';
import DataLibrary from './pages/DataLibrary/DataLibrary';
import FloodData from './pages/FloodData/FloodData';
import Reports from './pages/Reports/Reports';
import Libraries from './pages/Libraries/Libraries';
import Settings from './pages/Settings/Settings';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone (no chrome) routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Application routes wrapped in the layout */}
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/flood-data" element={<FloodData />} />
            <Route path="/new-assessment" element={<NewAssessment />} />
            <Route path="/assessments" element={<Reports />} />
            <Route path="/assessments/:id/results" element={<AssessmentResults />} />
            <Route path="/assessments/:id/report" element={<ReportView />} />
            <Route path="/risk-assessments/:id/results" element={<RiskResults />} />
            <Route path="/risk-assessments/:id/report" element={<RiskReportView />} />
            <Route path="/data-library" element={<DataLibrary />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/libraries" element={<Libraries />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;