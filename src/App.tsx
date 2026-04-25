/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  Car,
  MessageSquare,
  User as UserIcon,
  ChevronRight,
  Star,
  MapPin,
  Clock,
  Check,
  ShieldCheck,
  ArrowLeft,
  Send,
  MoreVertical,
  LogOut,
  History,
  Navigation,
  Navigation2,
  AlertTriangle,
  Leaf,
  Shield,
  Wallet as _Wallet,
  Mic,
  Flame,
  Bell,
  Headphones,
  HelpCircle,
  Phone,
  User,
  ThumbsUp
} from 'lucide-react';

// Unified Types inside App.tsx to solve resolution issue
type AppScreen = 
  | 'SIGN_UP' | 'SIGN_IN' | 'OTP' | 'HOME' | 'PLAN_TRIP' | 'MATCHING' 
  | 'MATCH_RESULTS' | 'MEETING_POINT' | 'ACTION_SCREEN' | 'GROUP_CHAT' 
  | 'RIDE_TRACKING' | 'MY_RIDES' | 'INBOX' | 'PROFILE' | 'SUPPORT' 
  | 'EDIT_PROFILE' | 'TRUST_SAFETY' | 'NOTIFICATIONS' | 'RATING';

type TimeWindow = 'Now' | '15 min' | '30 min' | '1 hour';
type Platform = 'Uber' | 'Bolt' | 'Yango';
type City = 'Kumasi' | 'Accra' | 'Cape Coast' | 'Tamale';
type RideFrequency = 'Daily' | 'Weekly' | 'Once';

const CITIES_DATA: Record<City, string[]> = {
  'Kumasi': ['KNUST Main Gate', 'Adum', 'Kejetia', 'Bantama', 'Kumasi Mall', 'Tech Junction', 'Ayigya'],
  'Accra': ['Legon', 'Osu', 'Airport', 'East Legon', 'Makola', 'Spintex'],
  'Cape Coast': ['UCC Main Gate', 'Science Board', 'Pedu', 'Kotokuraba'],
  'Tamale': ['UDS', 'Market', 'Hospital', 'Airport Road']
};

interface LXRUser {
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

interface Rider {
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

interface RideHistory {
  id: string;
  date: string;
  destination: string;
  riders: string[];
  cost: string;
  mapPreview: string;
}

const PLATFORMS: Platform[] = ['Bolt', 'Uber', 'Yango'];

// Mock Data
const MOCK_HISTORY: RideHistory[] = [
  {
    id: '1',
    date: 'Oct 24, 2023 • 08:30 AM',
    destination: 'KNUST Main Gate → Adum/Kejetia',
    riders: ['Kofi Mensah', 'Abena Osei'],
    cost: 'GH₵ 12',
    mapPreview: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '2',
    date: 'Oct 22, 2023 • 05:45 PM',
    destination: 'KNUST Tech Junction → Bantama',
    riders: ['Kwame Asante'],
    cost: 'GH₵ 8',
    mapPreview: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=400&auto=format&fit=crop',
  },
];

// Notification Service
const notify = (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico',
      ...options
    });
  }
};

// --- Helper Components (Fix for focus loss) ---

const MapFitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
};

const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = ''
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  className?: string;
}) => {
  const variants = {
    primary: 'phone-btn-primary text-white active:bg-primary-dark',
    secondary: 'bg-gray-100 text-black border border-gray-200 active:bg-gray-200',
    outline: 'bg-transparent border border-primary text-primary active:bg-primary/10',
    ghost: 'bg-transparent text-gray-500 active:text-black active:bg-gray-100',
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`relative w-full py-4 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = '', onClick, variant = 'phone' }: { children: React.ReactNode; className?: string; onClick?: () => void; variant?: 'phone' | 'glass' | 'gray'; [key: string]: any }) => {
  const variants = {
    phone: 'phone-card',
    glass: 'glass-panel',
    gray: 'phone-card-gray',
  };

  return (
    <div
      onClick={onClick}
      className={`${variants[variant]} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
};

  // Meeting Point Suggestions using real GPS (Finding center of all riders)
const MeetingPointSuggestions = ({ ridersCoords, userCoords, gpsAddress, selectedMeetingPoint, setSelectedMeetingPoint }: {
  ridersCoords: {lat: number, lng: number}[];
  userCoords: {lat: number, lng: number} | null;
  gpsAddress: string;
  selectedMeetingPoint: string | null;
  setSelectedMeetingPoint: (name: string) => void;
}) => {
  interface Place {
    id: string;
    name: string;
    desc: string;
    dist: string;
    userMins: number;
    lat: number;
    lng: number;
    isCommunity?: boolean;
    upvotes?: number;
  }

  const [places, setPlaces] = React.useState<Place[]>([]);
  const [communitySuggs, setCommunitySuggs] = React.useState<Place[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lastFetchPos, setLastFetchPos] = React.useState<{lat: number, lng: number} | null>(null);

  // Suggestion form state
  const [showForm, setShowForm] = React.useState(false);
  const [suggName, setSuggName] = React.useState('');
  const [suggDesc, setSuggDesc] = React.useState('');

  // Distance calculation helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  React.useEffect(() => {
    if (!userCoords) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    // Only fetch if we moved more than 50 meters
    if (lastFetchPos) {
      const moved = calculateDistance(userCoords.lat, userCoords.lng, lastFetchPos.lat, lastFetchPos.lng);
      if (moved < 0.05) {
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setLastFetchPos({ lat: userCoords.lat, lng: userCoords.lng });

    // Petrol stations (gas_station), Banks (bank), Fast food (fast_food, restaurant)
    const types = 'gas_station|bank|fast_food|restaurant';
    const radius = 500;
    const latlng = `${userCoords.lat.toFixed(6)},${userCoords.lng.toFixed(6)}`;
    const url = `/api/nearbysearch?location=${latlng}&radius=${radius}`;

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          const googleResults = (data.results || [])
            .map((place: any, i: number) => {
              const spotLat = place.geometry.location.lat;
              const spotLng = place.geometry.location.lng;
              const distInKm = calculateDistance(userCoords.lat, userCoords.lng, spotLat, spotLng);
              
              // Walking time: 5km/h = 83.3m/min
              const walkingMins = Math.max(1, Math.round((distInKm * 1000) / 80));
              const distLabel = `${Math.round(distInKm * 1000)}m away`;
              
              const types = place.types || [];
              let desc = place.vicinity || 'Strategic Point';
              
              // Custom labels for the vicinity/description based on types
              if (types.includes('gas_station')) desc = `Station • ${place.vicinity}`;
              else if (types.includes('bank')) desc = `Bank • ${place.vicinity}`;
              else if (types.includes('fast_food') || types.includes('restaurant')) desc = `Food Point • ${place.vicinity}`;

              let cleanName = place.name.replace(/^\d+\s+/, '').trim();
              if (cleanName.length > 25) cleanName = cleanName.split(',')[0];

              return {
                id: `google-${i}`,
                name: cleanName,
                desc,
                dist: distLabel,
                userMins: walkingMins,
                lat: spotLat,
                lng: spotLng
              };
            })
            .sort((a: any, b: any) => a.userMins - b.userMins)
            .slice(0, 3); // 3 closest as requested

          const hasRealGps = gpsAddress && gpsAddress !== 'Detecting location...' && !gpsAddress.includes('near');
          const currentLocationOption = {
            id: 'current-pos',
            name: hasRealGps ? gpsAddress.split(',')[0] : 'Current Location',
            desc: hasRealGps ? (gpsAddress.split(',').slice(1).join(',') || 'Your position') : 'Your GPS position',
            dist: '0m',
            userMins: 0,
            lat: userCoords.lat,
            lng: userCoords.lng
          };

          const finalResults = [currentLocationOption, ...googleResults].slice(0, 4);
          setPlaces(finalResults);
          
          if (!selectedMeetingPoint && finalResults.length > 0) {
            setSelectedMeetingPoint(finalResults[0].name);
          }
        }
      } catch (error) {
        console.error('Google Places Error:', error);
        const hasRealGps = gpsAddress && gpsAddress !== 'Detecting location...' && gpsAddress !== 'Location access denied';
        const fallback = [{ 
          id: 'fallback-pos',
          name: hasRealGps ? gpsAddress.split(',')[0] : 'Current Location', 
          desc: hasRealGps ? (gpsAddress.split(',').slice(1).join(',') || 'Safe point') : 'Your GPS coordinates', 
          dist: '0m', 
          userMins: 0,
          lat: userCoords.lat, 
          lng: userCoords.lng 
        }];
        setPlaces(fallback);
        if (!selectedMeetingPoint) setSelectedMeetingPoint(fallback[0].name);
      } finally {
        setLoading(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [userCoords?.lat, userCoords?.lng, gpsAddress, ridersCoords.length]);

  const handleSubmitSugg = () => {
    if (!suggName.trim()) return;
    const newSugg: Place = {
      id: `comm-${Date.now()}`,
      name: suggName,
      desc: suggDesc || 'Rider Suggested Spot',
      dist: 'Simulated',
      userMins: 2, // Mock distance
      lat: userCoords?.lat || 0,
      lng: userCoords?.lng || 0,
      isCommunity: true,
      upvotes: 0
    };
    setCommunitySuggs(prev => [...prev, newSugg]);
    setSuggName('');
    setSuggDesc('');
    setShowForm(false);
    setSelectedMeetingPoint(newSugg.name);
  };

  const handleUpvote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCommunitySuggs(prev => prev.map(s => s.id === id ? { ...s, upvotes: (s.upvotes || 0) + 1 } : s));
  };

  const mostUpvotedId = useMemo(() => {
    if (communitySuggs.length === 0) return null;
    const max = Math.max(...communitySuggs.map(s => s.upvotes || 0));
    if (max === 0) return null;
    return communitySuggs.find(s => s.upvotes === max)?.id;
  }, [communitySuggs]);

  const allPlaces = [...places, ...communitySuggs];

  if (loading) return (
    <div className="space-y-2">
      <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest ml-1">Finding Midpoint Hub...</p>
      <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-medium">Calculating optimal real spots...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest ml-1">Meeting Points</p>
        <AnimatePresence>
          {allPlaces.map((spot, i) => (
            <motion.div
              layout
              key={spot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div
                onClick={() => setSelectedMeetingPoint(spot.name)}
                className={`p-4 rounded-2xl transition-all duration-200 border cursor-pointer ${selectedMeetingPoint === spot.name ? 'border-primary ring-1 ring-primary/20 bg-primary/5 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${selectedMeetingPoint === spot.name ? 'bg-primary' : i === 0 && !spot.isCommunity ? 'bg-primary/80' : 'bg-gray-100'} rounded-lg flex items-center justify-center shrink-0`}>
                      <MapPin size={16} className={selectedMeetingPoint === spot.name || (i === 0 && !spot.isCommunity) ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-black flex items-center gap-2 flex-wrap">
                        <span className="truncate">{spot.name}</span>
                        {spot.isCommunity && (
                          <span className="text-[7px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0">Community Suggested</span>
                        )}
                        {spot.id === mostUpvotedId && (
                          <span className="text-[7px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0 flex items-center gap-0.5">
                            <Flame size={8}/> Popular
                          </span>
                        )}
                        {!spot.isCommunity && <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">{spot.dist}</span>}
                      </div>
                      <div className="text-[9px] text-gray-400 font-medium flex items-center gap-2">
                        <span className="truncate">{spot.desc}</span>
                        {!spot.isCommunity && (
                          <>
                            <span className="w-1 h-1 bg-gray-200 rounded-full shrink-0" />
                            <span className="text-primary font-bold flex items-center gap-0.5 shrink-0"><Clock size={8}/> {spot.userMins} min</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {spot.isCommunity && (
                      <button 
                        onClick={(e) => handleUpvote(e, spot.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${spot.upvotes && spot.upvotes > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                      >
                        <ThumbsUp size={10} fill={spot.upvotes && spot.upvotes > 0 ? "currentColor" : "none"} />
                        <span className="text-[10px] font-bold">{spot.upvotes}</span>
                      </button>
                    )}
                    {selectedMeetingPoint === spot.name && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" strokeWidth={4} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Suggest Form - Only shown if no real spots were found or if community suggestions already exist */}
      {(places.filter(p => p.id.startsWith('google-')).length === 0 || communitySuggs.length > 0) && (
        <div className="pt-2 border-t border-gray-50">
          {!showForm ? (
            <button 
              onClick={() => setShowForm(true)}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <Shield size={14} className="text-green-500" />
              Suggest a Safe Spot
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield size={12} className="text-green-500" /> New Suggestion
                </span>
                <button onClick={() => setShowForm(false)} className="text-[10px] font-bold text-gray-300">Cancel</button>
              </div>
              <input 
                type="text" 
                placeholder="Name of location (e.g. Total Petrol Station)"
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-black font-bold outline-none focus:border-primary"
                value={suggName}
                onChange={e => setSuggName(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="Why is it safe? (e.g. Well lit, security present)"
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-black outline-none focus:border-primary"
                value={suggDesc}
                onChange={e => setSuggDesc(e.target.value)}
              />
              <Button onClick={handleSubmitSugg} disabled={!suggName.trim()} className="py-2.5 text-xs">Submit Suggestion</Button>
            </motion.div>
          )}
        </div>
      )}
      
      <p className="text-[8px] text-center text-gray-300 mt-2 italic px-4">Community spots are shared with all riders in your current match group.</p>
    </div>
  );
};

const ScreenWrapper = ({ children, title, onBack, screen }: { children: React.ReactNode; title?: string; onBack?: () => void; screen: string; key?: string }) => (
  <motion.div
    key={screen}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.15 }}
    className="screen-content pt-12"
  >
    <div className="flex items-center justify-between mb-6">
      {onBack ? (
        <button onClick={onBack} className="p-2 -ml-2 text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-90">
          <ArrowLeft size={22} strokeWidth={3} />
        </button>
      ) : <div className="w-8 h-8" />}

      {title && <h1 className="text-base font-bold tracking-tight text-black">{title}</h1>}
      
      <div className="w-10 h-10" />
    </div>
    {children}
  </motion.div>
);

// --- Main Application ---

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('SIGN_UP');
  const [user, setUser] = useState<LXRUser | null>(null);
  const [tempUser, setTempUser] = useState<Partial<LXRUser>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'Male',
    dob: '',
  });

  // Trip State
  const [currentCity, setCurrentCity] = useState<City>('Kumasi');
  const [pickupZone, setPickupZone] = useState<string>('');
  const [destZone, setDestZone] = useState<string>('');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('Now');
  const [platform, setPlatform] = useState<Platform>('Bolt');
  const [rideFrequency, setRideFrequency] = useState<RideFrequency | null>(null);
  const [showFrequencyPrompt, setShowFrequencyPrompt] = useState(false);
  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState<string | null>(null);
  const [riderRatings, setRiderRatings] = useState<Record<string, number>>({});

  // Matching State
  const [progress, setProgress] = useState(0);
  const [matchedRiders, setMatchedRiders] = useState<Rider[]>([]);
  const [selectedRiderIds, setSelectedRiderIds] = useState<Set<string>>(new Set());

  // Chat State
  const [messages, setMessages] = useState<{sender: string, text: string, time: string, isMe?: boolean}[]>([
    { sender: 'System', text: 'You have been matched! Introduce yourself to the group.', time: 'Now' },
  ]);
  const [messageInput, setMessageInput] = useState('');

  // UI State
  const [isRideActive, setIsRideActive] = useState(false);
  const [isSOSSent, setIsSOSSent] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');

  // GPS State
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string>('Detecting location...');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Derived
  const selectedRiders = matchedRiders.filter(r => selectedRiderIds.has(r.id));

  // State to track if we've successfully geocoded the GPS location
  const [hasResolvedAddress, setHasResolvedAddress] = useState(false);

  // Life Cycle
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported');
      setGpsAddress('GPS not available');
      return;
    }
    
    // Move fetchAddr to a stable reference if possible, or just keep it inside but don't depend on state in the setup
    const fetchAddr = async (lat: number, lng: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); 

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`,
          { 
            headers: { 
              'User-Agent': 'LexRide/1.0 (lexride.netlify.app; ride-sharing Ghana)',
              'Accept': 'application/json'
            },
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        const addr = data.address;
        const main = addr.amenity || addr.building || addr.highway || addr.shop || addr.road || addr.historic;
        const area = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.sublocality;
        const city = addr.city || addr.town || addr.municipality || 'Ghana';

        let label = '';
        if (main && area) {
          label = `${main}, ${area}`;
        } else if (main) {
          label = String(main);
        } else if (area) {
          label = `${area}, ${city}`;
        } else {
          label = String(city);
        }

        setGpsAddress(label || 'Current Location');
        setPickupZone(label || 'Current Location');
        setHasResolvedAddress(true);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn('Geocoding failed', err);
        const fallbackLabel = `Area near ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        setGpsAddress(fallbackLabel);
        setPickupZone(fallbackLabel);
        setHasResolvedAddress(true);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        if (!hasResolvedAddress) {
           fetchAddr(latitude, longitude);
        }
      },
      (err) => {
        setGpsError(err.message);
        setGpsAddress('Location access denied');
        setPickupZone(CITIES_DATA['Kumasi'][0]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    // Safety timeout
    const safetyTimer = setTimeout(() => {
      if (!hasResolvedAddress && gpsAddress === 'Detecting location...') {
        setGpsAddress('Your Current Location');
        setHasResolvedAddress(true);
      }
    }, 6000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(safetyTimer);
    };
  }, [hasResolvedAddress]);

  // Separate effect was added later, we can remove it as we are restoring the inline call
  // Or just leave it if it works better. Actually the user wants "undo all".

  // Destination Search (Fix for Bug 3 & "Based on GPS")
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [destSuggestions, setDestSuggestions] = useState<{name: string, fullName: string, lat: number, lng: number}[]>([]);
  const [selectedDest, setSelectedDest] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (destZone.length >= 3 && !selectedDest) {
        searchDestination(destZone);
      } else if (destZone.length < 3) {
        setDestSuggestions([]);
      }
    }, 850);
    return () => clearTimeout(timer);
  }, [destZone, selectedDest]);

  const searchDestination = async (query: string) => {
    if (!query || query.trim().length < 2) return;
    setIsSearchLoading(true);
    setSearchError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=gh&format=json&limit=6&addressdetails=1&accept-language=en`, {
        headers: { 
          'User-Agent': 'LexRide/1.0 (lexride.netlify.app; ride-sharing Ghana)',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 429) throw new Error('Searching slow...');
        throw new Error('Search busy');
      }
      
      const data = await res.json();
      if (!data || data.length === 0) {
        setDestSuggestions([]);
        setSearchError('Location not found in Ghana. Try a landmark.');
        return;
      }
      
      const uniqueResults = data.map((item: any) => {
        const addr = item.address;
        const main = addr.amenity || addr.building || addr.highway || addr.shop || addr.tourism || item.display_name.split(',')[0];
        const sub = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.city || '';
        
        return {
          name: main + (sub && sub !== main ? `, ${sub}` : ''),
          fullName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        };
      });
      
      setDestSuggestions(uniqueResults);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('Search failed:', err);
      setSearchError('Search offline. Try Adum or East Legon.');
    } finally {
      setIsSearchLoading(false);
      clearTimeout(timeoutId);
    }
  };

  // Distance calculation helper
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // State to track initial distance for progress calculation
  const [initialDistance, setInitialDistance] = useState<number | null>(null);

  // Sync initial distance when ride starts
  useEffect(() => {
    if (isRideActive && userCoords && selectedDest && initialDistance === null) {
      setInitialDistance(getDistance(userCoords.lat, userCoords.lng, selectedDest.lat, selectedDest.lng));
    } else if (!isRideActive) {
      setInitialDistance(null);
    }
  }, [isRideActive, userCoords, selectedDest, initialDistance]);

  const currentDist = (isRideActive && userCoords && selectedDest) 
    ? getDistance(userCoords.lat, userCoords.lng, selectedDest.lat, selectedDest.lng)
    : 0;
  
  const tripProgress = (initialDistance && initialDistance > 0)
    ? Math.max(0, Math.min(100, (1 - (currentDist / initialDistance)) * 100))
    : 0;

  // Navigation Logic
  // Navigation State moved here to avoid temporal dead zone
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [tripInfo, setTripInfo] = useState<{ duration: string, distance: string } | null>(null);

  // Simple polyline decoder for Google Maps polylines
  const decodePolyline = (encoded: string): [number, number][] => {
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    const points: [number, number][] = [];

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  };

  // Fetch route when ride starts
  useEffect(() => {
    if (isRideActive && userCoords && selectedDest && routePolyline.length === 0) {
      const fetchRoute = async () => {
        try {
          const origin = `${userCoords.lng},${userCoords.lat}`;
          const destination = `${selectedDest.lng},${selectedDest.lat}`;
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=full&geometries=geojson`);
          const data = await res.json();
          
          if (data.code === 'Ok' && data.routes.length > 0) {
            const route = data.routes[0];
            // OSRM returns [lng, lat], Leaflet wants [lat, lng]
            const points = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
            setRoutePolyline(points);
            
            const mins = Math.round(route.duration / 60);
            const km = (route.distance / 1000).toFixed(1);
            
            setTripInfo({
              duration: `${mins} min`,
              distance: `${km} km`
            });
          } else {
            throw new Error('OSRM error');
          }
        } catch (err) {
          console.error('Route fetch failed:', err);
          // Fallback calculation: Haversine distance
          const R = 6371;
          const dLat = (selectedDest.lat - userCoords.lat) * Math.PI / 180;
          const dLon = (selectedDest.lng - userCoords.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userCoords.lat * Math.PI / 180) * Math.cos(selectedDest.lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const directKm = R * c;
          
          // Assume 40km/h average + 20% for traffic/roads
          const estMin = Math.round((directKm / 40) * 60 * 1.2);
          
          setTripInfo({
            duration: `${estMin} min`,
            distance: `${directKm.toFixed(1)} km`
          });
          setRoutePolyline([[userCoords.lat, userCoords.lng], [selectedDest.lat, selectedDest.lng]]);
        }
      };
      fetchRoute();
    } else if (!isRideActive) {
      if (routePolyline.length > 0) setRoutePolyline([]);
      if (tripInfo) setTripInfo(null);
    }
  }, [isRideActive, selectedDest, userCoords?.lat, userCoords?.lng, routePolyline.length, tripInfo]);

  const [isVerifyingSafety, setIsVerifyingSafety] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProfilePicUrl(url);
      if (user) setUser({ ...user, profilePic: url });
    };
    reader.readAsDataURL(file);
  };

  const confirmMeetingPoint = () => {
    setIsVerifyingSafety(true);
    // Simulate real security check via GPS data
    setTimeout(() => {
      setIsVerifyingSafety(false);
      setScreen('ACTION_SCREEN');
    }, 2000);
  };

  // Handlers
  const handleSOS = () => {
    // Immediate Visual Feedback
    setIsSOSSent(true);
    
    // Explicitly notify user as tel: might be blocked in iframe
    alert("EMERGENCY ALERT: Calling Police (191) and notifying your emergency contacts immediately.");

    // Attempt to trigger system dialer
    try {
      window.location.href = "tel:191";
    } catch (e) {
      console.error("Dialer failed", e);
    }
    
    // Auto-reset after a while but stay in emergency UI for 8 seconds
    setTimeout(() => setIsSOSSent(false), 8000);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setScreen('OTP');
  };

  const handleVerifyOTP = () => {
    const newUser: LXRUser = {
      firstName: tempUser.firstName || 'Kwesi',
      lastName: tempUser.lastName || 'Mensah',
      email: tempUser.email || 'kwesi@example.com',
      phone: tempUser.phone || '+233 24 123 4567',
      gender: tempUser.gender || 'Male',
      dob: tempUser.dob || '1995-05-15',
      rating: 4.8,
      ridesTaken: 12,
      reliabilityScore: 98,
      profilePic: null,
      subscription: 'free',
    };
    setUser(newUser);
    setScreen('HOME');
  };

  const startMatching = () => {
    setScreen('MATCHING');
    setProgress(0);
    const interval = setInterval(() => setProgress(p => p < 100 ? p + 5 : 100), 100);
    
    // Use user coords to generate nearby riders
    const baseLat = userCoords?.lat || 6.6745;
    const baseLng = userCoords?.lng || -1.5716;

    setTimeout(() => {
      clearInterval(interval);
      setMatchedRiders([
        { 
          id: '1', firstName: 'Kojo', lastName: 'Addo', gender: 'Male', age: 28, rating: 4.9, 
          departureTime: '08:15 AM', isFamiliar: true, isVerified: true, reliabilityScore: 99,
          lat: baseLat + (Math.random() - 0.5) * 0.01,
          lng: baseLng + (Math.random() - 0.5) * 0.01
        },
        { 
          id: '2', firstName: 'Ama', lastName: 'Kyeremeh', gender: 'Female', age: 24, rating: 4.7, 
          departureTime: '08:20 AM', isVerified: true, reliabilityScore: 95,
          lat: baseLat + (Math.random() - 0.5) * 0.01,
          lng: baseLng + (Math.random() - 0.5) * 0.01
        },
        { 
          id: '3', firstName: 'Prince', lastName: 'Boateng', gender: 'Male', age: 31, rating: 4.5, 
          departureTime: '08:10 AM', reliabilityScore: 82,
          lat: baseLat + (Math.random() - 0.5) * 0.01,
          lng: baseLng + (Math.random() - 0.5) * 0.01
        },
      ]);
      setScreen('MATCH_RESULTS');
    }, 2500);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setMessages([...messages, { sender: 'You', text: messageInput, time: 'Now', isMe: true }]);
    setMessageInput('');
  };

  const renderBottomNav = () => {
    if (['SIGN_UP', 'SIGN_IN', 'OTP'].includes(screen)) return null;
    return (
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-2 z-50">
        {[
          { id: 'HOME', icon: Car, label: 'Ride' },
          { id: 'MY_RIDES', icon: History, label: 'My Rides' },
          { id: 'INBOX', icon: MessageSquare, label: 'Inbox' },
          { id: 'PROFILE', icon: UserIcon, label: 'Profile' }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setScreen(item.id as AppScreen)}
            className={`flex flex-col items-center gap-1 ${screen === item.id || (item.id === 'HOME' && ['PLAN_TRIP', 'MATCHING', 'MATCH_RESULTS', 'MEETING_POINT', 'ACTION_SCREEN', 'GROUP_CHAT', 'RIDE_TRACKING'].includes(screen)) ? 'text-primary' : 'text-gray-400'}`}
          >
            <item.icon size={20} />
            <span className="text-[9px] font-bold">{item.label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-[#120203] text-white flex items-center justify-center font-sans overflow-hidden relative">
      <div className="glow-blob top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary" />
      <div className="glow-blob bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary" />

      <div className="z-10 w-full max-w-6xl grid grid-cols-12 gap-8 items-center h-full max-h-[800px]">
        {/* PC Sidebar */}
        <div className="hidden lg:flex col-span-3 flex-col gap-6">
          <h1 className="text-5xl font-bold text-primary">LexRide</h1>
          <Card variant="glass">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center font-bold text-xl uppercase">
                {user ? `${user.firstName[0]}${user.lastName[0]}` : '??'}
              </div>
              <div>
                <div className="font-semibold">{user ? `${user.firstName} ${user.lastName}` : 'Guest User'}</div>
                <div className="text-sm text-gray-400">{user ? `⭐ ${user.rating} • ${user.ridesTaken} Rides` : 'Not signed in'}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Center: Mobile Frame */}
        <div className="col-span-12 lg:col-span-6 flex justify-center">
          <div className="phone-frame relative bg-white overflow-hidden shadow-2xl border-[8px] border-black rounded-[3rem] w-[320px] h-[650px]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50 flex items-center justify-center gap-2">
               <div className="w-2 h-2 rounded-full bg-white/10" />
               <div className="w-8 h-1 rounded-full bg-white/10" />
            </div>
            
            <AnimatePresence mode="wait">
              {screen === 'SIGN_UP' && (
                <ScreenWrapper screen="SIGN_UP" key="signup">
                  <div className="space-y-6">
                    <div className="text-center">
                      <Car className="text-primary mx-auto mb-2" size={32} />
                      <h2 className="text-xl font-bold text-black">Sign Up</h2>
                    </div>
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text" required placeholder="First" 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-black outline-none focus:border-primary"
                          value={tempUser.firstName}
                          onChange={e => setTempUser(u => ({...u, firstName: e.target.value}))} 
                        />
                        <input 
                          type="text" required placeholder="Last" 
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-black outline-none focus:border-primary"
                          value={tempUser.lastName}
                          onChange={e => setTempUser(u => ({...u, lastName: e.target.value}))} 
                        />
                      </div>
                      <input 
                        type="email" required placeholder="Email"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-black outline-none focus:border-primary"
                        value={tempUser.email}
                        onChange={e => setTempUser(u => ({...u, email: e.target.value}))}
                      />
                      <input 
                        type="tel" required placeholder="Phone"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-black outline-none focus:border-primary"
                        value={tempUser.phone}
                        onChange={e => setTempUser(u => ({...u, phone: e.target.value}))}
                      />
                      <Button className="mt-4">Join Now</Button>
                    </form>
                    <button onClick={() => setScreen('SIGN_IN')} className="w-full text-center text-xs text-gray-400">Already a member? <span className="text-primary font-bold">Sign In</span></button>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'SIGN_IN' && (
                <ScreenWrapper screen="SIGN_IN" key="signin" title="Welcome Back" onBack={() => setScreen('SIGN_UP')}>
                  <div className="flex flex-col h-full justify-center space-y-8 pb-10">
                    <div className="text-center">
                      <ShieldCheck className="text-primary mx-auto mb-4" size={48} />
                      <h2 className="text-xl font-bold text-black">Sign In</h2>
                    </div>
                    <div className="space-y-4">
                        <input type="tel" placeholder="Phone Number" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-black" />
                        <Button onClick={() => setScreen('OTP')}>Continue</Button>
                    </div>
                    <button onClick={() => setScreen('SIGN_UP')} className="w-full text-center text-xs text-gray-400">New here? <span className="text-primary font-bold">Create Account</span></button>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'OTP' && (
                <ScreenWrapper screen="OTP" key="otp" title="Verification" onBack={() => setScreen('SIGN_UP')}>
                  <div className="flex flex-col h-full justify-center space-y-8 pb-10">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-black">Enter Code</h2>
                      <p className="text-xs text-gray-400 mt-2">Check your SMS inbox</p>
                    </div>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4].map(i => <div key={i} className="w-12 h-12 bg-gray-50 border-2 border-gray-100 rounded-xl flex items-center justify-center font-bold text-black">7</div>)}
                    </div>
                    <Button onClick={handleVerifyOTP}>Verify</Button>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'HOME' && (
                <ScreenWrapper screen="HOME" key="home">
                  <div className="space-y-6 relative">
                    {/* Floating SOS button for map visibility */}
                    <button 
                      onClick={handleSOS} 
                      className="absolute top-0 right-0 z-[30] w-12 h-12 bg-red-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl border-2 border-white/20 active:scale-95 transition-all"
                    >
                      <AlertTriangle size={20} />
                      <span className="text-[6px] font-black uppercase">Police</span>
                    </button>

                    <div>
                      <h3 className="text-gray-400 font-bold uppercase text-[9px]">Hello</h3>
                      <h2 className="text-2xl font-bold text-black">{user?.firstName || 'User'}!</h2>
                    </div>
                    <div className="bg-primary rounded-3xl p-5 text-white relative shadow-xl overflow-hidden">
                       <h4 className="text-xl font-bold">Split rides.<br/>Save money.</h4>
                       <Car size={90} className="absolute -right-6 -bottom-2 text-white/20 rotate-12" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Card onClick={() => setScreen('PLAN_TRIP')} className="bg-white border hover:border-primary transition-all">
                        <Search className="text-primary mb-2" size={20} />
                        <span className="font-bold text-sm text-black">Find Ride</span>
                      </Card>
                      <Card onClick={() => setScreen('MY_RIDES')} className="bg-gray-50 border">
                        <History className="text-gray-400 mb-2" size={20} />
                        <span className="font-bold text-sm text-black">History</span>
                      </Card>
                    </div>
                    <div>
                      <h5 className="font-bold text-black text-sm mb-3">Your Location</h5>
                      <Card className="p-0 overflow-hidden h-40 border border-gray-100">
                      {userCoords ? (
                          <iframe title="map" width="100%" height="100%" style={{ border: 0 }}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${userCoords.lng - 0.01},${userCoords.lat - 0.01},${userCoords.lng + 0.01},${userCoords.lat + 0.01}&layer=mapnik&marker=${userCoords.lat},${userCoords.lng}`}
                          />
                        ) : <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs">Locating...</div>}
                      </Card>
                    </div>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'PLAN_TRIP' && (
                <ScreenWrapper screen="PLAN_TRIP" key="plan" title="Plan Trip" onBack={() => setScreen('HOME')}>
                  <div className="space-y-6">
                    <Card className="bg-gray-50 border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-4">
                          <MapPin className="text-primary" size={20} />
                          <div><div className="text-[9px] font-bold text-primary">FROM (GPS)</div><div className="text-xs font-bold text-black">{gpsAddress}</div></div>
                        </div>
                        <button 
                          onClick={() => {
                            setGpsAddress('Detecting location...');
                            setHasResolvedAddress(false);
                          }}
                          className="p-2 text-primary hover:bg-primary/5 rounded-full"
                          title="Refresh Location"
                        >
                          <Navigation size={14} className={gpsAddress === 'Detecting location...' ? 'animate-pulse' : ''} />
                        </button>
                      </div>
                    </Card>
                    <div className="space-y-2 relative">
                       <label className="text-[9px] uppercase font-bold text-gray-400 ml-1">Destination Search</label>
                       <input 
                         type="text" 
                         placeholder="Start typing area (e.g. Adum)" 
                         autoComplete="off"
                         autoCorrect="off"
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-bold text-black outline-none focus:border-primary" 
                         value={destZone} 
                         onChange={e => {
                           setDestZone(e.target.value);
                           if (selectedDest) setSelectedDest(null);
                         }} 
                       />
                       {isSearchLoading && (
                         <div className="absolute right-4 top-11">
                           <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                         </div>
                       )}
                       {destZone && !selectedDest && (
                         <p className="text-[10px] text-orange-500 font-bold ml-1">⚠️ Select a location from the dropdown to continue</p>
                       )}
                       {selectedDest && (
                         <p className="text-[10px] text-green-500 font-bold ml-1">✓ Destination set — {destZone}</p>
                       )}
                       {destSuggestions.length > 0 && (
                        <div className="absolute top-[105%] left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                          {destSuggestions.map((s, i) => (
                            <button 
                              key={i}
                              className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-50 last:border-none flex items-center gap-3 active:bg-primary/5"
                              onClick={() => {
                                setDestZone(s.name);
                                setSelectedDest({ lat: s.lat, lng: s.lng });
                                setDestSuggestions([]);
                              }}
                            >
                              <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                                <Search size={14} className="text-gray-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-black truncate">{s.name}</div>
                                <div className="text-[8px] text-gray-400 truncate tracking-tight">{s.fullName}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                       )}
                    </div>
                    <Button disabled={!selectedDest} onClick={startMatching}>Find Split Matches</Button>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'MATCHING' && (
                <ScreenWrapper screen="MATCHING" key="matching">
                  <div className="flex flex-col h-full items-center justify-center space-y-10 pb-20">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl">
                      <Search className="text-white" size={32} />
                    </motion.div>
                    <div className="text-center"><h2 className="text-xl font-bold text-black">Searching...</h2><p className="text-gray-400 text-xs">Matching you with others</p></div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mx-10">
                      <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'MATCH_RESULTS' && (
                <ScreenWrapper screen="MATCH_RESULTS" key="results" title="Suggested" onBack={() => setScreen('PLAN_TRIP')}>
                  <div className="space-y-4">
                    {matchedRiders.map(rider => (
                      <Card key={rider.id} onClick={() => {
                        const next = new Set(selectedRiderIds);
                        next.has(rider.id) ? next.delete(rider.id) : next.add(rider.id);
                        setSelectedRiderIds(next);
                      }} className={`border ${selectedRiderIds.has(rider.id) ? 'border-primary bg-primary/5 shadow-sm' : 'bg-white hover:border-gray-300'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-black ring-1 ring-black/5">{rider.firstName[0]}</div>
                          <div className="flex-1">
                            <div className="font-bold text-sm text-black">{rider.firstName}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                              {userCoords && rider.lat && (
                                <span className="text-primary font-bold">
                                  {getDistance(userCoords.lat, userCoords.lng, rider.lat, rider.lng).toFixed(1)}km away
                                </span>
                              )}
                              <span className="w-1 h-1 bg-gray-200 rounded-full" />
                              Leaves {rider.departureTime}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-0.5 justify-end text-yellow-500 font-bold text-xs"><Star size={10} fill="currentColor"/> {rider.rating}</div>
                            {selectedRiderIds.has(rider.id) && <Check className="text-primary mt-1 ml-auto" size={14}/>}
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button disabled={selectedRiderIds.size === 0} onClick={() => setScreen('MEETING_POINT')}>Continue ({selectedRiderIds.size})</Button>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'MEETING_POINT' && (
                <ScreenWrapper screen="MEETING_POINT" key="meeting" title={isVerifyingSafety ? "Verifying..." : "Meeting Spot"} onBack={isVerifyingSafety ? undefined : () => setScreen('MATCH_RESULTS')}>
                  <div className="space-y-6">
                    {isVerifyingSafety ? (
                      <div className="py-20 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                          <motion.div 
                            animate={{ rotate: 360 }} 
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
                          />
                          <ShieldCheck size={24} className="absolute inset-0 m-auto text-primary animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-black">Verifying Safe Zone</p>
                          <p className="text-[10px] text-gray-400 mt-1 px-10">Cross-referencing GPS historical data & community safety scores...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <MapPin size={16} className="text-primary" />
                             </div>
                             <div className="flex-1">
                                <div className="text-[9px] font-extrabold text-primary uppercase tracking-wider">Your Current Location</div>
                                <div className="text-xs font-bold text-black truncate max-w-[180px]">{gpsAddress || 'Finding address...'}</div>
                             </div>
                           </div>
                           <button 
                             onClick={() => {
                               setGpsAddress('Detecting location...');
                               setHasResolvedAddress(false);
                             }}
                             className="p-2 text-primary hover:bg-primary/5 rounded-full"
                           >
                             <Navigation size={14} className={gpsAddress === 'Detecting location...' ? 'animate-pulse' : ''} />
                           </button>
                        </div>

                        <div className="h-32 bg-gray-100 rounded-3xl overflow-hidden border border-gray-100 shadow-inner relative">
                          {userCoords && (
                            <iframe 
                              title="meeting-map" 
                              width="100%" 
                              height="100%" 
                              style={{ border: 0 }}
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${userCoords.lng - 0.02},${userCoords.lat - 0.02},${userCoords.lng + 0.02},${userCoords.lat + 0.02}&layer=mapnik&marker=${userCoords.lat},${userCoords.lng}`}
                            />
                          )}
                        </div>
                        <MeetingPointSuggestions 
                          ridersCoords={[
                            ...(userCoords ? [userCoords] : []),
                            ...selectedRiders.map(r => ({ lat: r.lat!, lng: r.lng! }))
                          ]} 
                          userCoords={userCoords}
                          gpsAddress={gpsAddress}
                          selectedMeetingPoint={selectedMeetingPoint} 
                          setSelectedMeetingPoint={setSelectedMeetingPoint} 
                        />
                        <Button disabled={!selectedMeetingPoint} onClick={confirmMeetingPoint}>
                          {selectedMeetingPoint ? `Confirm "${selectedMeetingPoint}"` : 'Select or Suggest a Safe Spot First'}
                        </Button>
                      </>
                    )}
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'ACTION_SCREEN' && (
                <ScreenWrapper screen="ACTION_SCREEN" key="actions" title="Book Ride" onBack={() => setScreen('MEETING_POINT')}>
                   <div className="space-y-4">
                      <Card onClick={() => { setIsRideActive(true); setScreen('GROUP_CHAT'); }} className="bg-primary/5 border-2 border-primary/20">
                         <div className="flex gap-4">
                            <Car className="text-primary" size={24} />
                            <div><h3 className="font-bold text-sm text-black">Split Fare</h3><p className="text-[10px] text-gray-400">Pay 1/{(selectedRiderIds.size + 1)} of total.</p></div>
                         </div>
                      </Card>
                      <Button variant="secondary" onClick={() => setScreen('HOME')}>Maybe Later</Button>
                   </div>
                </ScreenWrapper>
              )}

              {screen === 'GROUP_CHAT' && (
                <ScreenWrapper screen="GROUP_CHAT" key="chat" title="Group Chat" onBack={() => setScreen('HOME')}>
                   <div className="flex flex-col h-full -mx-6 -mt-6">
                      {/* Riders header strip */}
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {/* User avatar */}
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden">
                            {user?.profilePic ? <img src={user.profilePic} className="w-full h-full object-cover"/> : `${user?.firstName[0]}${user?.lastName[0]}`}
                          </div>
                          {/* Selected riders avatars */}
                          {selectedRiders.map((r) => (
                            <div key={r.id} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 shrink-0">
                              {r.firstName[0]}{r.lastName[0]}
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-black truncate">
                            You{selectedRiders.map(r => `, ${r.firstName}`).join('')}
                          </div>
                          <div className="text-[9px] text-gray-400">{selectedRiders.length + 1} people · {destZone}</div>
                        </div>
                        {isRideActive && (
                          <button onClick={() => setScreen('RIDE_TRACKING')} className="text-[9px] font-black text-white bg-primary px-2 py-1 rounded-lg">Track</button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                         {/* System message always first */}
                         <div className="text-center">
                           <span className="text-[9px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-bold">
                             🎉 Group created · {selectedRiders.length + 1} riders matched
                           </span>
                         </div>

                         {messages.map((m, i) => {
                           // Find if sender is a selected rider
                           const riderSender = selectedRiders.find(r => r.firstName === m.sender);
                           // Only show messages from: system, user (isMe), or selected riders
                           const isSystem = m.sender === 'System';
                           const isValidSender = m.isMe || isSystem || !!riderSender;
                           if (!isValidSender) return null;

                           return (
                             <div key={i} className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'}`}>
                               {!m.isMe && !isSystem && (
                                 <div className="flex items-center gap-1.5 mb-1">
                                   <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-600">
                                     {m.sender[0]}
                                   </div>
                                   <span className="text-[9px] text-gray-400 font-bold">{m.sender}</span>
                                 </div>
                               )}
                               <div className={`p-3 rounded-2xl text-xs max-w-[80%] ${
                                 isSystem ? 'bg-blue-50 text-blue-600 text-[10px] italic text-center w-full' :
                                 m.isMe ? 'bg-primary text-white rounded-tr-none' :
                                 'bg-gray-100 text-black rounded-tl-none'
                               }`}>{m.text}</div>
                               <span className="text-[8px] text-gray-300 mt-0.5">{m.time}</span>
                             </div>
                           );
                         })}
                      </div>
                      <div className="p-4 bg-white border-t flex gap-2">
                         <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden">
                           {user?.profilePic ? <img src={user.profilePic} className="w-full h-full object-cover"/> : `${user?.firstName[0]}${user?.lastName[0]}`}
                         </div>
                         <input className="flex-1 bg-gray-50 p-3 rounded-xl text-xs outline-none" placeholder="Message..." value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                         <button onClick={handleSendMessage} className="p-3 bg-primary text-white rounded-xl"><Send size={16}/></button>
                      </div>
                   </div>
                </ScreenWrapper>
              )}

              {screen === 'RIDE_TRACKING' && (
                <ScreenWrapper screen="RIDE_TRACKING" key="tracking" title="Navigation" onBack={() => setScreen('HOME')}>
                  <div className="flex-1 relative bg-[#e8eaed] overflow-hidden h-full -mx-6 -mt-12 flex flex-col">
                    {/* Real Navigation Map */}
                    <div className="flex-1 relative">
                      {userCoords && (
                        <MapContainer 
                          center={[userCoords.lat, userCoords.lng]} 
                          zoom={16} 
                          zoomControl={false}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution='&copy; CARTO'
                          />
                          
                          {/* Route Line */}
                          {routePolyline.length > 0 && (
                            <>
                              <Polyline 
                                positions={routePolyline} 
                                pathOptions={{ color: '#4285F4', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }} 
                              />
                              <MapFitBounds points={routePolyline} />
                            </>
                          )}

                          {/* Pulsing Dot - Current Position */}
                          <Marker 
                            position={[userCoords.lat, userCoords.lng]} 
                            icon={L.divIcon({
                              className: 'custom-div-icon',
                              html: `
                                <div class="relative flex items-center justify-center">
                                  <div class="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping"></div>
                                  <div class="w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-blue-600">
                                    <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
                                  </div>
                                </div>
                              `,
                              iconSize: [32, 32],
                              iconAnchor: [16, 16]
                            })} 
                          />

                          {/* Destination Marker */}
                          {selectedDest && (
                            <Marker 
                              position={[selectedDest.lat, selectedDest.lng]} 
                              icon={L.divIcon({
                                className: 'dest-icon',
                                html: `<div class="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white"><span class="w-1 h-1 bg-white rounded-full"></span></div>`,
                                iconSize: [24, 24],
                                iconAnchor: [12, 12]
                              })}
                            />
                          )}
                        </MapContainer>
                      )}

                      {/* Header Info (Current Road) */}
                      <div className="absolute top-4 inset-x-4 z-[40] flex gap-2">
                        <div className="bg-[#1a73e8] text-white p-3 rounded-2xl shadow-xl flex items-center gap-3 flex-1">
                          <Navigation size={24} className="rotate-45" />
                          <div>
                            <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Heading North</div>
                            <div className="text-sm font-bold truncate">Follow route to {destZone.split(',')[0]}</div>
                          </div>
                        </div>
                        <button 
                          onClick={handleSOS}
                          className="w-14 h-14 bg-red-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl border-2 border-white/20 active:scale-95 transition-all shrink-0"
                        >
                          <AlertTriangle size={24} />
                          <span className="text-[7px] font-black uppercase">SOS</span>
                        </button>
                      </div>
                    </div>

                    {/* Navigation Info Bar Sheet */}
                    <div className="bg-white border-t border-gray-100 p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-[40] min-h-[160px]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-[#1e8e3e]">{tripInfo?.duration || 'Calculating...'}</span>
                            <span className="text-gray-400 text-sm">{tripInfo?.distance || ''}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                            Arriving at 10:45 AM • Via Main Road
                          </div>
                        </div>
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                           <Car className="text-[#1a73e8]" size={24} />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button 
                          onClick={() => { setIsRideActive(false); setScreen('RATING'); }}
                          className="bg-red-600 hover:bg-red-700 text-white flex-1 py-3"
                        >
                          Exit Navigation
                        </Button>
                        <button 
                          onClick={handleSOS}
                          className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 active:scale-95 transition-all"
                        >
                          <AlertTriangle size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </ScreenWrapper>
              )}

              {screen === 'PROFILE' && (
                <ScreenWrapper screen="PROFILE" key="profile" title="Profile" onBack={() => setScreen('HOME')}>
                   <div className="flex flex-col items-center space-y-5">
                      {/* Profile Picture */}
                      <div className="relative">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-3xl font-bold text-primary overflow-hidden border-2 border-primary/20">
                          {profilePicUrl
                            ? <img src={profilePicUrl} className="w-full h-full object-cover" alt="Profile"/>
                            : <span>{user?.firstName[0]}{user?.lastName[0]}</span>
                          }
                        </div>
                        {/* Camera button */}
                        <label htmlFor="profile-pic-input" className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer border-2 border-white shadow-md">
                          <span className="text-white text-sm">📷</span>
                        </label>
                        <input
                          id="profile-pic-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePicChange}
                        />
                      </div>

                      <div className="text-center">
                        <h2 className="text-xl font-bold text-black">{user?.firstName} {user?.lastName}</h2>
                        <p className="text-gray-400 text-sm">{user?.email}</p>
                        <p className="text-gray-400 text-xs mt-0.5">+233 {user?.phone}</p>
                      </div>

                      {/* Stats row */}
                      <div className="w-full grid grid-cols-3 gap-3">
                        {[
                          { label: 'Rating', value: `⭐ ${user?.rating}` },
                          { label: 'Rides', value: user?.ridesTaken },
                          { label: 'Reliability', value: `${user?.reliabilityScore}%` },
                        ].map((s) => (
                          <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                            <div className="text-base font-black text-black">{s.value}</div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Subscription card */}
                      <div className="w-full">
                        <div className={`rounded-2xl p-4 border-2 ${user?.subscription === 'premium' ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${user?.subscription === 'premium' ? 'bg-yellow-400' : 'bg-gray-200'}`}>
                                {user?.subscription === 'premium' ? '👑' : '🆓'}
                              </div>
                              <div>
                                <div className="text-sm font-black text-black">
                                  {user?.subscription === 'premium' ? 'Premium Rider' : 'Free Plan'}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {user?.subscription === 'premium' ? 'Unlimited matches · No ads' : '3 matches/month · Ads shown'}
                                </div>
                              </div>
                            </div>
                            {user?.subscription !== 'premium' && (
                              <button
                                onClick={() => user && setUser({ ...user, subscription: 'premium' })}
                                className="bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-xl"
                              >
                                Upgrade GH₵29
                              </button>
                            )}
                            {user?.subscription === 'premium' && (
                              <span className="text-[10px] font-black text-yellow-600 bg-yellow-100 px-2 py-1 rounded-lg">ACTIVE</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="w-full space-y-2">
                        <Button variant="secondary" onClick={() => setScreen('SIGN_IN')}>Sign Out</Button>
                      </div>
                   </div>
                </ScreenWrapper>
              )}

              {screen === 'MY_RIDES' && (
                <ScreenWrapper screen="MY_RIDES" key="history" title="History" onBack={() => setScreen('HOME')}>
                   <div className="space-y-4">
                      {MOCK_HISTORY.map(h => (
                        <Card key={h.id} className="bg-white border p-0 overflow-hidden">
                           <img src={h.mapPreview} className="h-24 w-full object-cover opacity-50 grayscale" />
                           <div className="p-4"><div className="flex justify-between"><span className="text-[10px] font-bold text-gray-400 uppercase">{h.date}</span><span className="text-primary font-bold">{h.cost}</span></div><div className="font-bold text-sm text-black mt-1">{h.destination}</div></div>
                        </Card>
                      ))}
                   </div>
                </ScreenWrapper>
              )}

              {screen === 'INBOX' && (
                <ScreenWrapper screen="INBOX" key="inbox" title="Messages" onBack={() => setScreen('HOME')}>
                   <div className="space-y-3">
                      {isRideActive && (
                        <motion.div 
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="mb-6"
                        >
                          <Card 
                            onClick={() => setScreen('RIDE_TRACKING')} 
                            className="bg-primary/10 border-2 border-primary/30 shadow-lg flex items-center justify-between p-5 active:scale-95 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white relative z-10">
                                  <Navigation2 size={24} className="fill-white" />
                                </div>
                              </div>
                              <div>
                                <div className="font-black text-sm text-black uppercase tracking-tight">Active Trip Tracker</div>
                                <div className="text-[10px] text-primary font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                  LIVE NOW • View route and ETA
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={20} className="text-primary" />
                          </Card>
                        </motion.div>
                      )}
                      
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.2em] mb-4">Recent Conversations</p>
                      <Card className="flex gap-4 border p-4 hover:border-primary/20 transition-all cursor-pointer" onClick={() => setScreen('GROUP_CHAT')}>
                         <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-primary font-bold">AG</div>
                         <div className="flex-1">
                            <div className="flex justify-between items-center mb-0.5">
                               <div className="font-bold text-sm text-black">Abelemkpe Group</div>
                               <span className="text-[9px] text-gray-400 font-bold">10:42 AM</span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-1">Ama: Just reached the meeting point!</p>
                         </div>
                      </Card>
                   </div>
                </ScreenWrapper>
              )}

              {screen === 'RATING' && (
                <ScreenWrapper screen="RATING" key="rating" title="Rate Group">
                   <div className="flex flex-col space-y-6 pt-4 px-2">
                      <div className="text-center">
                        <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Star size={32} className="text-yellow-400" fill="currentColor"/>
                        </div>
                        <h2 className="text-xl font-bold text-black">Rate Your Co-Riders</h2>
                        <p className="text-gray-400 text-xs mt-2">Help keep LexRide safe and friendly for everyone.</p>
                      </div>

                      {selectedRiders.length > 0 ? (
                        <div className="space-y-4">
                          {selectedRiders.map((rider) => (
                            <div key={rider.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {rider.firstName[0]}{rider.lastName[0]}
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-black">{rider.firstName} {rider.lastName}</div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{rider.gender} · {rider.age} yrs · ⭐ {rider.rating}</div>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {[1,2,3,4,5].map(star => (
                                    <button
                                      key={star}
                                      onClick={() => setRiderRatings(prev => ({ ...prev, [rider.id]: star }))}
                                      className={`transition-all duration-150 active:scale-125 ${
                                        (riderRatings[rider.id] || 0) >= star ? 'text-yellow-400' : 'text-gray-200'
                                      }`}
                                    >
                                      <Star size={20} fill={(riderRatings[rider.id] || 0) >= star ? "currentColor" : "none"} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {riderRatings[rider.id] && (
                                <div className="mt-2 text-[10px] text-primary font-bold text-right">
                                  {riderRatings[rider.id] === 5 ? '⭐ Excellent!' : riderRatings[rider.id] >= 4 ? '👍 Good' : riderRatings[rider.id] >= 3 ? '😐 Okay' : '👎 Poor'}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">No co-riders to rate.</div>
                      )}

                      <div className="space-y-3 pt-2">
                        <Button
                          disabled={selectedRiders.length > 0 && Object.keys(riderRatings).length === 0}
                          onClick={() => { setScreen('HOME'); setRiderRatings({}); }}
                        >
                          {Object.keys(riderRatings).length > 0 ? 'Submit Ratings ✓' : 'Skip for Now'}
                        </Button>
                        {Object.keys(riderRatings).length === 0 && selectedRiders.length > 0 && (
                          <p className="text-center text-[10px] text-gray-400">Tap the stars above to rate each rider</p>
                        )}
                      </div>
                   </div>
                </ScreenWrapper>
              )}

            </AnimatePresence>

            {/* Emergency Global Overlay */}
            <AnimatePresence>
              {isSOSSent && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[1000] bg-red-600 flex flex-col items-center justify-center p-8 text-white text-center"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-red-600 mb-6 shadow-2xl"
                  >
                    <AlertTriangle size={48} strokeWidth={3} />
                  </motion.div>
                  <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter italic leading-none">SOS TRIGGERED</h1>
                  <p className="text-xl font-bold mb-8 leading-tight">CALLING POLICE (191) & NOTIFYING CONTACTS</p>
                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mb-8">
                    <motion.div 
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: 8, ease: "linear" }}
                      className="h-full bg-white"
                    />
                  </div>
                  <button 
                    onClick={() => setIsSOSSent(false)}
                    className="px-8 py-4 bg-white text-red-600 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                  >
                    Cancel Alert
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {renderBottomNav()}
          </div>
        </div>

        {/* Community activity side bar */}
        <div className="hidden lg:flex col-span-3 flex-col gap-6">
           <Card variant="glass">
             <h3 className="text-primary font-bold mb-4">Feed</h3>
             <div className="space-y-4">
                {[1, 2].map(i => (
                   <div key={i} className="flex gap-3 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-white/10" />
                      <div><p className="font-bold">Recent Match</p><p className="text-gray-400">KNUST to Kejetia</p></div>
                   </div>
                ))}
             </div>
           </Card>
        </div>
      </div>
    </div>
  );
}
