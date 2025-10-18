import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import RiskMap from './pages/RiskMap'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import SOSMap from './components/SOSMap'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/map" element={<RiskMap />} />
              <Route path="/sos-map" element={<SOSMap />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
