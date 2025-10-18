import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  MapPin, 
  Clock,
  Activity,
  Droplets,
  Thermometer,
  CloudRain,
  Shield,
  CheckCircle,
  XCircle,
  Camera,
  Eye
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Map, Marker, Popup } from 'react-map-gl';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { floodRiskApi, sosApi } from '../services/api';
import { FloodRiskData } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SOSReport {
  id: number;
  location: string;
  description: string;
  media_url?: string;
  status: 'pending' | 'processing' | 'verified' | 'resolved';
  created_at: string;
  severity: 'low' | 'medium' | 'high';
  latitude?: number;
  longitude?: number;
}

const Dashboard: React.FC = () => {
  const [riskData, setRiskData] = useState<FloodRiskData[]>([]);
  const [sosReports, setSosReports] = useState<SOSReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapViewState, setMapViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 10
  });

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [riskResponse, sosResponse] = await Promise.all([
          floodRiskApi.getLatest(20),
          sosApi.getRecent(10)
        ]);
        setRiskData(riskResponse);
        setSosReports(sosResponse);
        setError(null);
      } catch (err) {
        setError('Failed to fetch dashboard data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh data every 2 seconds for instant updates
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const getRiskLevel = (score: number) => {
    if (score >= 0.7) return { level: 'High', color: 'text-red-600 bg-red-100 dark:bg-red-900' };
    if (score >= 0.4) return { level: 'Medium', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900' };
    return { level: 'Low', color: 'text-green-600 bg-green-100 dark:bg-green-100' };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-100';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'processing': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Prepare chart data
  const chartData = {
    labels: riskData.slice(0, 10).reverse().map(item => 
      new Date(item.created_at).toLocaleTimeString()
    ),
    datasets: [
      {
        label: 'Risk Score',
        data: riskData.slice(0, 10).reverse().map(item => item.risk_score),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Flood Risk Trends (Last 10 Readings)',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading data
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            SafetyNet Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time flood risk monitoring and emergency response
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  High Risk Cities
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {riskData.filter(d => d.risk_score >= 0.7).length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Total Predictions
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {riskData.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Shield className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  SOS Reports
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {sosReports.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                  Verified Reports
                </dt>
                <dd className="text-lg font-medium text-gray-900 dark:text-white">
                  {sosReports.filter(r => r.status === 'verified').length}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flood Risk Trends Chart */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Flood Risk Trends
            </h3>
            <div className="h-64">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* SOS Reports Table */}
        <div className="lg:col-span-1">
          <div className="card h-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Recent SOS Reports
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sosReports.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No SOS reports available
                  </p>
                </div>
              ) : (
                sosReports.map((report) => (
                  <div key={report.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(report.status)}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {report.location}
                        </span>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(report.severity || 'medium')}`}>
                        {(report.severity || 'medium').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {report.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatTime(report.created_at)}</span>
                      {report.media_url && (
                        <div className="flex items-center space-x-1">
                          <Camera className="h-3 w-3" />
                          <span>Media</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Emergency Response Map
        </h3>
        {!MAPBOX_TOKEN ? (
          <div className="h-96 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Mapbox Token Required</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add VITE_MAPBOX_TOKEN to your .env file to view the interactive map
              </p>
            </div>
          </div>
        ) : (
          <div className="h-96 w-full">
            <Map
              {...mapViewState}
              onMove={evt => setMapViewState(evt.viewState)}
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/dark-v10"
            >
              {sosReports
                .filter(report => report.latitude && report.longitude)
                .map((report) => (
                  <Marker
                    key={report.id}
                    longitude={report.longitude!}
                    latitude={report.latitude!}
                    color={report.severity === 'high' ? '#ef4444' : report.severity === 'medium' ? '#f59e0b' : '#22c55e'}
                  >
                    <div className="relative">
                      <MapPin className="h-6 w-6" />
                      {report.status === 'verified' && (
                        <CheckCircle className="absolute -top-1 -right-1 h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </Marker>
                ))}

              {sosReports
                .filter(report => report.latitude && report.longitude)
                .map((report) => (
                  <Popup
                    key={`popup-${report.id}`}
                    longitude={report.longitude!}
                    latitude={report.latitude!}
                    closeButton={true}
                    closeOnClick={false}
                    anchor="bottom"
                  >
                    <div className="p-2 max-w-xs">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {report.location}
                        </h4>
                        {getStatusIcon(report.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {report.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(report.severity || 'medium')}`}>
                          {(report.severity || 'medium').toUpperCase()}
                        </span>
                        <span>{formatTime(report.created_at)}</span>
                      </div>
                      {report.media_url && (
                        <div className="mt-2">
                          <button className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800">
                            <Eye className="h-3 w-3" />
                            <span>View Media</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                ))}
            </Map>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
