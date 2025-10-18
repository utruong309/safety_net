interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
  confidence: number;
}

export const geocodeLocation = async (location: string): Promise<GeocodingResult | null> => {
  try {
    // Use OpenStreetMap Nominatim API for geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        display_name: result.display_name,
        confidence: parseFloat(result.importance || '0.5')
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Fallback coordinates for major cities (if geocoding fails)
const FALLBACK_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  'boston': { lat: 42.3601, lng: -71.0589 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'washington': { lat: 38.9072, lng: -77.0369 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'denver': { lat: 39.7392, lng: -104.9903 }
};

export const getFallbackCoordinates = (location: string): { lat: number; lng: number } | null => {
  const locationLower = location.toLowerCase();
  
  for (const [city, coords] of Object.entries(FALLBACK_COORDINATES)) {
    if (locationLower.includes(city)) {
      return coords;
    }
  }
  
  return null;
};
