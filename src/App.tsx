import { useEffect, useMemo, useState, type FormEvent, type Key } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  X,
} from "lucide-react";

type Trip = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  joined: number;
  contribution: number;
  meetingPoint: string;
  host: string;
  status: "Open" | "Almost full" | "Full";
};

type GuestRequest = { id: string; name: string; sex: "Male" | "Female"; status: "Waiting" | "Approved" | "Declined" };
type ChatMessage = { id: string; sender: string; text: string; mine?: boolean };

type LocationSuggestion = {
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  source?: string;
};

const initialTrips: Trip[] = [
  {
    id: "LX-4K2M",
    from: "University of Ghana, Legon",
    to: "Accra Mall",
    date: "Fri, 27 Sep",
    time: "6:30 PM",
    seats: 4,
    joined: 3,
    contribution: 35,
    meetingPoint: "UG Main Gate",
    host: "Ama K.",
    status: "Almost full",
  },
  {
    id: "LX-8P7Q",
    from: "Accra",
    to: "Kumasi",
    date: "Sat, 28 Sep",
    time: "6:00 AM",
    seats: 4,
    joined: 2,
    contribution: 240,
    meetingPoint: "Circle Station",
    host: "Kojo T.",
    status: "Open",
  },
  {
    id: "LX-1N9R",
    from: "Kasoa",
    to: "Accra Central",
    date: "Mon, 30 Sep",
    time: "6:45 AM",
    seats: 4,
    joined: 4,
    contribution: 28,
    meetingPoint: "Kasoa New Market",
    host: "Esi A.",
    status: "Full",
  },
];

const places = ["Accra", "Kumasi", "Cape Coast", "Madina", "Legon", "Accra Mall", "Kasoa", "Tema"];
const quickLocations: LocationSuggestion[] = ([
  ["Adum", "Adum, Kumasi, Ghana", 6.689568, -1.618825],
  ["Kumasi", "Kumasi, Ashanti Region, Ghana", 6.700071, -1.630783],
  ["Kromuase", "Kromuase, Kumasi, Ghana", 6.673, -1.69],
  ["Ayeduase", "Ayeduase, Kumasi, Ghana", 6.675, -1.55944],
  ["KNUST", "Kwame Nkrumah University of Science and Technology, Kumasi", 6.6745, -1.5716],
  ["Kejetia", "Kejetia, Kumasi, Ghana", 6.697, -1.624],
  ["Bantama", "Bantama, Kumasi, Ghana", 6.702, -1.642],
  ["Suame", "Suame, Kumasi, Ghana", 6.716, -1.62],
  ["Accra", "Accra, Greater Accra, Ghana", 5.6037, -0.187],
  ["Osu", "Osu, Accra, Ghana", 5.556, -0.182],
  ["Accra Central", "Accra Central, Ghana", 5.552, -0.205],
  ["Circle", "Kwame Nkrumah Circle, Accra, Ghana", 5.574, -0.216],
  ["Kaneshie", "Kaneshie, Accra, Ghana", 5.57, -0.25],
  ["Madina", "Madina, Accra, Ghana", 5.683, -0.168],
  ["Legon", "Legon, Accra, Ghana", 5.65, -0.187],
  ["University of Ghana", "University of Ghana, Legon, Accra, Ghana", 5.65, -0.186],
  ["Accra Mall", "Accra Mall, Tetteh Quarshie, Accra, Ghana", 5.624, -0.17],
  ["East Legon", "East Legon, Accra, Ghana", 5.635, -0.152],
  ["Airport City", "Airport City, Accra, Ghana", 5.604, -0.17],
  ["Kotoka Airport", "Kotoka International Airport, Accra, Ghana", 5.605, -0.167],
  ["Teshie", "Teshie, Accra, Ghana", 5.583, -0.116],
  ["Labadi", "Labadi, Accra, Ghana", 5.568, -0.145],
  ["Spintex", "Spintex Road, Accra, Ghana", 5.625, -0.116],
  ["Tema", "Tema, Greater Accra, Ghana", 5.6698, 0.0166],
] as const).map(([name, formatted_address, lat, lng]) => ({ name, formatted_address, geometry: { location: { lat, lng } }, source: "LexRide quick directory" }));
const locationCache = new Map<string, LocationSuggestion[]>();

const toast = {
  success: (message: string, options?: { description?: string }) => window.alert(options?.description ? `${message}\n\n${options.description}` : message),
  info: (message: string, options?: { description?: string }) => window.alert(options?.description ? `${message}\n\n${options.description}` : message),
  error: (message: string) => window.alert(message),
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="brand-mark"><span>L</span></div>
      <div className="leading-none">
        <div className="font-display text-[1.35rem] font-bold tracking-[-0.04em] text-ink">LexRide</div>
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate">Share the way</div>
      </div>
    </div>
  );
}

function RouteLine({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full border-[3px] border-terracotta bg-sand" />
      <span className="truncate font-semibold text-ink">{from}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate/60" />
      <span className="truncate font-semibold text-ink">{to}</span>
    </div>
  );
}

function LocationInput({ label, value, placeholder, onChange, onSelect, locked = false }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; onSelect: (place: LocationSuggestion) => void; locked?: boolean }) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (locked) {
      setSuggestions([]);
      setError("");
      setLoading(false);
      return;
    }
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setError("");
      return;
    }
    const quickMatches = quickLocations.filter((place) => `${place.name} ${place.formatted_address}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
    const cached = locationCache.get(query.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return;
    }
    if (quickMatches.length) setSuggestions(quickMatches);
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setError("");
      try {
        const response = await fetch(`/api/textsearch?query=${encodeURIComponent(query)}&region=GH&radius=25000`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || data.status === "CONFIG_ERROR" || data.status === "GOOGLE_ERROR") {
          setSuggestions([]);
          setError(data.error || "Google Maps search is unavailable right now");
          return;
        }
        const results = (data.results || []).slice(0, 5);
        locationCache.set(query.toLowerCase(), results);
        setSuggestions(results.length ? results : quickMatches);
      } catch {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError("Could not search locations. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, locked]);

  return (
    <label className="field-label relative">
      {label}
      <span className="relative block">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-terracotta" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`field-input !pl-10 ${locked ? "bg-[#f4f1ea]" : ""}`} autoComplete="off" readOnly={locked} />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate">Searching…</span>}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
            {suggestions.map((place) => (
              <button key={`${place.name}-${place.geometry.location.lat}`} type="button" onClick={() => { onSelect(place); setSuggestions([]); }} className="block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-[#fff7f2]">
                <span className="block truncate text-sm font-semibold text-ink">{place.name}</span>
                <span className="mt-0.5 block truncate text-[11px] font-normal text-slate">{place.formatted_address || "Map location"}</span>
              </button>
            ))}
          </div>
        )}
      </span>
      <span className="mt-1 block text-[10px] font-normal text-slate">{locked ? "Detected from your device GPS" : "Search and choose a map result"}</span>
      {error && <span className="mt-1 block text-[10px] font-semibold text-terracotta">{error}</span>}
    </label>
  );
}

function CurrentLocationButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return <button type="button" className="button-soft mt-2 !w-full justify-center !py-2.5 text-xs" onClick={onClick} disabled={loading}><Navigation className="mr-2 h-3.5 w-3.5" />{loading ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Finding you…</> : "Use my current location"}</button>;
}

function decodePolyline(encoded: string): Array<[number, number]> {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points: Array<[number, number]> = [];
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function RouteMap({ from, to, fromLocation, toLocation }: { from: string; to: string; fromLocation?: LocationSuggestion; toLocation?: LocationSuggestion }) {
  const [route, setRoute] = useState<Array<[number, number]>>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();
    setRouteLoading(true);
    const origin = fromLocation ? `${fromLocation.geometry.location.lat},${fromLocation.geometry.location.lng}` : from;
    const destination = toLocation ? `${toLocation.geometry.location.lat},${toLocation.geometry.location.lng}` : to;
    fetch(`/api/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const currentRoute = data.routes?.[0];
        setDuration(currentRoute?.duration ?? null);
        if (currentRoute?.geometry?.coordinates) setRoute(currentRoute.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
        else setRoute(currentRoute?.overview_polyline?.points ? decodePolyline(currentRoute.overview_polyline.points) : []);
      })
      .catch(() => { setRoute([]); setDuration(null); })
      .finally(() => setRouteLoading(false));
    return () => controller.abort();
  }, [from, to, fromLocation, toLocation]);

  const path = useMemo(() => {
    if (route.length < 2) return "";
    const lats = route.map(([lat]) => lat); const lngs = route.map(([, lng]) => lng);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const width = Math.max(maxLng - minLng, 0.001); const height = Math.max(maxLat - minLat, 0.001);
    return route.map(([lat, lng]) => `${12 + ((lng - minLng) / width) * 76},${88 - ((lat - minLat) / height) * 70}`).join(" ");
  }, [route]);

  if (!from || !to) return null;
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-[#dfe9da]">
      <div className="relative h-[220px]">
        <div className="absolute inset-0 route-preview-grid" />
        {path ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><polyline points={path} fill="none" stroke="#b95638" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <div className="route-preview-line" />}
        <div className="route-preview-start" />
        <div className="route-preview-end" />
        <div className="route-label route-label-start">{from}</div>
        <div className="route-label route-label-end">{to}</div>
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-ink shadow-sm backdrop-blur">{routeLoading ? "Calculating route…" : duration ? `Estimated drive time · ${Math.max(1, Math.round(duration / 60))} min` : "Route preview"}</div>
      </div>
    </div>
  );
}

function TripCard({ trip, onJoin, onShare }: { trip: Trip; onJoin: (trip: Trip) => void; onShare: (trip: Trip) => void; key?: Key }) {
  const full = trip.joined >= trip.seats;
  return (
    <article className="trip-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <RouteLine from={trip.from} to={trip.to} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-terracotta" />{trip.date}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-terracotta" />{trip.time}</span>
          </div>
        </div>
        <span className={`status-pill ${full ? "status-full" : trip.joined === trip.seats - 1 ? "status-warm" : "status-green"}`}>
          {full ? "Full" : `${trip.seats - trip.joined} seat${trip.seats - trip.joined === 1 ? "" : "s"} left`}
        </span>
      </div>
      <div className="my-4 h-px bg-line" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-sand px-3 py-2.5">
          <div className="text-slate">Expected contribution</div>
          <div className="mt-0.5 font-display text-lg font-bold text-ink">GHS {Math.max(1, trip.contribution - 7)}–{trip.contribution + 7}</div>
          <div className="mt-0.5 text-[10px] font-medium text-slate">estimated · traffic may change it</div>
        </div>
        <div className="rounded-xl bg-sand px-3 py-2.5">
          <div className="text-slate">Meet at</div>
          <div className="mt-1 flex items-center gap-1 font-semibold text-ink"><MapPin className="h-3.5 w-3.5 text-terracotta" /> <span className="truncate">{trip.meetingPoint}</span></div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate">
          <div className="avatar">{trip.host.slice(0, 1)}</div>
          <span>Started by <strong className="text-ink">{trip.host}</strong></span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onShare(trip)} className="icon-button" aria-label="Share trip"><Share2 className="h-4 w-4" /></button>
          <button onClick={() => onJoin(trip)} disabled={full} className="button-primary !rounded-xl !px-3.5 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">{full ? "Full" : "Join trip"}</button>
        </div>
      </div>
    </article>
  );
}

function MeetingPointSheet({ trip, onClose, onConfirm }: { trip: Trip; onClose: () => void; onConfirm: (point: string) => void }) {
  const options = [trip.meetingPoint, "A&C Mall entrance", "Shell station on the main road"];
  const [selected, setSelected] = useState(trip.meetingPoint);
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div className="sheet-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow">Trip {trip.id}</div>
            <h3 className="mt-1 font-display text-2xl font-bold text-ink">Agree a meeting point</h3>
            <p className="mt-1 text-sm text-slate">Pick a public place that is easy for everyone to find.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 rounded-2xl bg-[#e6f0ea] p-4 text-sm text-ink">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-forest" /> Keep the first meetup public</div>
          <p className="mt-1 text-xs leading-5 text-slate">LexRide suggests visible places near the route. Never use a private home address as a pickup point.</p>
        </div>
        <div className="mt-4 space-y-2">
          {options.map((option, index) => (
            <button key={option} onClick={() => setSelected(option)} className={`meeting-option ${selected === option ? "meeting-selected" : ""}`}>
              <span className={`meeting-radio ${selected === option ? "meeting-radio-selected" : ""}`}>{selected === option && <Check className="h-3 w-3" />}</span>
              <span className="flex-1 text-left"><span className="block text-sm font-semibold text-ink">{option}</span><span className="mt-0.5 block text-xs text-slate">{index === 0 ? "Current suggestion · 2 min from route" : index === 1 ? "Popular · well-lit entrance" : "Public landmark · easy parking"}</span></span>
              <Vote className="h-4 w-4 text-slate/50" />
            </button>
          ))}
        </div>
        <button className="button-primary mt-5 w-full" onClick={() => onConfirm(selected)}>Confirm meeting point</button>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<"home" | "create" | "trips">("home");
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [showSheet, setShowSheet] = useState<Trip | null>(null);
  const [joinTrip, setJoinTrip] = useState<Trip | null>(null);
  const [joinStage, setJoinStage] = useState<"form" | "waiting" | "room">("form");
  const [guestName, setGuestName] = useState("");
  const [guestSex, setGuestSex] = useState<"Male" | "Female" | "">("");
  const [guestRequests, setGuestRequests] = useState<GuestRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ id: "welcome", sender: "LexRide", text: "Welcome to the trip room. Agree on a public meeting point here." }]);
  const [chatDraft, setChatDraft] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ from: "", to: "", date: "", time: "", seats: "3", contribution: "" });
  const [selectedLocations, setSelectedLocations] = useState<{ from?: LocationSuggestion; to?: LocationSuggestion }>({});
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [currentLocationLocked, setCurrentLocationLocked] = useState(false);

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return trips;
    return trips.filter((trip) => `${trip.from} ${trip.to} ${trip.meetingPoint}`.toLowerCase().includes(query));
  }, [search, trips]);

  const shareTrip = (trip: Trip) => {
    const joinLink = `${window.location.origin}/?trip=${encodeURIComponent(trip.id)}`;
    const text = `Join my LexRide trip: ${trip.from} → ${trip.to}, ${trip.date} at ${trip.time}. ${trip.seats - trip.joined} seat(s) left. Join here: ${joinLink}`;
    navigator.clipboard?.writeText(text);
    toast.success("Trip message copied", { description: "Paste it into WhatsApp to invite people." });
  };

  const join = (trip: Trip) => {
    setJoinTrip(trip);
    setJoinStage("form");
    setGuestName("");
    setGuestSex("");
  };

  useEffect(() => {
    const tripId = new URLSearchParams(window.location.search).get("trip");
    if (!tripId) return;
    const trip = trips.find((item) => item.id === tripId);
    if (trip) join(trip);
  }, []);

  const submitJoinRequest = () => {
    if (!joinTrip || !guestName.trim() || !guestSex) { toast.error("Enter your name and confirm Male or Female first"); return; }
    setGuestRequests((items) => [...items, { id: `guest-${Date.now()}`, name: guestName.trim(), sex: guestSex, status: "Waiting" }]);
    setJoinStage("waiting");
  };

  const approveGuest = (request: GuestRequest) => {
    setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Approved" } : item));
    setTrips((items) => items.map((item) => item.id === createdTrip?.id ? { ...item, joined: Math.min(item.seats, item.joined + 1), status: item.joined + 1 >= item.seats ? "Full" : "Almost full" } : item));
    setJoinStage("room");
  };

  const declineGuest = (request: GuestRequest) => setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Declined" } : item));

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((items) => [...items, { id: `message-${Date.now()}`, sender: "You", text, mine: true }]);
    setChatDraft("");
  };

  const createTrip = (e: FormEvent) => {
    e.preventDefault();
    if (!form.from || !form.to || !form.date || !form.time) {
      toast.error("Add your route and departure time first");
      return;
    }
    if (!selectedLocations.from || !selectedLocations.to) {
      toast.error("Choose your current location or select both places from the map suggestions");
      return;
    }
    const trip: Trip = {
      id: `LX-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      from: form.from,
      to: form.to,
      date: new Date(form.date).toLocaleDateString("en-GH", { weekday: "short", day: "2-digit", month: "short" }),
      time: form.time,
      seats: Number(form.seats),
      joined: 1,
      contribution: Number(form.contribution) || 0,
      meetingPoint: "Choose together",
      host: "You",
      status: "Open",
    };
    setTrips((items) => [trip, ...items]);
    setCreatedTrip(trip);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device. Enter your starting place manually.");
      return;
    }
    setLocationLoading(true);
    setLocationMessage("");
    setForm((current) => ({ ...current, from: "" }));
    setSelectedLocations((current) => ({ ...current, from: undefined }));
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const fallback: LocationSuggestion = { name: "Your current location", formatted_address: "Device GPS location", geometry: { location: { lat: coords.latitude, lng: coords.longitude } }, source: "Device GPS" };
      try {
        const response = await fetch(`/api/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);
        const data = await response.json();
        const place = data.result || fallback;
        setForm((current) => ({ ...current, from: place.name }));
        setSelectedLocations((current) => ({ ...current, from: place }));
        setCurrentLocationLocked(true);
        setLocationMessage(`Starting point: ${place.formatted_address || place.name}`);
      } catch {
        setForm((current) => ({ ...current, from: fallback.name }));
        setSelectedLocations((current) => ({ ...current, from: fallback }));
        setCurrentLocationLocked(true);
        setLocationMessage("Starting point set from your device GPS.");
      } finally {
        setLocationLoading(false);
      }
    }, (error) => {
      setLocationLoading(false);
      setLocationMessage("Location permission was not granted. You can enter a starting place manually.");
      toast.error(error.code === error.PERMISSION_DENIED ? "Location permission was denied. You can enter your starting place manually." : "We could not find your location. Check GPS and try again.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  useEffect(() => {
    if (view === "create" && !selectedLocations.from && !locationLoading) useCurrentLocation();
  }, [view]);

  const confirmMeetingPoint = (point: string) => {
    if (!showSheet) return;
    setTrips((items) => items.map((item) => item.id === showSheet.id ? { ...item, meetingPoint: point } : item));
    setShowSheet(null);
    toast.success("Meeting point confirmed", { description: point });
  };

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="site-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <button onClick={() => { setView("home"); setCreatedTrip(null); }} aria-label="LexRide home"><Logo /></button>
          <nav className="hidden items-center gap-1 md:flex">
            <button className={`nav-link ${view === "home" ? "nav-active" : ""}`} onClick={() => setView("home")}>Find a trip</button>
            <button className={`nav-link ${view === "trips" ? "nav-active" : ""}`} onClick={() => setView("trips")}>My trips <span className="nav-count">{trips.filter((trip) => trip.host === "You").length}</span></button>
            <button className="nav-link" onClick={() => toast.info("LexRide V1 keeps the basics simple", { description: "Create a trip, share it, and meet in a public place." })}>How it works</button>
          </nav>
          <button className="button-dark hidden !rounded-xl !px-4 !py-2.5 text-sm md:inline-flex" onClick={() => { setView("create"); setCreatedTrip(null); }}><Plus className="mr-1.5 h-4 w-4" /> Create a trip</button>
          <button className="icon-button md:hidden" onClick={() => setView(view === "create" ? "home" : "create")} aria-label="Create trip"><Plus className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 lg:px-8 lg:pt-14">
        {view === "home" && <>
          <section className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> Passenger-first ride sharing</div>
              <h1 className="mt-4 max-w-xl font-display text-[clamp(2.8rem,6vw,5.7rem)] font-bold leading-[0.94] tracking-[-0.065em] text-ink">Go the same way.<br /><span className="text-terracotta">Pay your share.</span></h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate md:text-lg">Create a trip, share the link on WhatsApp, and meet people headed in the same direction.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="button-primary" onClick={() => setView("create")}><Plus className="mr-2 h-4 w-4" /> Create a trip</button>
                <button className="button-soft" onClick={() => document.getElementById("trip-board")?.scrollIntoView({ behavior: "smooth" })}><Search className="mr-2 h-4 w-4" /> Browse trips</button>
              </div>
              <div className="mt-8 flex items-center gap-3 text-xs font-semibold text-slate"><div className="avatar-stack"><span className="avatar">A</span><span className="avatar avatar-gold">K</span><span className="avatar avatar-green">E</span></div><span>Made for everyday Ghanaian journeys</span></div>
            </div>
            <div className="hero-visual">
              <div className="route-art route-art-one"><span className="route-dot" /><span className="route-dash" /><span className="route-dot route-dot-end" /><div className="route-label route-label-start">Accra</div><div className="route-label route-label-end">Kumasi</div></div>
              <div className="floating-note floating-note-top"><div className="note-icon"><Users className="h-4 w-4" /></div><div><div className="text-[11px] font-bold uppercase tracking-wider text-slate">Community trip</div><div className="mt-0.5 text-sm font-bold text-ink">3 people are going</div></div></div>
              <div className="floating-note floating-note-bottom"><div className="note-icon note-icon-green"><Check className="h-4 w-4" /></div><div><div className="text-[11px] font-bold uppercase tracking-wider text-slate">You could save</div><div className="mt-0.5 text-sm font-bold text-forest">GHS 180 on this ride</div></div></div>
              <div className="hero-sun" /><div className="hero-texture" />
            </div>
          </section>

          <section id="trip-board" className="mt-24 scroll-mt-20">
            <div className="section-heading"><div><div className="eyebrow">Open trips near you</div><h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em] md:text-4xl">Find your people.</h2></div><button className="button-soft hidden sm:inline-flex" onClick={() => setView("trips")}>View all <ArrowRight className="ml-2 h-4 w-4" /></button></div>
            <div className="mt-6 flex flex-col gap-3 md:flex-row"><div className="search-box"><Search className="h-4 w-4 text-slate" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search routes, e.g. Accra or Kumasi" /></div><button className="filter-button"><Navigation className="h-4 w-4" /> Near me <ChevronDown className="ml-auto h-4 w-4" /></button></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">{filteredTrips.map((trip) => <TripCard key={trip.id} trip={trip} onJoin={join} onShare={shareTrip} />)}</div>
            {filteredTrips.length === 0 && <div className="empty-state"><Search className="mx-auto h-7 w-7 text-terracotta" /><h3 className="mt-3 font-display text-xl font-bold">No trips yet</h3><p className="mt-1 text-sm text-slate">Be the first person to create this route.</p><button className="button-primary mt-4" onClick={() => setView("create")}>Create it</button></div>}
          </section>

          <section className="mt-24 grid gap-5 md:grid-cols-3">
            {[{ icon: Share2, title: "Share a link", copy: "Post your trip in any WhatsApp group. People join without the back-and-forth." }, { icon: MapPin, title: "Meet in public", copy: "The group agrees on one clear, safe pickup point before the ride." }, { icon: ShieldCheck, title: "Keep it simple", copy: "No driver app. No wallet. Just real people heading the same way." }].map(({ icon: Icon, title, copy }) => <div key={title} className="feature-card"><div className="feature-icon"><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate">{copy}</p></div>)}
          </section>
        </>}

        {view === "create" && <section className="mx-auto max-w-3xl py-4 md:py-10">
          <button className="back-link" onClick={() => { setView("home"); setCreatedTrip(null); }}>← Back to trips</button>
          {!createdTrip ? <>
            <div className="mt-7"><div className="eyebrow">Start a shared trip</div><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] md:text-6xl">Where are you<br /><span className="text-terracotta">heading?</span></h1><p className="mt-4 max-w-md text-base leading-7 text-slate">Create a trip in under a minute. Share the link, then choose a meeting point together.</p></div>
            <form onSubmit={createTrip} className="form-card mt-8">
              <div className="grid gap-4 md:grid-cols-2"><div><LocationInput label="From · your current location" value={form.from} locked={currentLocationLocked} onChange={(value) => { setCurrentLocationLocked(false); setForm({ ...form, from: value }); setSelectedLocations((locations) => ({ ...locations, from: undefined })); }} onSelect={(place) => { setCurrentLocationLocked(false); setForm({ ...form, from: place.name }); setSelectedLocations((locations) => ({ ...locations, from: place })); }} placeholder={locationLoading ? "Finding your location…" : "Your current location" } /><CurrentLocationButton loading={locationLoading} onClick={useCurrentLocation} />{currentLocationLocked && <button type="button" className="mt-2 text-[10px] font-semibold text-terracotta underline" onClick={() => setCurrentLocationLocked(false)}>Change starting point manually</button>}{locationMessage && <p className="mt-2 rounded-lg bg-[#eef7f0] px-3 py-2 text-[10px] font-semibold text-forest">{locationMessage}</p>}<p className="mt-1 text-[10px] text-slate">Your starting point is detected automatically. Tap the field only if you need to change it.</p></div><LocationInput label="Going to" value={form.to} onChange={(value) => { setForm({ ...form, to: value }); setSelectedLocations((locations) => ({ ...locations, to: undefined })); }} onSelect={(place) => { setForm({ ...form, to: place.name }); setSelectedLocations((locations) => ({ ...locations, to: place })); }} placeholder="e.g. KNUST or Kejetia" /></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="field-label">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="field-input" /></label><label className="field-label">Departure time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="field-input" /></label></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="field-label">How many seats? <span className="font-normal text-slate">(including you)</span><select value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} className="field-input"><option value="2">2 seats</option><option value="3">3 seats</option><option value="4">4 seats</option></select></label><label className="field-label">Target contribution <span className="font-normal text-slate">(GHS / person)</span><input type="number" min="0" value={form.contribution} onChange={(e) => setForm({ ...form, contribution: e.target.value })} placeholder="e.g. 35" className="field-input" /></label></div>
              <RouteMap from={form.from} to={form.to} fromLocation={selectedLocations.from} toLocation={selectedLocations.to} />
              <div className="mt-6 rounded-2xl bg-sand p-4 text-sm text-slate"><div className="flex items-center gap-2 font-semibold text-ink"><MessageCircle className="h-4 w-4 text-terracotta" /> You’ll get a shareable trip link</div><p className="mt-1 pl-6 text-xs leading-5">Share it on WhatsApp, Instagram or anywhere else. The official group stays inside LexRide.</p></div>
              <button type="submit" className="button-primary mt-6 w-full">Create my trip <ArrowRight className="ml-2 h-4 w-4" /></button>
            </form>
          </> : <div className="success-card mt-8"><div className="success-badge"><Check className="h-6 w-6" /></div><div className="eyebrow mt-5">Your trip is live</div><h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.05em]">Share it with<br /><span className="text-terracotta">your people.</span></h1><div className="mt-6 rounded-2xl bg-sand p-4"><RouteLine from={createdTrip.from} to={createdTrip.to} /><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate"><span>{createdTrip.date}</span><span>{createdTrip.time}</span><span>{createdTrip.seats} seats</span></div></div><div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm"><span className="min-w-0 flex-1 truncate font-medium text-slate">{window.location.origin}/?trip={createdTrip.id}</span><button className="icon-button !h-8 !w-8" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?trip=${createdTrip.id}`); toast.success("Waiting-room link copied"); }}><Copy className="h-4 w-4" /></button></div><div className="mt-5 rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><div><div className="eyebrow">Your in-app trip room</div><div className="mt-1 font-display text-lg font-bold text-ink">Keep the details here</div></div><span className="status-pill status-green">Live</span></div><div className="mt-3 flex items-center gap-2 text-xs text-slate"><div className="avatar">Y</div><span>You started this trip</span><span>·</span><span>{createdTrip.seats - 1} seats open</span></div><p className="mt-3 text-xs leading-5 text-slate">Share the invite anywhere. People join this room, see the route and vote on a meeting point—no temporary WhatsApp group required.</p></div><RouteMap from={createdTrip.from} to={createdTrip.to} /><button className="button-primary mt-4 w-full" onClick={() => shareTrip(createdTrip)}><Share2 className="mr-2 h-4 w-4" /> Copy WhatsApp invite</button><div className="mt-5 rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><div><div className="eyebrow">Waiting room</div><div className="mt-1 font-display text-lg font-bold text-ink">Approve passengers</div></div><span className="status-pill status-warm">{guestRequests.filter((request) => request.status === "Waiting").length} waiting</span></div>{guestRequests.filter((request) => request.status === "Waiting").length === 0 ? <p className="mt-3 text-xs leading-5 text-slate">Passengers who open your link will appear here with their name and sex. Approve them before they enter the trip chat.</p> : <div className="mt-3 space-y-2">{guestRequests.filter((request) => request.status === "Waiting").map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl bg-sand p-3"><div className="avatar">{request.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink">{request.name}</div><div className="text-xs text-slate">{request.sex}</div></div><button className="button-primary !px-3 !py-2 text-xs" onClick={() => approveGuest(request)}>Accept</button><button className="button-soft !px-3 !py-2 text-xs" onClick={() => declineGuest(request)}>Decline</button></div>)}</div>}</div><div className="mt-5 rounded-2xl border border-line bg-white p-4"><div className="eyebrow">In-app group chat</div><div className="mt-1 font-display text-lg font-bold text-ink">Coordinate here</div><div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-sand p-3">{chatMessages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.mine ? "bg-ink text-white" : "bg-white text-ink"}`}><div className="mb-0.5 text-[10px] font-bold opacity-60">{message.sender}</div>{message.text}</div></div>)}</div><div className="mt-3 flex gap-2"><input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }} className="field-input" placeholder="Message the trip group…" /><button type="button" onClick={sendChatMessage} className="button-primary !px-3"><Send className="h-4 w-4" /></button></div></div><button className="button-soft mt-3 w-full" onClick={() => { setShowSheet(createdTrip); }}>Choose meeting point</button><button className="back-link mx-auto mt-6" onClick={() => setView("trips")}>View my trip</button></div>}
        </section>}

        {view === "trips" && <section className="py-4 md:py-10"><div className="eyebrow">Your trip board</div><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] md:text-6xl">Trips you’ve<br /><span className="text-terracotta">started.</span></h1><p className="mt-4 max-w-md text-base leading-7 text-slate">Your created trips and the ones you’ve joined will live here in the full version.</p><div className="mt-8 grid max-w-3xl gap-4">{trips.filter((trip) => trip.host === "You").map((trip) => <div key={trip.id} className="trip-card"><div className="flex items-center justify-between"><RouteLine from={trip.from} to={trip.to} /><span className="status-pill status-green">{trip.joined}/{trip.seats} joined</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate"><span>{trip.date} · {trip.time}</span><button className="button-soft !px-3 !py-2 text-xs" onClick={() => setShowSheet(trip)}><MapPin className="mr-1.5 h-3.5 w-3.5" /> {trip.meetingPoint}</button></div></div>)}{trips.filter((trip) => trip.host === "You").length === 0 && <div className="empty-state"><h3 className="font-display text-xl font-bold">No trips started yet</h3><button className="button-primary mt-4" onClick={() => setView("create")}>Create a trip</button></div>}</div></section>}
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-line px-5 py-7 text-xs text-slate sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-2"><div className="brand-mark brand-mark-small"><span>L</span></div><span className="font-semibold text-ink">LexRide</span><span>·</span><span>V1 passenger prototype</span></div><span>Built for simpler journeys across Ghana</span></footer>

      {showSheet && <MeetingPointSheet trip={showSheet} onClose={() => setShowSheet(null)} onConfirm={confirmMeetingPoint} />}
      {joinTrip && <div className="sheet-backdrop" onMouseDown={() => setJoinTrip(null)}><div className="sheet-panel" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">{joinStage === "form" ? "Waiting room" : joinStage === "waiting" ? "Request sent" : "Trip room"}</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{joinStage === "form" ? "Request to join" : joinStage === "waiting" ? "Waiting for approval" : "You’re approved"}</h3></div><button className="icon-button" onClick={() => setJoinTrip(null)} aria-label="Close"><X className="h-4 w-4" /></button></div><div className="mt-5 rounded-2xl bg-sand p-4"><RouteLine from={joinTrip.from} to={joinTrip.to} /><div className="mt-3 text-sm text-slate">{joinTrip.date} · {joinTrip.time}</div><div className="mt-1 font-display text-xl font-bold text-ink">About GHS {joinTrip.contribution} / person</div></div>{joinStage === "form" && <><p className="mt-5 text-sm leading-6 text-slate">Enter your details. The person who created this trip must approve you before you can see the group chat.</p><label className="field-label mt-4">Your name<input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="field-input" placeholder="e.g. Yaw Mensah" /></label><fieldset className="mt-4"><legend className="field-label">Confirm your sex</legend><div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => setGuestSex("Male")} className={`button-soft justify-center ${guestSex === "Male" ? "!border-terracotta !bg-[#fff1eb]" : ""}`}>Male</button><button type="button" onClick={() => setGuestSex("Female")} className={`button-soft justify-center ${guestSex === "Female" ? "!border-terracotta !bg-[#fff1eb]" : ""}`}>Female</button></div></fieldset><div className="mt-4 flex items-start gap-3 rounded-xl bg-[#e6f0ea] p-3 text-xs leading-5 text-slate"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" /><span>Your details are shown to the trip creator for approval. Meet in public.</span></div><button className="button-primary mt-5 w-full" onClick={submitJoinRequest}>Send join request <ArrowRight className="ml-2 h-4 w-4" /></button></>}{joinStage === "waiting" && <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1eb] text-terracotta"><Clock3 className="h-6 w-6" /></div><h4 className="mt-4 font-display text-xl font-bold text-ink">You’re in the waiting room</h4><p className="mt-2 text-sm leading-6 text-slate">Your name and sex were sent to the trip creator. The chat opens after they accept you.</p><span className="status-pill status-warm mt-4">Waiting for approval</span></div>}{joinStage === "room" && <div className="mt-5"><div className="rounded-xl bg-[#e6f0ea] p-3 text-sm text-slate"><strong className="text-ink">You’re approved.</strong> You can now coordinate with the group.</div><div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-line bg-white p-3">{chatMessages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.mine ? "bg-ink text-white" : "bg-sand text-ink"}`}><div className="mb-0.5 text-[10px] font-bold opacity-60">{message.sender}</div>{message.text}</div></div>)}</div><div className="mt-3 flex gap-2"><input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }} className="field-input" placeholder="Write to the trip group…" /><button type="button" onClick={sendChatMessage} className="button-primary !px-3"><Send className="h-4 w-4" /></button></div></div>}</div></div>}
    </div>
  );
}
