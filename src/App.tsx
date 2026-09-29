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
  UserRound,
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
  hostSex?: "Male" | "Female";
  status: "Open" | "Almost full" | "Full";
};

type GuestRequest = { id: string; name: string; sex: "Male" | "Female"; status: "Waiting" | "Approved" | "Declined" };
type ChatMessage = { id: string; sender: string; text: string; mine?: boolean };
type Account = { id: string; fullName: string; sex: "Male" | "Female" };
type HistoryTrip = Trip & { role: "created" | "joined"; requestStatus?: "Waiting" | "Approved" | "Declined" };
type CommuteGroup = { id: string; name: string; from_label: string; to_label: string; usual_time: string; days: string[]; seats: number };

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
    hostSex: "Female",
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
    hostSex: "Male",
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
    hostSex: "Female",
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

function encodeTripForLink(trip: Trip): string {
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(trip)))));
}

function decodeTripFromLink(value: string): Trip | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(value))))) as Trip;
  } catch {
    return null;
  }
}

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
  const [form, setForm] = useState({ from: "", to: "", date: "", time: "", seats: "3", contribution: "", hostSex: "" as "Male" | "Female" | "" });
  const [selectedLocations, setSelectedLocations] = useState<{ from?: LocationSuggestion; to?: LocationSuggestion }>({});
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [currentLocationLocked, setCurrentLocationLocked] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authSex, setAuthSex] = useState<"Male" | "Female" | "">("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<Trip | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [historyTrips, setHistoryTrips] = useState<HistoryTrip[]>([]);
  const [commuteGroups, setCommuteGroups] = useState<CommuteGroup[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupFrom, setGroupFrom] = useState("");
  const [groupTo, setGroupTo] = useState("");
  const [groupTime, setGroupTime] = useState("07:00");
  const [groupSeats, setGroupSeats] = useState("3");
  const [groupBusy, setGroupBusy] = useState(false);

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return trips;
    return trips.filter((trip) => `${trip.from} ${trip.to} ${trip.meetingPoint}`.toLowerCase().includes(query));
  }, [search, trips]);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.account) setAccount(data.account); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!account) { setHistoryTrips([]); setCommuteGroups([]); return; }
    Promise.all([fetch("/api/account/trips").then((response) => response.ok ? response.json() : { trips: [] }), fetch("/api/account/groups").then((response) => response.ok ? response.json() : { groups: [] })]).then(([tripData, groupData]) => {
      setHistoryTrips((tripData.trips || []).map((trip: any) => ({ ...trip, joined: 1, contribution: 0, meetingPoint: "Choose together", status: "Open", requestStatus: trip.requestStatus })));
      setCommuteGroups(groupData.groups || []);
    }).catch(() => undefined);
    const groupId = new URLSearchParams(window.location.search).get("group");
    if (groupId) fetch(`/api/account/groups/${encodeURIComponent(groupId)}/join`, { method: "POST" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.group) toast.success("You joined the regular commute group", { description: `${data.group.from_label} → ${data.group.to_label}` }); }).catch(() => undefined);
  }, [account]);

  const openAuth = (mode: "signin" | "signup", nextTrip?: Trip | null) => {
    setAuthMode(mode);
    setPendingJoin(nextTrip || null);
    setShowAuth(true);
    setAuthPassword("");
    if (nextTrip) setJoinTrip(null);
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!authName.trim() || !authPassword || (authMode === "signup" && !authSex)) { toast.error(authMode === "signup" ? "Enter your name, sex, and password" : "Enter your name and password"); return; }
    setAuthBusy(true);
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: authName.trim(), sex: authSex, password: authPassword }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!raw && !response.ok) throw new Error(`Account request failed (${response.status})`);
      if (!response.ok) throw new Error(data.error || "Authentication failed");
      setAccount(data.account);
      setAuthName(""); setAuthSex(""); setAuthPassword(""); setShowAuth(false);
      if (pendingJoin) { setJoinTrip(pendingJoin); setJoinStage("form"); setGuestName(data.account.fullName); setGuestSex(data.account.sex); setPendingJoin(null); }
      toast.success(authMode === "signup" ? "Account created" : "Signed in", { description: `Welcome, ${data.account.fullName}.` });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign in"); }
    finally { setAuthBusy(false); }
  };

  const signOut = async () => { await fetch("/api/auth/signout", { method: "POST" }); setAccount(null); toast.info("You are signed out"); };
  const createCommuteGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!groupName.trim() || !groupFrom.trim() || !groupTo.trim() || !groupTime) { toast.error("Add a group name, route, and usual time"); return; }
    setGroupBusy(true);
    try {
      const response = await fetch("/api/account/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName.trim(), fromLabel: groupFrom.trim(), toLabel: groupTo.trim(), usualTime: groupTime, seats: Number(groupSeats) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create commute group");
      setCommuteGroups((groups) => [data.group, ...groups]); setGroupName(""); setGroupFrom(""); setGroupTo(""); toast.success("Regular commute group created");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create commute group"); }
    finally { setGroupBusy(false); }
  };
  const startCommuteGroup = async (group: CommuteGroup) => {
    try {
      const response = await fetch(`/api/account/groups/${group.id}/start`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start today’s trip");
      toast.success("Today’s trip is ready", { description: `${group.from_label} → ${group.to_label}` });
      setView("home");
      const trip = data.trip ? { id: data.trip.id, from: data.trip.fromLabel, to: data.trip.toLabel, date: data.trip.date || "Today", time: data.trip.time, seats: data.trip.seats, joined: 1, contribution: 0, meetingPoint: "Choose together", host: account?.fullName || "You", hostSex: account?.sex, status: "Open" as const } : null;
      if (trip) { setTrips((items) => [trip, ...items]); setCreatedTrip(trip); setView("create"); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start today’s trip"); }
  };
  const shareCommuteGroup = (group: CommuteGroup) => {
    const link = `${window.location.origin}/?group=${encodeURIComponent(group.id)}`;
    navigator.clipboard?.writeText(`Join my LexRide regular commute group: ${group.name} (${group.from_label} → ${group.to_label}). Join here: ${link}`);
    toast.success("Group invite copied", { description: "Send it to the people you regularly travel with." });
  };
  const openHistoryTrip = async (historyTrip: HistoryTrip) => {
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(historyTrip.id)}`);
      const ride = await response.json();
      if (!response.ok) throw new Error(ride.error || "Could not load this trip");
      const restored: Trip = { id: ride.id, from: ride.fromLabel, to: ride.toLabel, date: ride.date || historyTrip.date, time: ride.time, seats: Number(ride.seats) || historyTrip.seats, joined: ride.joined?.filter((member: any) => member.status !== "Declined").length + 1 || 1, contribution: historyTrip.contribution || 0, meetingPoint: historyTrip.meetingPoint || "Choose together", host: ride.creatorName || historyTrip.host, hostSex: ride.creatorSex || historyTrip.hostSex, status: "Open" };
      setCreatedTrip(restored);
      setJoinTrip(null);
      setGuestRequests((ride.joined || []).filter((member: any) => member.status === "Waiting").map((member: any) => ({ id: member.id, name: member.firstName, sex: member.sex, status: member.status })));
      setChatMessages((ride.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, mine: false })));
      setView("create");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load this trip"); }
  };

  const shareTrip = (trip: Trip) => {
    const joinLink = `${window.location.origin}/?trip=${encodeURIComponent(trip.id)}&data=${encodeTripForLink(trip)}`;
    const text = `Join my LexRide trip: ${trip.from} → ${trip.to}, ${trip.date} at ${trip.time}. Host: ${trip.host} (${trip.hostSex || "sex not provided"}). ${trip.seats - trip.joined} seat(s) left. Join here: ${joinLink}`;
    navigator.clipboard?.writeText(text);
    toast.success("Trip message copied", { description: "Paste it into WhatsApp to invite people." });
  };

  const join = (trip: Trip) => {
    if (!account) { openAuth("signin", trip); return; }
    setJoinTrip(trip);
    setJoinStage("form");
    setGuestName(account.fullName);
    setGuestSex(account.sex);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("trip");
    if (!tripId) return;
    const localTrip = trips.find((item) => item.id === tripId);
    if (localTrip) { join(localTrip); return; }
    const linkedTrip = params.get("data") ? decodeTripFromLink(params.get("data") as string) : null;
    if (linkedTrip && linkedTrip.id === tripId) {
      setTrips((items) => items.some((item) => item.id === linkedTrip.id) ? items : [linkedTrip, ...items]);
      join(linkedTrip);
      return;
    }
    let cancelled = false;
    fetch(`/api/rides/${encodeURIComponent(tripId)}`).then((response) => response.ok ? response.json() : null).then((ride) => {
      if (cancelled || !ride) return;
      const sharedTrip: Trip = { id: ride.id, from: ride.fromLabel, to: ride.toLabel, date: ride.date || "Shared trip", time: ride.time, seats: Number(ride.seats) || 3, joined: ride.joined?.filter((member: any) => member.status !== "Declined").length + 1 || 1, contribution: 0, meetingPoint: "Choose together", host: ride.creatorName || "Trip creator", hostSex: ride.creatorSex, status: "Open" };
      setTrips((items) => items.some((item) => item.id === sharedTrip.id) ? items : [sharedTrip, ...items]);
      join(sharedTrip);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const submitJoinRequest = async () => {
    if (!joinTrip || !guestName.trim() || !guestSex) { toast.error("Enter your name and confirm Male or Female first"); return; }
    try {
      const response = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: joinTrip.id, firstName: guestName.trim(), sex: guestSex }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || `Join request failed (${response.status})`);
      const ride = data;
      const latest = ride.joined?.find((member: any) => member.firstName === guestName.trim() && member.status === "Waiting");
      setGuestRequests((items) => [...items, { id: latest?.id || `guest-${Date.now()}`, name: guestName.trim(), sex: guestSex, status: "Waiting" }]);
      setJoinStage("waiting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not send your join request. Please try again.");
    }
  };

  const approveGuest = async (request: GuestRequest) => {
    if (!createdTrip) return;
    try {
      const response = await fetch("/api/member-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: createdTrip.id, memberId: request.id, status: "Approved" }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || "Could not approve passenger");
      setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Approved" } : item));
      setTrips((items) => items.map((item) => item.id === createdTrip.id ? { ...item, joined: Math.min(item.seats, item.joined + 1), status: item.joined + 1 >= item.seats ? "Full" : "Almost full" } : item));
      toast.success(`${request.name} approved`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not approve passenger"); }
  };

  const declineGuest = async (request: GuestRequest) => {
    if (!createdTrip) return;
    try {
      const response = await fetch("/api/member-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: createdTrip.id, memberId: request.id, status: "Declined" }) });
      if (!response.ok) throw new Error("Could not decline passenger");
      setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Declined" } : item));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not decline passenger"); }
  };

  const sendChatMessage = async () => {
    const text = chatDraft.trim();
    const activeTrip = joinTrip || createdTrip;
    if (!text || !activeTrip) return;
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(activeTrip.id)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sender: "You", senderSex: guestSex || createdTrip?.hostSex, text }) });
      if (!response.ok) throw new Error("Message failed");
      const ride = await response.json();
      setChatMessages((ride.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, mine: message.sender === "You" })));
      setChatDraft("");
    } catch {
      toast.error("We could not send that message. Please try again.");
    }
  };

  const createTrip = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) { openAuth("signin"); return; }
    if (!form.from || !form.to || !form.date || !form.time) {
      toast.error("Add your route and departure time first");
      return;
    }
    if (!selectedLocations.from || !selectedLocations.to) {
      toast.error("Choose your current location or select both places from the map suggestions");
      return;
    }
    try {
      const response = await fetch("/api/create-ride", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromLabel: form.from, toLabel: form.to, toLat: selectedLocations.to.geometry.location.lat, toLng: selectedLocations.to.geometry.location.lng, time: form.time, date: form.date, seats: Number(form.seats), platform: "Passenger arranged" }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || `Could not create trip (${response.status})`);
      const sharedRide = data;
      const sharedId = sharedRide.id;
      if (!sharedId) throw new Error("Trip was not saved");
      const trip: Trip = {
        id: sharedId,
        from: sharedRide.fromLabel || form.from,
        to: sharedRide.toLabel || form.to,
        date: sharedRide.date ? new Date(sharedRide.date).toLocaleDateString("en-GH", { weekday: "short", day: "2-digit", month: "short" }) : new Date(form.date).toLocaleDateString("en-GH", { weekday: "short", day: "2-digit", month: "short" }),
        time: sharedRide.time || form.time,
        seats: Number(sharedRide.seats) || Number(form.seats),
        joined: 1,
        contribution: Number(form.contribution) || 0,
        meetingPoint: "Choose together",
        host: account.fullName,
        hostSex: account.sex,
        status: "Open",
      };
      setTrips((items) => [trip, ...items]);
      setCreatedTrip(trip);
      setHistoryTrips((items) => [{ ...trip, role: "created" as const }, ...items.filter((item) => item.id !== trip.id)]);
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create trip");
      return;
    }
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
          <div className="hidden items-center gap-2 md:flex">{account ? <button className="button-soft !gap-2 !px-3 !py-2" onClick={() => setShowProfile(true)}><span className="avatar !h-7 !w-7 !bg-[#182321] !text-[11px] !text-white">{account.fullName.slice(0, 1).toUpperCase()}</span><span className="text-xs font-bold text-ink">{account.fullName}</span></button> : <><button className="button-soft !px-3 !py-2 text-sm" onClick={() => openAuth("signin")}>Sign in</button><button className="button-dark !rounded-xl !px-4 !py-2.5 text-sm" onClick={() => openAuth("signup")}>Create account</button></>}<button className="button-dark !rounded-xl !px-4 !py-2.5 text-sm" onClick={() => { if (!account) { openAuth("signin"); return; } setView("create"); setCreatedTrip(null); }}><Plus className="mr-1.5 h-4 w-4" /> Create a trip</button></div>
          <div className="flex items-center gap-2 md:hidden">{account && <button className="icon-button !h-10 !w-10 !rounded-full !border-ink !bg-[#182321] !text-white" onClick={() => setShowProfile(true)} aria-label="Open profile"><span className="text-sm font-bold">{account.fullName.slice(0, 1).toUpperCase()}</span></button>}<button className="icon-button" onClick={() => { if (!account) { openAuth("signin"); return; } setView(view === "create" ? "home" : "create"); }} aria-label={account ? "Create trip" : "Sign in to create a trip"}><Plus className="h-5 w-5" /></button></div>
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
          </> : <div className="success-card mt-8"><div className="success-badge"><Check className="h-6 w-6" /></div><div className="eyebrow mt-5">Your trip is live</div><h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.05em]">Share it with<br /><span className="text-terracotta">your people.</span></h1><div className="mt-6 rounded-2xl bg-sand p-4"><RouteLine from={createdTrip.from} to={createdTrip.to} /><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate"><span>{createdTrip.date}</span><span>{createdTrip.time}</span><span>{createdTrip.seats} seats</span><span>Host: {createdTrip.host} ({createdTrip.hostSex})</span></div></div><div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm"><span className="min-w-0 flex-1 truncate font-medium text-slate">{window.location.origin}/?trip={createdTrip.id}&data={encodeTripForLink(createdTrip)}</span><button className="icon-button !h-8 !w-8" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?trip=${createdTrip.id}&data=${encodeTripForLink(createdTrip)}`); toast.success("Waiting-room link copied"); }}><Copy className="h-4 w-4" /></button></div><div className="mt-5 rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><div><div className="eyebrow">Your in-app trip room</div><div className="mt-1 font-display text-lg font-bold text-ink">Keep the details here</div></div><span className="status-pill status-green">Live</span></div><div className="mt-3 flex items-center gap-2 text-xs text-slate"><div className="avatar">Y</div><span>You started this trip · {createdTrip.hostSex}</span><span>·</span><span>{createdTrip.seats - 1} seats open</span></div><p className="mt-3 text-xs leading-5 text-slate">Share the invite anywhere. People join this room, see the route and vote on a meeting point—no temporary WhatsApp group required.</p></div><RouteMap from={createdTrip.from} to={createdTrip.to} /><button className="button-primary mt-4 w-full" onClick={() => shareTrip(createdTrip)}><Share2 className="mr-2 h-4 w-4" /> Copy WhatsApp invite</button><div className="mt-5 rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><div><div className="eyebrow">Waiting room</div><div className="mt-1 font-display text-lg font-bold text-ink">Approve passengers</div></div><span className="status-pill status-warm">{guestRequests.filter((request) => request.status === "Waiting").length} waiting</span></div>{guestRequests.filter((request) => request.status === "Waiting").length === 0 ? <p className="mt-3 text-xs leading-5 text-slate">Passengers who open your link will appear here with their name and sex. Approve them before they enter the trip chat.</p> : <div className="mt-3 space-y-2">{guestRequests.filter((request) => request.status === "Waiting").map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl bg-sand p-3"><div className="avatar">{request.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink">{request.name} <span className="font-normal text-slate">({request.sex})</span></div></div><button className="button-primary !px-3 !py-2 text-xs" onClick={() => approveGuest(request)}>Accept</button><button className="button-soft !px-3 !py-2 text-xs" onClick={() => declineGuest(request)}>Decline</button></div>)}</div>}</div><div className="mt-5 rounded-2xl border border-line bg-white p-4"><div className="eyebrow">In-app group chat</div><div className="mt-1 font-display text-lg font-bold text-ink">Coordinate here</div><div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-sand p-3">{chatMessages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.mine ? "bg-ink text-white" : "bg-white text-ink"}`}><div className="mb-0.5 text-[10px] font-bold opacity-60">{message.sender}</div>{message.text}</div></div>)}</div><div className="mt-3 flex gap-2"><input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }} className="field-input" placeholder="Message the trip group…" /><button type="button" onClick={sendChatMessage} className="button-primary !px-3"><Send className="h-4 w-4" /></button></div></div><button className="button-soft mt-3 w-full" onClick={() => { setShowSheet(createdTrip); }}>Choose meeting point</button><button className="back-link mx-auto mt-6" onClick={() => setView("trips")}>View my trip</button></div>}
        </section>}

        {view === "trips" && <section className="py-4 md:py-10"><div className="eyebrow">Your LexRide space</div><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] md:text-6xl">Your trips.<br /><span className="text-terracotta">Your usual people.</span></h1><p className="mt-4 max-w-xl text-base leading-7 text-slate">See your trip history and keep a regular commute group ready for the journeys you make every day.</p>{!account ? <div className="empty-state mt-8 max-w-2xl"><h3 className="font-display text-xl font-bold">Sign in to see your trips</h3><button className="button-primary mt-4" onClick={() => openAuth("signin")}>Sign in</button></div> : <><div className="mt-8"><div className="section-heading"><div><div className="eyebrow">Trip history</div><h2 className="mt-2 font-display text-2xl font-bold">Your past and upcoming trips</h2></div><span className="status-pill status-green">{historyTrips.length} saved</span></div><div className="mt-4 grid max-w-3xl gap-3">{historyTrips.map((trip) => <div key={trip.id} className="trip-card"><div className="flex items-start justify-between gap-3"><div><RouteLine from={trip.from} to={trip.to} /><div className="mt-3 text-xs text-slate">{trip.date} · {trip.time} · {trip.role === "created" ? "You started this" : "You joined this"}</div></div><span className={`status-pill ${trip.role === "created" || trip.requestStatus === "Approved" ? "status-green" : trip.requestStatus === "Declined" ? "status-full" : "status-warm"}`}>{trip.role === "created" ? "Created" : trip.requestStatus === "Approved" ? "Approved" : trip.requestStatus === "Declined" ? "Declined" : "Waiting"}</span></div><div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate">Host: <strong className="text-ink">{trip.host}</strong></span>{trip.role === "created" || trip.requestStatus !== "Declined" ? <button className="button-soft !px-3 !py-2 text-xs" onClick={() => trip.role === "created" ? openHistoryTrip(trip) : join(trip)}>Open trip</button> : <span className="text-xs font-semibold text-slate">Request closed</span>}</div></div>)}{historyTrips.length === 0 && <div className="empty-state"><h3 className="font-display text-xl font-bold">No trips yet</h3><p className="mt-1 text-sm text-slate">Create a trip or join someone going your way.</p><button className="button-primary mt-4" onClick={() => setView("create")}>Create a trip</button></div>}</div></div><div className="mt-12 max-w-3xl"><div className="section-heading"><div><div className="eyebrow">Sent requests</div><h2 className="mt-2 font-display text-2xl font-bold">Requests you have sent</h2></div><span className="status-pill status-warm">{historyTrips.filter((trip) => trip.role === "joined").length} sent</span></div><p className="mt-3 text-sm leading-6 text-slate">Your join requests stay here after you leave the waiting room. Check whether the trip creator is still reviewing you or has approved you.</p><div className="mt-4 grid gap-3">{historyTrips.filter((trip) => trip.role === "joined").map((trip) => <div key={`request-${trip.id}`} className="trip-card"><div className="flex items-start justify-between gap-3"><div><RouteLine from={trip.from} to={trip.to} /><div className="mt-3 text-xs text-slate">{trip.date} · {trip.time} · Host: {trip.host}</div></div><span className={`status-pill ${trip.requestStatus === "Approved" ? "status-green" : trip.requestStatus === "Declined" ? "status-full" : "status-warm"}`}>{trip.requestStatus || "Waiting"}</span></div>{trip.requestStatus !== "Declined" && <button className="button-soft mt-4 w-full justify-center !px-3 !py-2 text-xs" onClick={() => join(trip)}>{trip.requestStatus === "Approved" ? "Open trip room" : "Open waiting room"}</button>}</div>)}</div></div><div className="mt-12 max-w-3xl"><div className="section-heading"><div><div className="eyebrow">Regular commute groups</div><h2 className="mt-2 font-display text-2xl font-bold">Stop searching every morning.</h2></div><span className="status-pill status-warm">Invite-only</span></div><p className="mt-3 text-sm leading-6 text-slate">Save a route for the people you regularly travel with. Start a fresh trip room each day, so every day has its own approvals, meeting point, and chat.</p><form onSubmit={createCommuteGroup} className="form-card mt-5"><div className="grid gap-4 md:grid-cols-2"><label className="field-label">Group name<input className="field-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ayeduase → KNUST crew" /></label><label className="field-label">Usual time<input type="time" className="field-input" value={groupTime} onChange={(e) => setGroupTime(e.target.value)} /></label><label className="field-label">From<input className="field-input" value={groupFrom} onChange={(e) => setGroupFrom(e.target.value)} placeholder="Ayeduase" /></label><label className="field-label">To<input className="field-input" value={groupTo} onChange={(e) => setGroupTo(e.target.value)} placeholder="KNUST" /></label></div><label className="field-label mt-4">Seats including you<select className="field-input" value={groupSeats} onChange={(e) => setGroupSeats(e.target.value)}><option value="2">2 seats</option><option value="3">3 seats</option><option value="4">4 seats</option><option value="5">5 seats</option><option value="6">6 seats</option></select></label><button className="button-primary mt-5 w-full" disabled={groupBusy}>{groupBusy ? "Saving…" : "Create regular group"}</button></form><div className="mt-5 grid gap-3">{commuteGroups.map((group) => <div key={group.id} className="trip-card"><div className="flex items-start justify-between gap-3"><div><div className="eyebrow">{group.name}</div><div className="mt-2 font-display text-xl font-bold text-ink">{group.from_label} → {group.to_label}</div><div className="mt-1 text-xs text-slate">Usually {group.usual_time} · {group.seats} seats · {group.days?.slice(0, 5).join(", ")}</div></div><span className="status-pill status-green">Saved</span></div><div className="mt-4 grid grid-cols-2 gap-2"><button className="button-soft !px-3 !py-2 text-xs" onClick={() => shareCommuteGroup(group)}>Copy invite</button><button className="button-primary !px-3 !py-2 text-xs" onClick={() => startCommuteGroup(group)}>Start today’s trip</button></div></div>)}</div></div></>}</section>}
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-line px-5 py-7 text-xs text-slate sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="flex items-center gap-2"><div className="brand-mark brand-mark-small"><span>L</span></div><span className="font-semibold text-ink">LexRide</span><span>·</span><span>V1 passenger prototype</span></div><span>Built for simpler journeys across Ghana</span></footer>

      {showSheet && <MeetingPointSheet trip={showSheet} onClose={() => setShowSheet(null)} onConfirm={confirmMeetingPoint} />}
      {showProfile && account && <div className="sheet-backdrop" onMouseDown={() => setShowProfile(false)}><div className="sheet-panel max-w-md" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">Your LexRide profile</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{account.fullName}</h3></div><button className="icon-button" onClick={() => setShowProfile(false)} aria-label="Close profile"><X className="h-4 w-4" /></button></div><div className="mt-6 flex items-center gap-4 rounded-2xl bg-sand p-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-xl font-bold text-white">{account.fullName.slice(0, 1).toUpperCase()}</div><div><div className="text-sm font-bold text-ink">{account.sex}</div><div className="mt-1 text-xs text-slate">Your name and sex are shown in shared trips.</div></div></div><button className="button-primary mt-5 w-full justify-center" onClick={() => { setShowProfile(false); setView("trips"); }}><CalendarDays className="mr-2 h-4 w-4" /> Your trips</button><button className="button-soft mt-3 w-full justify-center" onClick={() => { setShowProfile(false); signOut(); }}><UserRound className="mr-2 h-4 w-4" /> Sign out</button></div></div>}
      {showAuth && <div className="sheet-backdrop" onMouseDown={() => !authBusy && setShowAuth(false)}><div className="sheet-panel max-w-md" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">LexRide account</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{authMode === "signup" ? "Create your account" : "Welcome back"}</h3></div><button className="icon-button" onClick={() => setShowAuth(false)} aria-label="Close"><X className="h-4 w-4" /></button></div><p className="mt-3 text-sm leading-6 text-slate">Use your name, sex, and a password. No OTP or email required.</p><form onSubmit={submitAuth} className="mt-5 space-y-4"><label className="field-label">Full name<input className="field-input" value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="e.g. Yaw Mensah" autoComplete="name" /></label>{authMode === "signup" && <fieldset><legend className="field-label">Your sex <span className="font-normal text-slate">(visible in trips)</span></legend><div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => setAuthSex("Male")} className={`button-soft justify-center ${authSex === "Male" ? "!border-terracotta !bg-[#fff1eb]" : ""}`}>Male</button><button type="button" onClick={() => setAuthSex("Female")} className={`button-soft justify-center ${authSex === "Female" ? "!border-terracotta !bg-[#fff1eb]" : ""}`}>Female</button></div></fieldset>}<label className="field-label">Password<input type="password" className="field-input" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={authMode === "signup" ? "new-password" : "current-password"} /></label><button className="button-primary w-full" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}</button></form><button className="back-link mx-auto mt-5" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>{authMode === "signup" ? "Already have an account? Sign in" : "New to LexRide? Create an account"}</button><p className="mt-4 text-center text-[11px] leading-5 text-slate">Remember your password: without an email or phone number, LexRide cannot reset it yet.</p></div></div>}
      {joinTrip && <div className="sheet-backdrop" onMouseDown={() => setJoinTrip(null)}><div className="sheet-panel" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">{joinStage === "form" ? "Waiting room" : joinStage === "waiting" ? "Request sent" : "Trip room"}</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{joinStage === "form" ? "Request to join" : joinStage === "waiting" ? "Waiting for approval" : "You’re approved"}</h3></div><button className="icon-button" onClick={() => setJoinTrip(null)} aria-label="Close"><X className="h-4 w-4" /></button></div><div className="mt-5 rounded-2xl bg-sand p-4"><RouteLine from={joinTrip.from} to={joinTrip.to} /><div className="mt-2 text-xs font-semibold text-slate">Host: {joinTrip.host} ({joinTrip.hostSex || "sex not provided"})</div><div className="mt-3 text-sm text-slate">{joinTrip.date} · {joinTrip.time}</div><div className="mt-1 font-display text-xl font-bold text-ink">About GHS {joinTrip.contribution} / person</div></div>{joinStage === "form" && <><p className="mt-5 text-sm leading-6 text-slate">Enter your details. The person who created this trip must approve you before you can see the group chat.</p><div className="mt-4 rounded-xl bg-sand p-3 text-sm text-slate"><div className="font-semibold text-ink">{account?.fullName}</div><div className="mt-1 text-xs">{account?.sex} · This is visible to the trip group</div></div><div className="mt-4 flex items-start gap-3 rounded-xl bg-[#e6f0ea] p-3 text-xs leading-5 text-slate"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" /><span>Your details are shown to the trip creator for approval. Meet in public.</span></div><button className="button-primary mt-5 w-full" onClick={submitJoinRequest}>Send join request <ArrowRight className="ml-2 h-4 w-4" /></button></>}{joinStage === "waiting" && <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1eb] text-terracotta"><Clock3 className="h-6 w-6" /></div><h4 className="mt-4 font-display text-xl font-bold text-ink">You’re in the waiting room</h4><p className="mt-2 text-sm leading-6 text-slate">Your name and sex were sent to the trip creator. The chat opens after they accept you.</p><span className="status-pill status-warm mt-4">Waiting for approval</span></div>}{joinStage === "room" && <div className="mt-5"><div className="rounded-xl bg-[#e6f0ea] p-3 text-sm text-slate"><strong className="text-ink">You’re approved.</strong> You can now coordinate with the group.</div><div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-line bg-white p-3">{chatMessages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.mine ? "bg-ink text-white" : "bg-sand text-ink"}`}><div className="mb-0.5 text-[10px] font-bold opacity-60">{message.sender}</div>{message.text}</div></div>)}</div><div className="mt-3 flex gap-2"><input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }} className="field-input" placeholder="Write to the trip group…" /><button type="button" onClick={sendChatMessage} className="button-primary !px-3"><Send className="h-4 w-4" /></button></div></div>}</div></div>}
    </div>
  );
}
