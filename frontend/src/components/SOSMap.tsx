import React, { useState, useEffect } from 'react';
import { Map, Marker, Popup } from 'react-map-gl';
import { MapPin, CheckCircle, XCircle, Camera, Clock } from 'lucide-react';
import { sosApi } from '../services/api';

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
  verified?: boolean;
}

const SOSMap: React.FC = () => {
  const [sosReports, setSosReports] = useState<SOSReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<SOSReport | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mapViewState, setMapViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 10
  });

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    const fetchSOSReports = async () => {
      try {
        setLoading(true);
        const reports = await sosApi.getRecent(50);
        setSosReports(reports);
        setError(null);
        setLastUpdated(new Date());

        // Calculate center coordinates from SOS reports
        if (reports.length > 0) {
          const validReports = reports.filter(report => 
            report.latitude && report.longitude
          );
          
          if (validReports.length > 0) {
            const avgLat = validReports.reduce((sum, report) => 
              sum + (report.latitude || 0), 0) / validReports.length;
            const avgLng = validReports.reduce((sum, report) => 
              sum + (report.longitude || 0), 0) / validReports.length;
            
            setMapViewState({
              longitude: avgLng,
              latitude: avgLat,
              zoom: 10
            });
          }
        }
      } catch (err) {
        setError('Failed to fetch SOS reports');
        console.error('Error fetching SOS reports:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSOSReports();
    
            // Refresh data every 2 seconds for instant updates
            const interval = setInterval(fetchSOSReports, 2000);
    return () => clearInterval(interval);
  }, []);

  const getMarkerColor = (report: SOSReport) => {
    // Use verified field if available, otherwise check status
    const isVerified = report.verified !== undefined ? report.verified : report.status === 'verified';
    return isVerified ? '#ef4444' : '#6b7280'; // red if verified, gray if not
  };

  const getStatusIcon = (report: SOSReport) => {
    const isVerified = report.verified !== undefined ? report.verified : report.status === 'verified';
    return isVerified ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-gray-500" />
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-100';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex">
          <XCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading SOS reports
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Mapbox Token Required</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add VITE_MAPBOX_TOKEN to your .env file to view the interactive map
          </p>
        </div>
      </div>
    );
  }

  const validReports = sosReports.filter(report => 
    report.latitude && report.longitude
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            SOS Emergency Map
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {validReports.length} emergency reports • {validReports.filter(r => r.verified || r.status === 'verified').length} verified
          </p>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Live updates (2s) • Last updated: {lastUpdated.toLocaleTimeString()}
                    </span>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Verified</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Unverified</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <Map
          {...mapViewState}
          onMove={evt => setMapViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v10"
          attributionControl={false}
          logoPosition="bottom-left"
        >
          {validReports.map((report) => (
            <Marker
              key={report.id}
              longitude={report.longitude!}
              latitude={report.latitude!}
              color={getMarkerColor(report)}
              onClick={() => setSelectedReport(report)}
            >
              <div className="relative cursor-pointer">
                <MapPin className="h-6 w-6" />
                {(report.verified || report.status === 'verified') && (
                  <CheckCircle className="absolute -top-1 -right-1 h-3 w-3 text-green-500" />
                )}
              </div>
            </Marker>
          ))}

          {selectedReport && (
            <Popup
              longitude={selectedReport.longitude!}
              latitude={selectedReport.latitude!}
              onClose={() => setSelectedReport(null)}
              closeButton={true}
              closeOnClick={false}
              anchor="bottom"
            >
              <div className="p-3 max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {selectedReport.location}
                  </h4>
                  {getStatusIcon(selectedReport)}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {selectedReport.description}
                </p>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  📍 {selectedReport.latitude?.toFixed(4)}, {selectedReport.longitude?.toFixed(4)}
                </p>
                
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(selectedReport.severity || 'medium')}`}>
                    {(selectedReport.severity || 'medium').toUpperCase()}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(selectedReport.created_at)}</span>
                  </div>
                </div>

                {selectedReport.media_url && (
                  <div className="mt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Camera className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Media Available
                      </span>
                    </div>
                    <div className="relative">
                      <img
                        src={selectedReport.media_url}
                        alt="SOS Report Media"
                        className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                        <div className="opacity-0 hover:opacity-100 transition-opacity duration-200">
                          <div className="bg-white dark:bg-gray-800 rounded-full p-2">
                            <Camera className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Status: {(selectedReport.status || 'pending').toUpperCase()}</span>
                    <span>ID: #{selectedReport.id}</span>
                  </div>
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Verified</p>
              <p className="text-lg font-semibold text-green-600">
                {validReports.filter(r => r.verified || r.status === 'verified').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-gray-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Unverified</p>
              <p className="text-lg font-semibold text-gray-600">
                {validReports.filter(r => !r.verified && r.status !== 'verified').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Camera className="h-5 w-5 text-blue-500 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">With Media</p>
              <p className="text-lg font-semibold text-blue-600">
                {validReports.filter(r => r.media_url).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOSMap;
