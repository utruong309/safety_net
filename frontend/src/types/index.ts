export interface FloodRiskData {
  id: number;
  city: string;
  temp?: number;
  humidity?: number;
  rain1h?: number;
  risk_score: number;
  created_at: string;
}

export interface WeatherData {
  city: string;
  temp: number;
  humidity: number;
  rain1h: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension?: number;
  }[];
}

export interface MapLocation {
  lat: number;
  lng: number;
  city: string;
  risk_score: number;
}
