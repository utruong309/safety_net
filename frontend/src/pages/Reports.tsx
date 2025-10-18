import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Camera, 
  MapPin, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { sosApi } from '../services/api';
import { geocodeLocation, getFallbackCoordinates } from '../services/geocoding';

interface SOSReport {
  id: number;
  location: string;
  description: string;
  media_url?: string;
  status: 'pending' | 'processing' | 'resolved';
  created_at: string;
  severity: 'low' | 'medium' | 'high';
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<SOSReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [geocodingLocation, setGeocodingLocation] = useState<string | null>(null);
  const [newReport, setNewReport] = useState({
    location: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const data = await sosApi.getRecent(20);
        setReports(data);
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
    
            // Refresh reports every 2 seconds for instant updates
            const interval = setInterval(fetchReports, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newReport.location || !newReport.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);
      setGeocodingLocation('Geocoding location...');
      
      // Geocode the location to get coordinates
      let latitude = 40.7128; // Default NYC coordinates
      let longitude = -74.006;
      let geocodedLocation = newReport.location;
      
      try {
        const geocodeResult = await geocodeLocation(newReport.location);
        
        if (geocodeResult) {
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
          geocodedLocation = geocodeResult.display_name;
          console.log('Geocoded location:', geocodedLocation, 'at', latitude, longitude);
        } else {
          // Try fallback coordinates for major cities
          const fallback = getFallbackCoordinates(newReport.location);
          if (fallback) {
            latitude = fallback.lat;
            longitude = fallback.lng;
            console.log('Using fallback coordinates for:', newReport.location);
          } else {
            console.log('Using default coordinates for:', newReport.location);
          }
        }
      } catch (geocodeError) {
        console.error('Geocoding failed, using default coordinates:', geocodeError);
        // Use default coordinates if geocoding fails
      }
      
      setGeocodingLocation(null);
      
      // Create FormData as expected by the backend
      const formData = new FormData();
      
      // Required fields as per backend API
      formData.append('text', `${geocodedLocation}: ${newReport.description}`);
      formData.append('latitude', latitude.toString());
      formData.append('longitude', longitude.toString());
      
      // Add file if selected
      if (selectedFile) {
        formData.append('file', selectedFile);
        console.log('File selected:', selectedFile.name);
      }

      // Submit the report as FormData
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/sos/report`, {
        method: 'POST',
        body: formData, // Don't set Content-Type header, let browser set it with boundary
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend error response:', errorData);
        console.error('FormData sent:', {
          text: newReport.description,
          latitude: '40.7128',
          longitude: '-74.006',
          file: selectedFile ? selectedFile.name : 'none'
        });
        
        // Handle different error formats
        let errorMessage = 'Failed to submit report';
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.msg) return err.msg;
              if (err.loc && err.msg) return `${err.loc.join('.')}: ${err.msg}`;
              return JSON.stringify(err);
            }).join(', ');
          } else {
            errorMessage = errorData.detail;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Reset form
      setNewReport({ location: '', description: '', severity: 'medium' });
      setSelectedFile(null);
      setSubmitSuccess(true);
      
      // Refresh reports
      const data = await sosApi.getRecent(20);
      setReports(data);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
      
    } catch (error) {
      console.error('Error submitting report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit report. Please try again.';
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-green-600 bg-green-100 dark:bg-green-900';
      case 'processing': return 'text-blue-600 bg-blue-100 dark:bg-blue-900';
      case 'pending': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            Emergency Reports
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Submit and view emergency flood reports
          </p>
        </div>
      </div>

      {/* Submit New Report */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Submit Emergency Report
        </h3>
        <form onSubmit={handleSubmitReport} className="space-y-4">
          {/* Geocoding Status */}
          {geocodingLocation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {geocodingLocation}
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    Converting your location to coordinates...
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {submitSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Report Submitted Successfully!
                  </h3>
                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                    Your emergency report has been submitted and will appear on the map within 2 seconds!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submitError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex">
                <XCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Error Submitting Report
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    {submitError}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="ml-3 text-red-400 hover:text-red-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Location *
              </label>
              <input
                type="text"
                id="location"
                value={newReport.location}
                onChange={(e) => setNewReport({ ...newReport, location: e.target.value })}
                className="input-field mt-1"
                placeholder="Enter location (e.g., 123 Main St, Boston)"
                required
              />
            </div>
            <div>
              <label htmlFor="severity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Severity
              </label>
              <select
                id="severity"
                value={newReport.severity}
                onChange={(e) => setNewReport({ ...newReport, severity: e.target.value as 'low' | 'medium' | 'high' })}
                className="input-field mt-1"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description *
            </label>
            <textarea
              id="description"
              rows={3}
              value={newReport.description}
              onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
              className="input-field mt-1"
              placeholder="Describe the emergency situation..."
              required
            />
          </div>
          
          <div>
            <label htmlFor="media" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Upload Media (Optional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="space-y-1 text-center">
                <Camera className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <label
                    htmlFor="media"
                    className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="media"
                      name="media"
                      type="file"
                      className="sr-only"
                      accept="image/*,video/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, MP4 up to 10MB
                </p>
                {selectedFile && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Reports */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Recent Reports
        </h3>
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No reports</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No emergency reports have been submitted yet.
              </p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {report.location}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(report.severity || 'medium')}`}>
                        {(report.severity || 'medium').toUpperCase()}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status || 'pending')}`}>
                        {(report.status || 'pending').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {report.description}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(report.created_at)}</span>
                      </div>
                      {report.media_url && (
                        <div className="flex items-center space-x-1">
                          <Camera className="h-3 w-3" />
                          <span>Media attached</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    {report.status === 'resolved' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
