/**
 * HVRA Digital Tool — Main App with routing
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import NewAssessment from './pages/NewAssessment/NewAssessment';
import AssessmentResults from './pages/AssessmentResults/AssessmentResults';
import ReportView from './pages/AssessmentResults/ReportView';
import DataLibrary from './pages/DataLibrary/DataLibrary';
import FloodData from './pages/FloodData/FloodData';
import Reports from './pages/Reports/Reports';
import Settings from './pages/Settings/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/flood-data" element={<FloodData />} />
          <Route path="/new-assessment" element={<NewAssessment />} />
          <Route path="/assessments" element={<Reports />} />
          <Route path="/assessments/:id/results" element={<AssessmentResults />} />
          <Route path="/assessments/:id/report" element={<ReportView />} />
          <Route path="/data-library" element={<DataLibrary />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
