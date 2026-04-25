export type AppScreen = 
  | 'SIGN_UP' 
  | 'SIGN_IN' 
  | 'OTP' 
  | 'HOME' 
  | 'PLAN_TRIP' 
  | 'MATCHING' 
  | 'MATCH_RESULTS' 
  | 'MEETING_POINT' 
  | 'ACTION_SCREEN' 
  | 'GROUP_CHAT' 
  | 'RIDE_TRACKING' 
  | 'MY_RIDES' 
  | 'INBOX' 
  | 'PROFILE' 
  | 'SUPPORT' 
  | 'EDIT_PROFILE' 
  | 'TRUST_SAFETY' 
  | 'NOTIFICATIONS' 
  | 'RATING';

export type Gender = 'Male' | 'Female' | 'Other';
export type Platform = 'Uber' | 'Bolt' | 'Yango';
export type TimeWindow = 'Now' | '15 min' | '30 min' | '1 hour';
export type RideFrequency = 'Daily' | 'Weekly' | 'Once';
export type City = 'Kumasi' | 'Accra' | 'Cape Coast' | 'Tamale';

export interface LXRUser {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  rating: number;
  ridesTaken: number;
  reliabilityScore: number;
  profilePic?: string | null;
  subscription?: 'free' | 'premium';
}

export interface Rider {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  age: number;
  rating: number;
  departureTime: string;
  isFamiliar?: boolean;
  isVerified?: boolean;
  reliabilityScore: number;
  lat?: number;
  lng?: number;
}

export interface RideHistory {
  id: string;
  date: string;
  destination: string;
  riders: string[];
  cost: string;
  mapPreview: string;
}

export const CITIES_DATA: Record<City, string[]> = {
  'Kumasi': ['KNUST Main Gate', 'Adum', 'Kejetia', 'Bantama', 'Kumasi Mall', 'Tech Junction', 'Ayigya'],
  'Accra': ['Legon', 'Osu', 'Airport', 'East Legon', 'Makola', 'Spintex'],
  'Cape Coast': ['UCC Main Gate', 'Science Board', 'Pedu', 'Kotokuraba'],
  'Tamale': ['UDS', 'Market', 'Hospital', 'Airport Road']
};

export const TIME_WINDOWS: TimeWindow[] = ['Now', '15 min', '30 min', '1 hour'];
export const PLATFORMS: Platform[] = ['Bolt', 'Uber', 'Yango'];
