import React, { useState, useEffect } from 'react';
import { Map, Marker, Popup } from 'react-map-gl';
import { MapPin, AlertTriangle } from 'lucide-react';
import { floodRiskApi } from '../services/api';
import { FloodRiskData } from '../types';

// You'll need to add your Mapbox token to the .env file
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const RiskMap: React.FC = () => {
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 10
  });
  const [mapData, setMapData] = useState<FloodRiskData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        const data = await floodRiskApi.getLatest(50);
        setMapData(data);
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchMapData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return '#ef4444'; // red
    if (score >= 0.4) return '#f59e0b'; // yellow
    return '#22c55e'; // green
  };

  const getRiskLevel = (score: number) => {
    if (score >= 0.7) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  };

  // Mock coordinates for cities (in a real app, you'd get these from a geocoding service)
  const cityCoordinates: { [key: string]: { lat: number; lng: number } } = {
    'Boston,US': { lat: 42.3601, lng: -71.0589 },
    'New York,US': { lat: 40.7128, lng: -74.0060 },
    'Philadelphia,US': { lat: 39.9526, lng: -75.1652 },
    'Washington,US': { lat: 38.9072, lng: -77.0369 },
    'Miami,US': { lat: 25.7617, lng: -80.1918 },
    'Chicago,US': { lat: 41.8781, lng: -87.6298 },
    'Los Angeles,US': { lat: 34.0522, lng: -118.2437 },
    'San Francisco,US': { lat: 37.7749, lng: -122.4194 },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="space-y-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
              Flood Risk Map
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Interactive map showing real-time flood risk predictions
            </p>
          </div>
        </div>
        
        <div className="card">
          <div className="text-center py-12">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Mapbox Token Required</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              To view the interactive map, please add your Mapbox access token to the environment variables.
            </p>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">VITE_MAPBOX_TOKEN=your_token_here</code> to your .env file
              </p>
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
            Flood Risk Map
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive map showing real-time flood risk predictions
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="card p-0 overflow-hidden">
        <div className="h-96 w-full">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/dark-v10"
          >
            {mapData.map((item) => {
              const coords = cityCoordinates[item.city];
              if (!coords) return null;

              return (
                <Marker
                  key={item.id}
                  longitude={coords.lng}
                  latitude={coords.lat}
                  color={getRiskColor(item.risk_score)}
                >
                  <div className="relative">
                    <MapPin 
                      className="h-6 w-6" 
                      style={{ color: getRiskColor(item.risk_score) }}
                    />
                    {item.risk_score >= 0.7 && (
                      <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />
                    )}
                  </div>
                </Marker>
              );
            })}

            {mapData.map((item) => {
              const coords = cityCoordinates[item.city];
              if (!coords) return null;

              return (
                <Popup
                  key={`popup-${item.id}`}
                  longitude={coords.lng}
                  latitude={coords.lat}
                  closeButton={true}
                  closeOnClick={false}
                  anchor="bottom"
                >
                  <div className="p-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.city}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Risk Score:</span>
                        <span className="font-medium">{item.risk_score.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Risk Level:</span>
                        <span 
                          className="font-medium"
                          style={{ color: getRiskColor(item.risk_score) }}
                        >
                          {getRiskLevel(item.risk_score)}
                        </span>
                      </div>
                      {item.temp && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
                          <span className="font-medium">{item.temp}°C</span>
                        </div>
                      )}
                      {item.humidity && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Humidity:</span>
                          <span className="font-medium">{item.humidity}%</span>
                        </div>
                      )}
                      {item.rain1h && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Rain (1h):</span>
                          <span className="font-medium">{item.rain1h}mm</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                        <span className="font-medium text-xs">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              );
            })}
          </Map>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Risk Level Legend
        </h3>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Low Risk (0.0 - 0.4)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Medium Risk (0.4 - 0.7)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">High Risk (0.7 - 1.0)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskMap;
