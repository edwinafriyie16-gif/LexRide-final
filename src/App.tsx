import { useEffect, useMemo, useRef, useState, type FormEvent, type Key } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Copy,
  EllipsisVertical,
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

type TripLifecycleStatus = "Open" | "Finished" | "Cancelled";

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
  lifecycleStatus?: TripLifecycleStatus;
};

type GuestRequest = { id: string; name: string; sex: "Male" | "Female"; status: "Waiting" | "Approved" | "Declined" };
type HostPendingRequest = GuestRequest & { tripId: string; from: string; to: string; date: string; time: string };
type ChatMessage = { id: string; sender: string; text: string; createdAt?: number; mine?: boolean };
type Account = { id: string; fullName: string; sex: "Male" | "Female" };
type InboxMessage = { id: string; sender: string; text: string; createdAt: number };
type InboxConversation = { id: string; from: string; to: string; date: string; time: string; seats: number; host: string; hostSex?: "Male" | "Female"; role: "created" | "joined"; lifecycleStatus: TripLifecycleStatus; messages: InboxMessage[]; lastActivity: number };
type MessageBanner = { id: number; tripId: string; route: string; sender: string; text: string; extra: number };
function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}
type HistoryTrip = Trip & { role: "created" | "joined"; requestStatus?: "Waiting" | "Approved" | "Declined" | "Closed" };
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

type ToastItem = { id: number; kind: "success" | "info" | "error"; message: string; description?: string };
let toastItems: ToastItem[] = [];
const toastListeners = new Set<() => void>();
function pushToast(kind: ToastItem["kind"], message: string, options?: { description?: string }) {
  const id = Date.now() + Math.random();
  toastItems = [...toastItems, { id, kind, message, description: options?.description }].slice(-3);
  toastListeners.forEach((listener) => listener());
  window.setTimeout(() => { toastItems = toastItems.filter((item) => item.id !== id); toastListeners.forEach((listener) => listener()); }, kind === "error" ? 5000 : 2800);
}
const toast = {
  success: (message: string, options?: { description?: string }) => pushToast("success", message, options),
  info: (message: string, options?: { description?: string }) => pushToast("info", message, options),
  error: (message: string, options?: { description?: string }) => pushToast("error", message, options),
};

function Toaster() {
  const [, force] = useState(0);
  useEffect(() => { const listener = () => force((n) => n + 1); toastListeners.add(listener); return () => { toastListeners.delete(listener); }; }, []);
  return <div className="toaster" role="status" aria-live="polite">{toastItems.map((item) => <div key={item.id} className={`toast toast-${item.kind}`}><div className="toast-title">{item.message}</div>{item.description && <div className="toast-copy">{item.description}</div>}</div>)}</div>;
}


function defaultSchedule() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

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

const SENDER_COLORS = ["#d6409f", "#e8741f", "#5b6cff", "#1f9d55", "#a24fd1", "#0b8aa6", "#c98a00", "#c4423f"];
function senderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}
function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}
function clockTime(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
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
    <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-[3px] border-terracotta bg-sand" />
        <span className="truncate font-semibold text-ink">{from}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <ArrowRight className="ml-[-2px] h-3.5 w-3.5 shrink-0 text-slate/60 sm:ml-0" />
        <span className="truncate font-semibold text-ink">{to}</span>
      </div>
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
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`field-input !pl-10 ${locked ? "bg-[#eef2f7]" : ""}`} autoComplete="off" readOnly={locked} />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate">Searching…</span>}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
            {suggestions.map((place) => (
              <button key={`${place.name}-${place.geometry.location.lat}`} type="button" onClick={() => { onSelect(place); setSuggestions([]); }} className="block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-[#eff6ff]">
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
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-[#dcf1e3]">
      <div className="relative h-[220px]">
        <div className="absolute inset-0 route-preview-grid" />
        {path ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><polyline points={path} fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <div className="route-preview-line" />}
        <div className="route-preview-start" />
        <div className="route-preview-end" />
        <div className="route-label route-label-start">{from}</div>
        <div className="route-label route-label-end">{to}</div>
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-ink shadow-sm backdrop-blur">{routeLoading ? "Calculating route…" : duration ? `Estimated drive time · ${Math.max(1, Math.round(duration / 60))} min` : "Route preview"}</div>
      </div>
    </div>
  );
}

function TripCard({ trip, onJoin, onShare, note }: { trip: Trip; onJoin: (trip: Trip) => void; onShare: (trip: Trip) => void; note?: string; key?: Key }) {
  const full = trip.joined >= trip.seats;
  const lifecycleStatus = trip.lifecycleStatus || "Open";
  const closed = lifecycleStatus !== "Open";
  return (
    <article className="trip-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <RouteLine from={trip.from} to={trip.to} />
          {note && <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#eef7f0] px-2.5 py-1 text-[11px] font-semibold text-forest"><Navigation className="h-3 w-3" />{note}</div>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-terracotta" />{trip.date}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-terracotta" />{trip.time}</span>
          </div>
        </div>
        <span className={`status-pill ${closed || full ? "status-full" : trip.joined === trip.seats - 1 ? "status-warm" : "status-green"}`}>
          {closed ? lifecycleStatus : full ? "Full" : `${trip.seats - trip.joined} seat${trip.seats - trip.joined === 1 ? "" : "s"} left`}
        </span>
      </div>
      <div className="my-4 h-px bg-line" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-sand px-3 py-2.5">
          <div className="text-slate">Cost per person</div>
          <div className="mt-0.5 font-display text-lg font-bold text-ink">{trip.contribution > 0 ? `About GHS ${trip.contribution}` : "Agree in chat"}</div>
          <div className="mt-0.5 text-[10px] font-medium text-slate">{trip.contribution > 0 ? "estimate · may change with traffic" : "split the fare fairly"}</div>
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
          <button onClick={() => onJoin(trip)} disabled={full || closed} className="button-primary !rounded-xl !px-3.5 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">{closed ? lifecycleStatus : full ? "Full" : "Join trip"}</button>
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
        <div className="mt-5 rounded-2xl bg-[#e7f5ec] p-4 text-sm text-ink">
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
  const [view, setView] = useState<"home" | "create" | "trips" | "messages" | "chat">("home");
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [showSheet, setShowSheet] = useState<Trip | null>(null);
  const [joinTrip, setJoinTrip] = useState<Trip | null>(null);
  const [joinStage, setJoinStage] = useState<"form" | "waiting" | "room" | "closed">("form");
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const joinSubmittingRef = useRef(false);
  const initialTripHandledRef = useRef(false);
  const [guestName, setGuestName] = useState("");
  const [guestSex, setGuestSex] = useState<"Male" | "Female" | "">("");
  const [guestRequests, setGuestRequests] = useState<GuestRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ id: "welcome", sender: "LexRide", text: "Welcome to the trip room. Agree on a public meeting point here." }]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatSendingRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ from: "", to: "", ...defaultSchedule(), seats: "3", contribution: "", hostSex: "" as "Male" | "Female" | "" });
  const [selectedLocations, setSelectedLocations] = useState<{ from?: LocationSuggestion; to?: LocationSuggestion }>({});
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [currentLocationLocked, setCurrentLocationLocked] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authSex, setAuthSex] = useState<"Male" | "Female" | "">("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<Trip | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [nearbyStatus, setNearbyStatus] = useState<"idle" | "locating" | "loading" | "ready" | "error">("idle");
  const [nearbyTrips, setNearbyTrips] = useState<Array<{ trip: Trip; note: string }>>([]);
  const [nearbyCoords, setNearbyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyDest, setNearbyDest] = useState<LocationSuggestion | undefined>();
  const [nearbyDestText, setNearbyDestText] = useState("");
  const [historyTrips, setHistoryTrips] = useState<HistoryTrip[]>([]);
  const [commuteGroups, setCommuteGroups] = useState<CommuteGroup[]>([]);
  const [hostRequests, setHostRequests] = useState<HostPendingRequest[]>([]);
  const [respondingRequestIds, setRespondingRequestIds] = useState<string[]>([]);
  const [tripLifecycleBusy, setTripLifecycleBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupFrom, setGroupFrom] = useState("");
  const [groupTo, setGroupTo] = useState("");
  const [groupTime, setGroupTime] = useState("07:00");
  const [groupSeats, setGroupSeats] = useState("3");
  const [groupBusy, setGroupBusy] = useState(false);
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [readMarks, setReadMarks] = useState<Record<string, number>>({});
  const [messageBanner, setMessageBanner] = useState<MessageBanner | null>(null);
  const [chatFrom, setChatFrom] = useState<"trips" | "messages">("trips");
  const [chatIsHost, setChatIsHost] = useState(false);
  const [chatMembers, setChatMembers] = useState<string[]>([]);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const readMarksRef = useRef<Record<string, number>>({});
  const inboxSeenRef = useRef<{ messages: Set<string>; trips: Set<string> } | null>(null);
  const viewRef = useRef(view);
  const activeChatTripRef = useRef<string | undefined>(undefined);
  viewRef.current = view;
  activeChatTripRef.current = view === "chat" ? joinTrip?.id : undefined;

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return trips;
    return trips.filter((trip) => `${trip.from} ${trip.to} ${trip.meetingPoint}`.toLowerCase().includes(query));
  }, [search, trips]);

  useEffect(() => {
    if (view !== "chat") return;
    const list = chatScrollRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [view, chatMessages]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.account) setAccount(data.account); setAuthReady(true); })
      .catch(() => setAuthReady(true));
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

  useEffect(() => {
    if (!account) { setHostRequests([]); return; }
    let stopped = false;
    let inFlight = false;
    const activeTripId = createdTrip?.id;
    const refreshRequests = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch("/api/account/requests", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (stopped) return;
        const requests = Array.isArray(data.requests) ? data.requests as HostPendingRequest[] : [];
        setHostRequests(requests);
        setGuestRequests((current) => {
          if (!activeTripId) return current;
          const currentTripWaiting = requests.filter((request) => request.tripId === activeTripId).map(({ id, name, sex, status }) => ({ id, name, sex, status }));
          return [...current.filter((request) => request.status !== "Waiting"), ...currentTripWaiting];
        });
      } catch { /* Keep the last known requests visible during temporary network failures. */ }
      finally { inFlight = false; }
    };
    void refreshRequests();
    const interval = window.setInterval(() => { void refreshRequests(); }, 3000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refreshRequests(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { stopped = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [account, createdTrip?.id]);

  useEffect(() => {
    if (!account || joinStage !== "waiting" || !joinTrip) return;
    let stopped = false;
    let inFlight = false;
    const tripId = joinTrip.id;
    const refreshApproval = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch("/api/account/trips", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const trip = (data.trips || []).find((item: any) => item.id === tripId);
        if (stopped || !trip) return;
        if (trip.lifecycleStatus && trip.lifecycleStatus !== "Open") {
          setJoinTrip((current) => current?.id === tripId ? { ...current, lifecycleStatus: trip.lifecycleStatus } : current);
          setHistoryTrips((items) => items.map((item) => item.id === tripId ? { ...item, lifecycleStatus: trip.lifecycleStatus, requestStatus: trip.requestStatus } : item));
          setJoinStage("closed");
          return;
        }
        if (trip.requestStatus !== "Approved") return;
        const roomResponse = await fetch(`/api/rides/${encodeURIComponent(tripId)}`, { cache: "no-store" });
        if (!roomResponse.ok) return;
        const room = await roomResponse.json();
        if (stopped) return;
        const approvedTrip: Trip = {
          ...joinTrip,
          id: room.id || tripId,
          from: room.fromLabel || joinTrip.from,
          to: room.toLabel || joinTrip.to,
          date: room.date || joinTrip.date,
          time: room.time || joinTrip.time,
          seats: Number(room.seats) || joinTrip.seats,
          joined: Array.isArray(room.joined) ? room.joined.filter((member: any) => member.status !== "Declined").length + 1 : joinTrip.joined,
          host: room.creatorName || joinTrip.host,
          hostSex: room.creatorSex || joinTrip.hostSex,
          lifecycleStatus: room.lifecycleStatus || "Open",
        };
        setHistoryTrips((items) => items.map((item) => item.id === tripId ? { ...item, requestStatus: "Approved" } : item));
        setChatMessages((room.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account.fullName })));
        setJoinTrip(approvedTrip);
        setCreatedTrip(null);
        setJoinStage("room");
        setChatIsHost(false);
        setChatMembers([room.creatorName, ...(Array.isArray(room.joined) ? room.joined.filter((member: any) => member.status === "Approved").map((member: any) => member.firstName) : [])].filter(Boolean));
        setShowChatMenu(false);
        setChatFrom("trips");
        setView("chat");
        toast.success("You’re approved. The trip group chat is ready.");
      } catch { /* Retry on the next check while the request is still waiting. */ }
      finally { inFlight = false; }
    };
    void refreshApproval();
    const interval = window.setInterval(() => { void refreshApproval(); }, 3000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refreshApproval(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { stopped = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [account, joinStage, joinTrip?.id]);

  useEffect(() => {
    if (view !== "chat" || !joinTrip || joinStage !== "room" || !account) return;
    let stopped = false;
    let inFlight = false;
    const tripId = joinTrip.id;
    const me = account.fullName;
    const poll = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch(`/api/rides/${encodeURIComponent(tripId)}/messages`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = await response.json();
        if (stopped || !Array.isArray(data.messages)) return;
        const newest = data.messages.reduce((max: number, message: any) => Math.max(max, Number(message.createdAt) || 0), 0);
        if (newest) markRead(tripId, newest);
        setChatMessages((current) => {
          const pending = current.filter((message) => message.id.startsWith("tmp-"));
          const server = data.messages.map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === me }));
          const same = server.length + pending.length === current.length && server.every((message: ChatMessage, index: number) => current[index]?.id === message.id);
          return same ? current : [...server, ...pending];
        });
        if (data.lifecycleStatus) setJoinTrip((current) => current && current.lifecycleStatus !== data.lifecycleStatus ? { ...current, lifecycleStatus: data.lifecycleStatus } : current);
      } catch { /* try again on the next tick */ }
      finally { inFlight = false; }
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2500);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [view, joinTrip?.id, joinStage, account?.fullName]);

  const markRead = (tripId: string, timestamp: number) => {
    if (!account) return;
    const current = readMarksRef.current[tripId];
    if (current !== undefined && current >= timestamp) return;
    const next = { ...readMarksRef.current, [tripId]: timestamp };
    readMarksRef.current = next;
    setReadMarks(next);
    try { window.localStorage.setItem(`lexride-read:${account.id}`, JSON.stringify(next)); } catch { /* Read marks are a convenience; ignore storage failures. */ }
  };

  useEffect(() => {
    inboxSeenRef.current = null;
    setInbox([]);
    setInboxLoaded(false);
    setMessageBanner(null);
    let marks: Record<string, number> = {};
    if (account) { try { marks = JSON.parse(window.localStorage.getItem(`lexride-read:${account.id}`) || "{}") || {}; } catch { marks = {}; } }
    readMarksRef.current = marks;
    setReadMarks(marks);
  }, [account?.id]);

  useEffect(() => {
    if (!account) return;
    let stopped = false;
    let inFlight = false;
    const me = account.fullName;
    const poll = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch("/api/account/inbox", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = await response.json();
        if (stopped) return;
        const conversations: InboxConversation[] = Array.isArray(data.conversations) ? data.conversations : [];
        const previous = inboxSeenRef.current;
        const fresh: Array<{ conversation: InboxConversation; message: InboxMessage }> = [];
        const seen = { messages: new Set<string>(), trips: new Set<string>() };
        for (const conversation of conversations) {
          seen.trips.add(conversation.id);
          for (const message of conversation.messages) {
            seen.messages.add(message.id);
            if (previous && previous.trips.has(conversation.id) && !previous.messages.has(message.id) && message.sender !== me && message.sender !== "LexRide") fresh.push({ conversation, message });
          }
          // First time we see a trip, treat its existing history as already read.
          if (readMarksRef.current[conversation.id] === undefined) markRead(conversation.id, conversation.messages[conversation.messages.length - 1]?.createdAt ?? 0);
        }
        inboxSeenRef.current = seen;
        setInbox(conversations);
        setInboxLoaded(true);
        const alertable = fresh.filter(({ conversation }) => conversation.id !== activeChatTripRef.current && viewRef.current !== "messages");
        if (alertable.length) {
          const latest = alertable.reduce((best, item) => item.message.createdAt >= best.message.createdAt ? item : best);
          setMessageBanner({ id: Date.now(), tripId: latest.conversation.id, route: `${latest.conversation.from} → ${latest.conversation.to}`, sender: latest.message.sender, text: latest.message.text, extra: alertable.length - 1 });
        }
      } catch { /* Keep the last known inbox during temporary network failures. */ }
      finally { inFlight = false; }
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 4000);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [account?.id]);

  useEffect(() => {
    if (!messageBanner) return;
    const timer = window.setTimeout(() => setMessageBanner((current) => current?.id === messageBanner.id ? null : current), 6000);
    return () => window.clearTimeout(timer);
  }, [messageBanner?.id]);

  // While a trip chat is open, everything in it counts as read.
  useEffect(() => {
    if (view !== "chat" || !joinTrip) return;
    const latest = inbox.find((conversation) => conversation.id === joinTrip.id)?.messages.at(-1)?.createdAt;
    if (latest) markRead(joinTrip.id, latest);
  }, [view, joinTrip?.id, inbox]);

  const unreadCount = (conversation: InboxConversation) => conversation.messages.filter((message) => message.sender !== account?.fullName && message.sender !== "LexRide" && message.createdAt > (readMarks[conversation.id] ?? Number.POSITIVE_INFINITY)).length;
  const totalUnread = inbox.reduce((sum, conversation) => sum + (conversation.id === activeChatTripRef.current ? 0 : unreadCount(conversation)), 0);
  const openConversation = (conversation: InboxConversation) => {
    setMessageBanner(null);
    void openTripChat({ id: conversation.id, from: conversation.from, to: conversation.to, date: conversation.date, time: conversation.time, seats: conversation.seats, joined: 1, contribution: 0, meetingPoint: "Choose together", host: conversation.host, hostSex: conversation.hostSex, status: "Open", lifecycleStatus: conversation.lifecycleStatus }, "messages");
  };

  // Match the phone's status bar to the screen: blue in the chat, light everywhere else.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", view === "chat" ? "#2563eb" : "#f4f6fa");
  }, [view]);

  // Stop the page scrolling behind an open sheet.
  const sheetOpen = !!showSheet || showAuth || showProfile || (showRequests && hostRequests.length > 0) || (!!joinTrip && joinStage !== "room" && view !== "chat");
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [sheetOpen]);

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
      const trip = data.trip ? { id: data.trip.id, from: data.trip.fromLabel, to: data.trip.toLabel, date: data.trip.date || "Today", time: data.trip.time, seats: data.trip.seats, joined: 1, contribution: 0, meetingPoint: "Choose together", host: account?.fullName || "You", hostSex: account?.sex, status: "Open" as const, lifecycleStatus: (data.trip.lifecycleStatus || "Open") as TripLifecycleStatus } : null;
      if (trip) {
        setTrips((items) => [trip, ...items]);
        setCreatedTrip(trip);
        setChatMessages((data.trip.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account?.fullName })));
        setView("create");
      }
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
      const restored: Trip = { id: ride.id, from: ride.fromLabel, to: ride.toLabel, date: ride.date || historyTrip.date, time: ride.time, seats: Number(ride.seats) || historyTrip.seats, joined: (Number(ride.activeMemberCount ?? ride.joined?.filter((member: any) => member.status !== "Declined").length) || 0) + 1, contribution: historyTrip.contribution || 0, meetingPoint: historyTrip.meetingPoint || "Choose together", host: ride.creatorName || historyTrip.host, hostSex: ride.creatorSex || historyTrip.hostSex, status: "Open", lifecycleStatus: ride.lifecycleStatus || historyTrip.lifecycleStatus || "Open" };
      setCreatedTrip(restored);
      setJoinTrip(null);
      setGuestRequests((ride.joined || []).filter((member: any) => ride.lifecycleStatus === "Open" && member.status === "Waiting").map((member: any) => ({ id: member.id, name: member.firstName, sex: member.sex, status: member.status })));
      setChatMessages((ride.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account?.fullName })));
      setView("create");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load this trip"); }
  };

  const loadNearby = async (coords: { lat: number; lng: number }, dest?: LocationSuggestion) => {
    setNearbyStatus("loading");
    try {
      const params = new URLSearchParams({ lat: String(coords.lat), lng: String(coords.lng) });
      if (dest) { params.set("toLat", String(dest.geometry.location.lat)); params.set("toLng", String(dest.geometry.location.lng)); }
      const response = await fetch(`/api/rides/nearby?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { setNearbyStatus("idle"); openAuth("signin"); return; }
      if (!response.ok) throw new Error(data.error || `Could not load nearby trips (${response.status})`);
      const km = (value: number) => (value <= 0.5 ? "under 500 m" : `about ${value} km`);
      setNearbyTrips((data.trips || []).map((ride: any) => ({
        trip: { id: ride.id, from: ride.fromLabel, to: ride.toLabel, date: ride.date ? new Date(`${ride.date}T00:00:00`).toLocaleDateString("en-GH", { weekday: "short", day: "2-digit", month: "short" }) : "Soon", time: ride.time, seats: Number(ride.seats), joined: Number(ride.joined), contribution: 0, meetingPoint: "Choose together", host: ride.creatorName, hostSex: ride.creatorSex, status: "Open" as const, lifecycleStatus: "Open" as const },
        note: ride.endKm !== undefined ? `Starts ${km(ride.startKm)} from you · ends ${km(ride.endKm)} from your stop` : `Starts ${km(ride.startKm)} from you`,
      })));
      setNearbyStatus("ready");
    } catch (error) {
      setNearbyStatus("error");
      toast.error(error instanceof Error ? error.message : "Could not load nearby trips");
    }
  };

  const findNearby = () => {
    if (!account) { openAuth("signin"); return; }
    if (!navigator.geolocation) { toast.error("Location is not available on this device."); return; }
    setNearbyStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const here = { lat: coords.latitude, lng: coords.longitude }; setNearbyCoords(here); void loadNearby(here, nearbyDest); },
      () => { setNearbyStatus("idle"); toast.error("We couldn’t get your location. Allow location access in your browser, then try again."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };

  const shareTrip = (trip: Trip) => {
    const joinLink = `${window.location.origin}/?trip=${encodeURIComponent(trip.id)}&data=${encodeTripForLink(trip)}`;
    const text = `Join my LexRide trip: ${trip.from} → ${trip.to}, ${trip.date} at ${trip.time}. Host: ${trip.host} (${trip.hostSex || "sex not provided"}). ${trip.seats - trip.joined} seat(s) left. Join here: ${joinLink}`;
    navigator.clipboard?.writeText(text);
    toast.success("Trip message copied", { description: "Paste it into WhatsApp to invite people." });
  };

  const shareWhatsApp = (trip: Trip) => {
    const joinLink = `${window.location.origin}/?trip=${encodeURIComponent(trip.id)}&data=${encodeTripForLink(trip)}`;
    const text = `Join my LexRide trip: ${trip.from} → ${trip.to}, ${trip.date} at ${trip.time}. ${Math.max(0, trip.seats - trip.joined)} seat(s) left. Join here: ${joinLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const openTripChat = async (trip: Trip, from: "trips" | "messages" = "trips") => {
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(trip.id)}`);
      const ride = await response.json();
      if (!response.ok) throw new Error(ride.error || "Could not load the trip room");
      const restored: Trip = { ...trip, id: ride.id, from: ride.fromLabel, to: ride.toLabel, date: ride.date || trip.date, time: ride.time, seats: Number(ride.seats) || trip.seats, joined: (Number(ride.activeMemberCount ?? ride.joined?.filter((member: any) => member.status !== "Declined").length) || 0) + 1, host: ride.creatorName || trip.host, hostSex: ride.creatorSex || trip.hostSex, lifecycleStatus: ride.lifecycleStatus || "Open" };
      setJoinTrip(restored);
      setCreatedTrip(null);
      setChatMessages((ride.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account?.fullName })));
      setJoinStage("room");
      setChatIsHost(ride.viewerRole === "host");
      setChatMembers([ride.creatorName, ...(Array.isArray(ride.joined) ? ride.joined.filter((member: any) => member.status === "Approved").map((member: any) => member.firstName) : [])].filter(Boolean));
      setShowChatMenu(false);
      setChatFrom(from);
      setView("chat");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load the trip room"); }
  };
  const join = async (trip: Trip, requestStatus?: HistoryTrip["requestStatus"]) => {
    if (!account) {
      if (trip.lifecycleStatus && trip.lifecycleStatus !== "Open" && requestStatus !== "Approved") {
        toast.info(trip.lifecycleStatus === "Cancelled" ? "This trip was cancelled" : "This trip has finished");
        return;
      }
      openAuth("signin", trip);
      return;
    }
    let status = requestStatus;
    if (!status) {
      try {
        const response = await fetch("/api/account/trips");
        if (response.ok) status = (await response.json()).trips?.find((item: any) => item.id === trip.id)?.requestStatus;
      } catch { /* A public trip without a prior request should show the join form. */ }
    }
    if (status === "Approved") { openTripChat(trip); return; }
    if (status === "Closed" || (trip.lifecycleStatus && trip.lifecycleStatus !== "Open")) {
      toast.info(trip.lifecycleStatus === "Cancelled" ? "This trip was cancelled" : "This trip has finished");
      return;
    }
    setJoinTrip(trip);
    setJoinStage(status === "Waiting" ? "waiting" : "form");
    setGuestName(account.fullName);
    setGuestSex(account.sex);
  };

  useEffect(() => {
    if (!authReady || initialTripHandledRef.current) return;
    initialTripHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("trip");
    if (!tripId) return;
    const localTrip = trips.find((item) => item.id === tripId);
    if (localTrip) { join(localTrip); return; }
    const linkedTrip = params.get("data") ? decodeTripFromLink(params.get("data") as string) : null;
    if (linkedTrip && linkedTrip.id === tripId) {
      let cancelled = false;
      fetch(`/api/rides/${encodeURIComponent(tripId)}`).then((response) => response.ok ? response.json() : null).then((ride) => {
        if (cancelled) return;
        const currentTrip: Trip = ride ? { ...linkedTrip, id: ride.id, from: ride.fromLabel || linkedTrip.from, to: ride.toLabel || linkedTrip.to, lifecycleStatus: ride.lifecycleStatus || "Open" } : linkedTrip;
        setTrips((items) => items.some((item) => item.id === currentTrip.id) ? items.map((item) => item.id === currentTrip.id ? { ...item, lifecycleStatus: currentTrip.lifecycleStatus } : item) : [currentTrip, ...items]);
        join(currentTrip);
      }).catch(() => {
        if (cancelled) return;
        setTrips((items) => items.some((item) => item.id === linkedTrip.id) ? items : [linkedTrip, ...items]);
        join(linkedTrip);
      });
      return () => { cancelled = true; };
    }
    let cancelled = false;
    fetch(`/api/rides/${encodeURIComponent(tripId)}`).then((response) => response.ok ? response.json() : null).then((ride) => {
      if (cancelled || !ride) return;
      const sharedTrip: Trip = { id: ride.id, from: ride.fromLabel, to: ride.toLabel, date: ride.date || "Shared trip", time: ride.time, seats: Number(ride.seats) || 3, joined: (Number(ride.activeMemberCount ?? ride.joined?.filter((member: any) => member.status !== "Declined").length) || 0) + 1, contribution: 0, meetingPoint: "Choose together", host: ride.creatorName || "Trip creator", hostSex: ride.creatorSex, status: "Open", lifecycleStatus: ride.lifecycleStatus || "Open" };
      setTrips((items) => items.some((item) => item.id === sharedTrip.id) ? items : [sharedTrip, ...items]);
      join(sharedTrip);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [authReady, account]);

  const submitJoinRequest = async () => {
    if (!joinTrip || !guestName.trim() || !guestSex) { toast.error("Enter your name and confirm Male or Female first"); return; }
    if (joinSubmittingRef.current) return;
    joinSubmittingRef.current = true;
    setJoinSubmitting(true);
    try {
      const response = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: joinTrip.id, firstName: guestName.trim(), sex: guestSex }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || `Join request failed (${response.status})`);
      const ride = data;
      const latest = ride.joined?.find((member: any) => member.firstName === guestName.trim() && member.status === "Waiting");
      const request = { id: latest?.id || `guest-${Date.now()}`, name: guestName.trim(), sex: guestSex, status: "Waiting" as const };
      setGuestRequests((items) => items.some((item) => item.id === request.id)
        ? items.map((item) => item.id === request.id ? request : item)
        : [...items, request]);
      setJoinStage("waiting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not send your join request. Please try again.");
    } finally {
      joinSubmittingRef.current = false;
      setJoinSubmitting(false);
    }
  };

  const approveGuest = async (request: GuestRequest) => {
    if (!createdTrip) return;
    const prevGuest = guestRequests;
    const prevHost = hostRequests;
    setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Approved" } : item));
    setHostRequests((items) => items.filter((item) => item.id !== request.id));
    try {
      const response = await fetch("/api/member-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: createdTrip.id, memberId: request.id, status: "Approved" }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || "Could not approve passenger");
      setChatMessages((data.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account?.fullName })));
      setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Approved" } : item));
      setHostRequests((items) => items.filter((item) => item.id !== request.id));
      setTrips((items) => items.map((item) => item.id === createdTrip.id ? { ...item, joined: Math.min(item.seats, item.joined + 1), status: item.joined + 1 >= item.seats ? "Full" : "Almost full" } : item));
      toast.success(`${request.name} approved`);
    } catch (error) { setGuestRequests(prevGuest); setHostRequests(prevHost); toast.error(error instanceof Error ? error.message : "Could not approve passenger"); }
  };

  const declineGuest = async (request: GuestRequest) => {
    if (!createdTrip) return;
    const prevGuest = guestRequests;
    const prevHost = hostRequests;
    setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Declined" } : item));
    setHostRequests((items) => items.filter((item) => item.id !== request.id));
    try {
      const response = await fetch("/api/member-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: createdTrip.id, memberId: request.id, status: "Declined" }) });
      if (!response.ok) throw new Error("Could not decline passenger");
      setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "Declined" } : item));
      setHostRequests((items) => items.filter((item) => item.id !== request.id));
    } catch (error) { setGuestRequests(prevGuest); setHostRequests(prevHost); toast.error(error instanceof Error ? error.message : "Could not decline passenger"); }
  };

  const respondToHostRequest = async (request: HostPendingRequest, status: "Approved" | "Declined") => {
    if (respondingRequestIds.includes(request.id)) return;
    setRespondingRequestIds((ids) => [...ids, request.id]);
    const prevHost = hostRequests;
    const prevGuest = guestRequests;
    setHostRequests((items) => items.filter((item) => item.id !== request.id));
    setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status } : item));
    try {
      const response = await fetch("/api/member-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: request.tripId, memberId: request.id, status }) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) throw new Error(data.error || `Could not ${status.toLowerCase()} passenger`);
      if (createdTrip?.id === request.tripId) setChatMessages((data.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account?.fullName })));
      setHostRequests((items) => items.filter((item) => item.id !== request.id));
      setGuestRequests((items) => items.map((item) => item.id === request.id ? { ...item, status } : item));
      if (status === "Approved") {
        const seats = Number(data.seats);
        const joined = data.joined?.filter((member: any) => member.status !== "Declined").length + 1;
        if (Number.isFinite(seats) && Number.isFinite(joined)) {
          const tripStatus = joined >= seats ? "Full" : joined === seats - 1 ? "Almost full" : "Open";
          setTrips((items) => items.map((trip) => trip.id === request.tripId ? { ...trip, joined: Math.min(seats, joined), status: tripStatus } : trip));
          setCreatedTrip((trip) => trip?.id === request.tripId ? { ...trip, joined: Math.min(seats, joined), status: tripStatus } : trip);
        }
      }
      toast.success(status === "Approved" ? `${request.name} approved` : `${request.name} declined`);
    } catch (error) { setHostRequests(prevHost); setGuestRequests(prevGuest); toast.error(error instanceof Error ? error.message : `Could not ${status.toLowerCase()} passenger`); }
    finally { setRespondingRequestIds((ids) => ids.filter((id) => id !== request.id)); }
  };

  const updateTripLifecycle = async (status: Exclude<TripLifecycleStatus, "Open">) => {
    const trip = view === "chat" ? joinTrip : createdTrip;
    if (!trip || tripLifecycleBusy || (trip.lifecycleStatus && trip.lifecycleStatus !== "Open")) return;
    const prompt = status === "Finished"
      ? "End this trip? New join requests, approvals, and messages will stop, but the chat history stays available."
      : "Cancel this trip? New join requests, approvals, and messages will stop. This cannot be undone.";
    if (!window.confirm(prompt)) return;
    setTripLifecycleBusy(true);
    try {
      const response = await fetch("/api/member-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: trip.id, status }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update trip status");
      const lifecycleStatus = (data.lifecycleStatus || status) as TripLifecycleStatus;
      setCreatedTrip((current) => current?.id === trip.id ? { ...current, lifecycleStatus } : current);
      setJoinTrip((current) => current?.id === trip.id ? { ...current, lifecycleStatus } : current);
      setTrips((items) => items.map((item) => item.id === trip.id ? { ...item, lifecycleStatus } : item));
      setHistoryTrips((items) => items.map((item) => item.id === trip.id ? { ...item, lifecycleStatus } : item));
      setHostRequests((items) => items.filter((item) => item.tripId !== trip.id));
      setGuestRequests((items) => items.filter((item) => item.status !== "Waiting"));
      toast.success(status === "Finished" ? "Trip marked finished" : "Trip cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update trip status");
    } finally {
      setTripLifecycleBusy(false);
    }
  };

  const sendChatMessage = async () => {
    const text = chatDraft.trim();
    const activeTrip = joinTrip || createdTrip;
    if (!text || !activeTrip) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setChatMessages((current) => [...current, { id: tempId, sender: account?.fullName || "You", text, createdAt: Date.now(), mine: true }]);
    setChatDraft("");
    try {
      const response = await fetch("/api/chat-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: activeTrip.id, text }) });
      const ride = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(ride.error || `Message could not be sent (${response.status})`);
      if (!Array.isArray(ride.messages)) throw new Error("The chat response was incomplete. Refresh the trip and try again.");
      setChatMessages((current) => [...ride.messages.map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account?.fullName })), ...current.filter((message) => message.id.startsWith("tmp-") && message.id !== tempId)]);
    } catch (error) {
      setChatMessages((current) => current.filter((message) => message.id !== tempId));
      setChatDraft((draft) => draft || text);
      const message = error instanceof Error ? error.message : "We could not send that message.";
      toast.error(message === "Failed to fetch" ? "No connection. Your message wasn’t sent, and it’s back in the box." : `${message} Your message is back in the box.`);
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
      const response = await fetch("/api/create-ride", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromLabel: form.from, toLabel: form.to, fromLat: selectedLocations.from.geometry.location.lat, fromLng: selectedLocations.from.geometry.location.lng, toLat: selectedLocations.to.geometry.location.lat, toLng: selectedLocations.to.geometry.location.lng, time: form.time, date: form.date, seats: Number(form.seats), platform: "Passenger arranged" }) });
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
        lifecycleStatus: sharedRide.lifecycleStatus || "Open",
      };
      setTrips((items) => [trip, ...items]);
      setCreatedTrip(trip);
      setChatMessages((sharedRide.messages || []).map((message: any) => ({ id: message.id, sender: message.sender, text: message.text, createdAt: Number(message.createdAt) || undefined, mine: message.sender === account.fullName })));
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
  const visibleHostRequests = hostRequests.filter((request) => view !== "create" || createdTrip?.id !== request.tripId);

  return (
    <div className="min-h-screen bg-sand text-ink">
      <Toaster />
      {messageBanner && <div className="msg-banner-wrap" role="status" aria-live="polite">
        <button type="button" className="msg-banner" onClick={() => { const conversation = inbox.find((item) => item.id === messageBanner.tripId); if (conversation) openConversation(conversation); else setMessageBanner(null); }}>
          <span className="msg-banner-icon"><MessageCircle className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1 text-left"><span className="block truncate text-[11px] font-bold opacity-70">{messageBanner.route}</span><span className="block truncate text-sm font-bold">{messageBanner.sender}</span><span className="block truncate text-sm opacity-90">{messageBanner.text}</span>{messageBanner.extra > 0 && <span className="block text-[11px] font-bold opacity-70">+{messageBanner.extra} more in other trips</span>}</span>
        </button>
        <button type="button" className="msg-banner-close" aria-label="Dismiss message alert" onClick={() => setMessageBanner(null)}><X className="h-4 w-4" /></button>
      </div>}
      {view !== "chat" && <header className="site-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <button onClick={() => { setView("home"); setCreatedTrip(null); }} aria-label="LexRide home"><Logo /></button>
          <nav className="hidden items-center gap-1 md:flex">
            <button className={`nav-link ${view === "home" ? "nav-active" : ""}`} onClick={() => setView("home")}>Find trips</button>
            <button className={`nav-link ${view === "messages" ? "nav-active" : ""}`} onClick={() => setView("messages")}>Messages{totalUnread > 0 && <> <span className="nav-count">{totalUnread}</span></>}</button>
            <button className={`nav-link ${view === "trips" ? "nav-active" : ""}`} onClick={() => setView("trips")}>My trips <span className="nav-count">{trips.filter((trip) => trip.host === "You").length}</span></button>
          </nav>
          <div className="hidden items-center gap-2 md:flex">{account ? <button className="button-soft !gap-2 !px-3 !py-2" onClick={() => setShowProfile(true)}><span className="avatar !h-7 !w-7 !bg-[#0f172a] !text-[11px] !text-white">{account.fullName.slice(0, 1).toUpperCase()}</span><span className="text-xs font-bold text-ink">{account.fullName}</span></button> : <><button className="button-soft !px-3 !py-2 text-sm" onClick={() => openAuth("signin")}>Sign in</button></>}<button className="button-dark !rounded-xl !px-4 !py-2.5 text-sm" onClick={() => { if (!account) { openAuth("signin"); return; } setView("create"); setCreatedTrip(null); }}><Plus className="mr-1.5 h-4 w-4" /> Create a trip</button></div>
          <div className="flex items-center gap-2 md:hidden">{account ? <button type="button" className="icon-button !h-10 !w-10 !rounded-full !border-ink !bg-[#0f172a] !text-white" onClick={() => setShowProfile(true)} aria-label="Open profile"><span className="text-sm font-bold">{account.fullName.slice(0, 1).toUpperCase()}</span></button> : <><button type="button" className="button-soft !rounded-xl !px-3 !py-2 text-xs" onClick={() => openAuth("signin")}>Sign in</button><button type="button" className="button-dark !rounded-xl !px-3 !py-2 text-xs" onClick={() => openAuth("signup")}>Join</button></>}</div>
        </div>
      </header>}

      {account && view !== "chat" && visibleHostRequests.length > 0 && <div className="mx-auto max-w-6xl px-5 pt-3 lg:px-8"><button type="button" onClick={() => setShowRequests(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-left"><span className="flex items-center gap-3"><span className="nav-count !h-6 !min-w-6 !text-xs">{visibleHostRequests.length}</span><span className="text-sm font-semibold text-ink">{visibleHostRequests.length === 1 ? "1 person wants to join your trip" : `${visibleHostRequests.length} people want to join your trips`}</span></span><span className="shrink-0 whitespace-nowrap text-xs font-bold text-terracotta">Review <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" /></span></button></div>}

      <main className={view === "chat" ? "" : "mx-auto max-w-6xl px-5 pb-28 pt-6 md:pb-16 md:pt-8 lg:px-8 lg:pt-14"}>
        {view === "home" && <>
          {account && <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><h1 className="font-display text-3xl font-bold tracking-[-0.04em] md:text-5xl">Hi {account.fullName.split(" ")[0]}, where to?</h1></div>
            <button className="button-primary hidden md:inline-flex" onClick={() => { setView("create"); setCreatedTrip(null); }}><Plus className="mr-2 h-4 w-4" /> Create a trip</button>
          </section>}
          {!account && <section className="py-4 md:py-10"><h1 className="font-display text-[clamp(2.4rem,7vw,4.5rem)] font-bold leading-[1] tracking-[-0.05em]">Going somewhere?<br /><span className="text-terracotta">Go together.</span></h1><p className="mt-4 max-w-md text-base leading-7 text-slate">Find people near you heading the same way, and share the ride.</p></section>}

          <section aria-label="Going your way" className="mt-8 rounded-3xl border border-line bg-white p-5 md:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.03em]">Find people going your way</h2></div></div>
            {nearbyStatus === "idle" && <><p className="mt-2 max-w-lg text-sm leading-6 text-slate">We use your location only to find matches. Nobody else sees it.</p><button type="button" className="button-primary mt-4 w-full sm:w-auto" onClick={findNearby}><Navigation className="mr-2 h-4 w-4" /> Find trips near me</button><button type="button" className="mt-1 block py-3 text-sm font-semibold text-terracotta underline" onClick={() => { if (!account) { openAuth("signin"); return; } setView("create"); setCreatedTrip(null); }}>Or start your own trip</button></>}
            {nearbyStatus === "locating" && <p className="mt-4 flex items-center gap-2 text-sm text-slate"><Loader2 className="h-4 w-4 animate-spin" /> Finding your location…</p>}
            {(nearbyStatus === "loading" || nearbyStatus === "ready" || nearbyStatus === "error") && <>
              <div className="mt-4"><LocationInput label="Where are you going? (optional)" value={nearbyDestText} placeholder="e.g. KNUST or Kejetia" onChange={(value) => { setNearbyDestText(value); if (nearbyDest) { setNearbyDest(undefined); if (nearbyCoords) void loadNearby(nearbyCoords); } }} onSelect={(place) => { setNearbyDestText(place.name); setNearbyDest(place); if (nearbyCoords) void loadNearby(nearbyCoords, place); }} /></div>
              {nearbyStatus === "loading" && <p className="mt-4 flex items-center gap-2 text-sm text-slate"><Loader2 className="h-4 w-4 animate-spin" /> Looking for trips…</p>}
              {nearbyStatus === "error" && <button type="button" className="button-soft mt-4" onClick={() => nearbyCoords ? void loadNearby(nearbyCoords, nearbyDest) : findNearby()}>Try again</button>}
              {nearbyStatus === "ready" && nearbyTrips.length > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-3">{nearbyTrips.map(({ trip, note }) => <TripCard key={trip.id} trip={trip} note={note} onJoin={join} onShare={shareTrip} />)}</div>}
              {nearbyStatus === "ready" && nearbyTrips.length === 0 && <div className="mt-4 rounded-2xl bg-sand p-5 text-center"><h3 className="font-display text-lg font-bold">No one’s going your way yet</h3><p className="mt-1 text-sm text-slate">Be the first. Start a trip and share it on WhatsApp, and people nearby will see it here.</p><button type="button" className="button-primary mt-4" onClick={() => { if (!account) { openAuth("signin"); return; } setView("create"); setCreatedTrip(null); }}><Plus className="mr-2 h-4 w-4" /> Create a trip</button></div>}
              <button type="button" className="mt-3 text-xs font-semibold text-terracotta underline" onClick={findNearby}>Refresh my location</button>
            </>}
          </section>
        </>}

        {view === "create" && <section className="mx-auto max-w-3xl py-4 md:py-10">
          {!createdTrip ? <>
            <h1 className="font-display text-4xl font-bold tracking-[-0.05em] md:text-5xl">Where are you <span className="text-terracotta">heading?</span></h1>
            <form onSubmit={createTrip} className="form-card mt-8">
              <div className="grid gap-4 md:grid-cols-2"><div><LocationInput label="From · your current location" value={form.from} locked={currentLocationLocked} onChange={(value) => { setCurrentLocationLocked(false); setForm({ ...form, from: value }); setSelectedLocations((locations) => ({ ...locations, from: undefined })); }} onSelect={(place) => { setCurrentLocationLocked(false); setForm({ ...form, from: place.name }); setSelectedLocations((locations) => ({ ...locations, from: place })); }} placeholder={locationLoading ? "Finding your location…" : "Your current location" } /><CurrentLocationButton loading={locationLoading} onClick={useCurrentLocation} />{currentLocationLocked && <button type="button" className="mt-2 text-[10px] font-semibold text-terracotta underline" onClick={() => setCurrentLocationLocked(false)}>Change starting point manually</button>}{locationMessage && <p className="mt-2 rounded-lg bg-[#eef7f0] px-3 py-2 text-[10px] font-semibold text-forest">{locationMessage}</p>}</div><LocationInput label="Going to" value={form.to} onChange={(value) => { setForm({ ...form, to: value }); setSelectedLocations((locations) => ({ ...locations, to: undefined })); }} onSelect={(place) => { setForm({ ...form, to: place.name }); setSelectedLocations((locations) => ({ ...locations, to: place })); }} placeholder="e.g. KNUST or Kejetia" /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4"><label className="field-label">Date<input type="date" min={defaultSchedule().date} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="field-input" /></label><label className="field-label">Departure time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="field-input" /></label></div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4"><label className="field-label">Seats <span className="font-normal text-slate">(with you)</span><select value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} className="field-input"><option value="2">2 seats</option><option value="3">3 seats</option><option value="4">4 seats</option></select></label><label className="field-label">Cost each <span className="font-normal text-slate">(GHS, optional)</span><input type="number" min="0" value={form.contribution} onChange={(e) => setForm({ ...form, contribution: e.target.value })} placeholder="e.g. 35" className="field-input" /></label></div>
              {selectedLocations.from && selectedLocations.to && <RouteMap from={form.from} to={form.to} fromLocation={selectedLocations.from} toLocation={selectedLocations.to} />}
              <button type="submit" className="button-primary mt-6 w-full">Create my trip <ArrowRight className="ml-2 h-4 w-4" /></button>
            </form>
          </> : <div className="success-card mt-8"><div className="success-badge"><Check className="h-6 w-6" /></div><h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.04em]">Your trip is live</h1><div className="mt-5 rounded-2xl bg-sand p-4"><RouteLine from={createdTrip.from} to={createdTrip.to} /><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate"><span>{createdTrip.date}</span><span>{createdTrip.time}</span><span>{createdTrip.seats} seats</span></div></div><button className="button-whatsapp mt-5 w-full" onClick={() => shareWhatsApp(createdTrip)}><Send className="mr-2 h-4 w-4" /> Share on WhatsApp</button><button className="button-soft mt-2 w-full" onClick={() => shareTrip(createdTrip)}><Copy className="mr-2 h-4 w-4" /> Copy invite link</button>{guestRequests.filter((request) => request.status === "Waiting").length > 0 && createdTrip.lifecycleStatus === "Open" && <div className="mt-5 space-y-2">{guestRequests.filter((request) => request.status === "Waiting").map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl bg-sand p-3"><div className="avatar">{request.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1 text-sm font-semibold text-ink">{request.name} <span className="font-normal text-slate">({request.sex})</span></div><button className="button-primary !px-3 !py-2 text-xs" onClick={() => approveGuest(request)}>Accept</button><button className="button-soft !px-3 !py-2 text-xs" onClick={() => declineGuest(request)}>Decline</button></div>)}</div>}<button className="button-soft mt-3 w-full" onClick={() => openTripChat(createdTrip)}><MessageCircle className="mr-2 h-4 w-4" /> Open trip chat</button><button className="back-link mx-auto mt-5" onClick={() => setView("trips")}>View my trips</button></div>}
          {createdTrip && <div className="mt-5 rounded-2xl border border-line bg-white p-4">
            <div className="eyebrow">Trip controls</div>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Manage your trip</h2>
            {(createdTrip.lifecycleStatus || "Open") === "Open" ? <>
              <p className="mt-2 text-xs leading-5 text-slate">Finish the trip when the journey is complete, or cancel it if plans change. Closed trips no longer accept requests or chat messages.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" className="button-primary justify-center" disabled={tripLifecycleBusy} onClick={() => void updateTripLifecycle("Finished")}>{tripLifecycleBusy ? "Updating…" : "Mark trip finished"}</button>
                <button type="button" className="button-soft justify-center" disabled={tripLifecycleBusy} onClick={() => void updateTripLifecycle("Cancelled")}>{tripLifecycleBusy ? "Updating…" : "Cancel trip"}</button>
              </div>
            </> : <p className="mt-2 text-sm text-slate">This trip is {createdTrip.lifecycleStatus?.toLowerCase()}. Its history and previous messages remain available.</p>}
          </div>}
        </section>}

        {view === "chat" && !joinTrip && <section className="py-4 md:py-10"><div className="empty-state mx-auto mt-8 max-w-xl"><MessageCircle className="mx-auto h-8 w-8 text-terracotta" /><h1 className="mt-3 font-display text-2xl font-bold">Trip chat unavailable</h1><p className="mt-2 text-sm leading-6 text-slate">We couldn’t restore this trip room. Open an approved trip from your trips list to continue chatting.</p><button type="button" className="button-primary mt-5" onClick={() => setView("trips")}>Go to My Trips</button></div></section>}
        {view === "chat" && joinTrip && (() => {
          const me = account?.fullName;
          const closed = joinTrip.lifecycleStatus !== "Open";
          const others = Array.from(new Set<string>(chatMembers.filter((name) => name !== me))).sort((a, b) => a.localeCompare(b));
          const subtitle = others.length || me ? [...(me ? ["You"] : []), ...others].join(", ") : `${joinTrip.joined} members`;
          let previous: ChatMessage | undefined;
          const rows = chatMessages.map((message) => {
            const system = message.sender === "LexRide";
            const newDay = !!message.createdAt && (!previous?.createdAt || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString());
            const first = !system && (!previous || previous.sender !== message.sender || previous.sender === "LexRide" || newDay);
            previous = message;
            return { message, system, newDay, first };
          });
          return <section className="wa-screen">
            <header className="wa-header">
              <button type="button" className="wa-icon-btn" aria-label={chatFrom === "messages" ? "Back to messages" : "Back to trips"} onClick={() => { setShowChatMenu(false); setView(chatFrom); setJoinTrip(null); }}><ArrowLeft className="h-6 w-6" /></button>
              <span className="wa-avatar"><Users className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h1 className="wa-title">{joinTrip.from} → {joinTrip.to}</h1>
                <p className="wa-subtitle">{closed ? (joinTrip.lifecycleStatus === "Cancelled" ? "Trip cancelled" : "Trip ended") + " · " : ""}{subtitle}</p>
              </div>
              {chatIsHost && !closed && <div className="relative">
                <button type="button" className="wa-icon-btn" aria-label="Trip options" aria-expanded={showChatMenu} onClick={() => setShowChatMenu((open) => !open)}><EllipsisVertical className="h-5 w-5" /></button>
                {showChatMenu && <><button type="button" className="wa-menu-backdrop" aria-label="Close menu" onClick={() => setShowChatMenu(false)} /><div className="wa-menu" role="menu">
                  <button type="button" role="menuitem" disabled={tripLifecycleBusy} onClick={() => { setShowChatMenu(false); void updateTripLifecycle("Finished"); }}>End trip</button>
                  <button type="button" role="menuitem" className="wa-menu-danger" disabled={tripLifecycleBusy} onClick={() => { setShowChatMenu(false); void updateTripLifecycle("Cancelled"); }}>Cancel trip</button>
                </div></>}
              </div>}
            </header>
            <div ref={chatScrollRef} role="log" aria-live="polite" aria-relevant="additions text" className="wa-body">
              <div className="wa-notice"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />Only the host and approved passengers can see this chat. Meet in a public place.</div>
              {rows.map(({ message, system, newDay, first }) => <div key={message.id} className="contents">
                {newDay && message.createdAt && <div className="wa-day">{dayLabel(message.createdAt)}</div>}
                {system ? <div className="wa-system">{message.text}</div> : <div className={`wa-row ${message.mine ? "wa-row-out" : "wa-row-in"} ${first ? "wa-row-first" : ""}`}>
                  <div className={`wa-bubble ${message.mine ? "wa-out" : "wa-in"} ${first ? "wa-first" : ""}`}>
                    {!message.mine && first && <div className="wa-sender" style={{ color: senderColor(message.sender) }}>{message.sender}</div>}
                    <span className="wa-text">{message.text}</span>
                    <span className="wa-meta">{clockTime(message.createdAt)}{message.mine && (message.id.startsWith("tmp-") ? <Clock3 className="h-3 w-3" aria-label="Sending" /> : <CheckCheck className="h-4 w-4 wa-tick" aria-label="Sent" />)}</span>
                  </div>
                </div>}
              </div>)}
              {chatMessages.length === 0 && <p className="m-auto py-8 text-center text-sm text-slate">No messages yet. Say hello.</p>}
            </div>
            {closed ? <div className="wa-closed">{joinTrip.lifecycleStatus === "Cancelled" ? "The host cancelled this trip." : "The host ended this trip."} You can read the chat, but no one can send new messages.</div>
              : <form onSubmit={(event) => { event.preventDefault(); void sendChatMessage(); }} className="wa-composer" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
                <input type="text" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} autoComplete="off" aria-label="Message to the trip group" className="wa-input" placeholder="Message" />
                <button type="submit" disabled={!chatDraft.trim()} aria-label="Send message" className="wa-send"><Send className="h-5 w-5" /></button>
              </form>}
          </section>;
        })()}
        {view === "messages" && <section className="py-4 md:py-10"><h1 className="font-display text-3xl font-bold tracking-[-0.04em] md:text-5xl">Messages</h1>{!account ? <div className="empty-state mt-8 max-w-2xl"><h3 className="font-display text-xl font-bold">Sign in to see your messages</h3><p className="mt-1 text-sm text-slate">Your trip group chats appear here.</p><button className="button-primary mt-4" onClick={() => openAuth("signin")}>Sign in</button></div> : !inboxLoaded ? <p className="mt-8 flex items-center gap-2 text-sm text-slate"><Loader2 className="h-4 w-4 animate-spin" /> Loading your chats…</p> : <div className="mt-6 grid max-w-3xl gap-2">{inbox.map((conversation) => { const last = conversation.messages[conversation.messages.length - 1]; const unread = unreadCount(conversation); return <button key={conversation.id} type="button" className={`convo ${unread > 0 ? "convo-unread" : ""}`} onClick={() => openConversation(conversation)}><span className="convo-icon"><MessageCircle className="h-5 w-5" /></span><span className="min-w-0 flex-1 text-left"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-ink">{conversation.from} → {conversation.to}</span><span className="shrink-0 text-[11px] text-slate">{last ? formatMessageTime(last.createdAt) : ""}</span></span><span className="mt-0.5 block truncate text-[11px] text-slate">{conversation.date} · {conversation.time} · {conversation.role === "created" ? "You started this" : `Host: ${conversation.host}`}{conversation.lifecycleStatus !== "Open" ? ` · ${conversation.lifecycleStatus}` : ""}</span><span className="mt-1 flex items-center justify-between gap-2"><span className={`truncate text-sm ${unread > 0 ? "font-bold text-ink" : "text-slate"}`}>{last ? `${last.sender === account.fullName ? "You" : last.sender}: ${last.text}` : "No messages yet. Say hello."}</span>{unread > 0 && <span className="convo-badge">{unread > 9 ? "9+" : unread}</span>}</span></span></button>; })}{inbox.length === 0 && <div className="empty-state"><h3 className="font-display text-xl font-bold">No chats yet</h3><p className="mt-1 text-sm text-slate">When you start a trip or a host approves you, its group chat shows up here.</p><button className="button-primary mt-4" onClick={() => setView("home")}>Find a trip</button></div>}</div>}</section>}

        {view === "trips" && <section className="py-4 md:py-10"><h1 className="font-display text-3xl font-bold tracking-[-0.04em] md:text-5xl">My trips</h1>{!account ? <div className="empty-state mt-8 max-w-2xl"><h3 className="font-display text-xl font-bold">Sign in to see your trips</h3><button className="button-primary mt-4" onClick={() => openAuth("signin")}>Sign in</button></div> : <><div className="mt-8"><div className="mt-4 grid max-w-3xl gap-3">{historyTrips.map((trip) => <div key={trip.id} className="trip-card"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><RouteLine from={trip.from} to={trip.to} /><div className="mt-3 text-xs text-slate">{trip.date} · {trip.time} · {trip.role === "created" ? "You started this" : "You joined this"}</div></div><span className={`shrink-0 status-pill ${trip.lifecycleStatus === "Cancelled" || trip.requestStatus === "Closed" || trip.requestStatus === "Declined" ? "status-full" : trip.lifecycleStatus === "Finished" ? "status-warm" : trip.role === "created" || trip.requestStatus === "Approved" ? "status-green" : "status-warm"}`}>{trip.lifecycleStatus && trip.lifecycleStatus !== "Open" ? trip.lifecycleStatus : trip.role === "created" ? "Created" : trip.requestStatus === "Approved" ? "Approved" : trip.requestStatus === "Declined" ? "Declined" : trip.requestStatus === "Closed" ? "Closed" : "Waiting"}</span></div><div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate">Host: <strong className="text-ink">{trip.host}</strong></span>{trip.role === "created" || trip.requestStatus === "Approved" || ((trip.requestStatus !== "Declined" && trip.requestStatus !== "Closed") && (trip.lifecycleStatus || "Open") === "Open") ? <button className="button-soft !px-3 !py-2 text-xs" onClick={() => trip.role === "created" ? openHistoryTrip(trip) : join(trip, trip.requestStatus)}>Open trip</button> : <span className="text-xs font-semibold text-slate">Request closed</span>}</div></div>)}{historyTrips.length === 0 && <div className="empty-state"><h3 className="font-display text-xl font-bold">No trips yet</h3><p className="mt-1 text-sm text-slate">Create a trip or join someone going your way.</p><button className="button-primary mt-4" onClick={() => setView("create")}>Create a trip</button></div>}</div></div></>}</section>}
      </main>

      {view !== "chat" && <nav aria-label="Main" className="tabbar md:hidden">
        <button type="button" className={`tab ${view === "home" ? "tab-active" : ""}`} aria-current={view === "home" ? "page" : undefined} onClick={() => { setView("home"); setCreatedTrip(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Search className="h-5 w-5" /><span>Find</span></button>
        <button type="button" className={`tab tab-create ${view === "create" ? "tab-active" : ""}`} aria-label="Create a trip" onClick={() => { if (!account) { openAuth("signin"); return; } setView("create"); setCreatedTrip(null); }}><span className="tab-plus"><Plus className="h-6 w-6" /></span><span>Create</span></button>
        <button type="button" className={`tab ${view === "messages" ? "tab-active" : ""}`} aria-current={view === "messages" ? "page" : undefined} aria-label={totalUnread > 0 ? `Messages, ${totalUnread} unread` : "Messages"} onClick={() => setView("messages")}><span className="relative"><MessageCircle className="h-5 w-5" />{totalUnread > 0 && <span className="tab-dot tab-dot-message">{totalUnread > 9 ? "9+" : totalUnread}</span>}</span><span>Messages</span></button>
        <button type="button" className={`tab ${view === "trips" ? "tab-active" : ""}`} aria-current={view === "trips" ? "page" : undefined} onClick={() => setView("trips")}><span className="relative"><CalendarDays className="h-5 w-5" />{visibleHostRequests.length > 0 && <span className="tab-dot">{visibleHostRequests.length}</span>}</span><span>My trips</span></button>
      </nav>}


      {showSheet && <MeetingPointSheet trip={showSheet} onClose={() => setShowSheet(null)} onConfirm={confirmMeetingPoint} />}
      {showRequests && account && visibleHostRequests.length > 0 && <div className="sheet-backdrop" onMouseDown={() => setShowRequests(false)}>
        <div className="sheet-panel max-w-md space-y-2" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 px-1">
            <div><div className="eyebrow">Trip requests</div><div className="mt-1 font-display text-lg font-bold text-ink">Review passengers</div></div>
            <div className="flex items-center gap-2"><span className="status-pill status-warm">{visibleHostRequests.length} waiting</span><button type="button" className="icon-button" onClick={() => setShowRequests(false)} aria-label="Close requests"><X className="h-4 w-4" /></button></div>
          </div>
          {visibleHostRequests.map((request) => <div key={request.id} className="rounded-xl border border-line bg-white p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="avatar">{request.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{request.name} <span className="font-normal text-slate">({request.sex}) wants to join</span></div>
                <div className="mt-1 truncate text-xs font-semibold text-ink">{request.from} → {request.to}</div>
                <div className="mt-1 text-[11px] text-slate">{request.date} · {request.time}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="button-primary !rounded-xl !px-3 !py-2 text-xs" disabled={respondingRequestIds.includes(request.id)} onClick={() => respondToHostRequest(request, "Approved")}>{respondingRequestIds.includes(request.id) ? "Saving…" : "Approve"}</button>
              <button className="button-soft !rounded-xl !px-3 !py-2 text-xs" disabled={respondingRequestIds.includes(request.id)} onClick={() => respondToHostRequest(request, "Declined")}>Reject</button>
            </div>
          </div>)}
          <p className="px-1 text-[10px] leading-4 text-slate">New requests refresh automatically while you’re signed in.</p>
        </div>
      </div>}
      {showProfile && account && <div className="sheet-backdrop" onMouseDown={() => setShowProfile(false)}><div className="sheet-panel max-w-md" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">Your LexRide profile</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{account.fullName}</h3></div><button className="icon-button" onClick={() => setShowProfile(false)} aria-label="Close profile"><X className="h-4 w-4" /></button></div><div className="mt-6 flex items-center gap-4 rounded-2xl bg-sand p-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-xl font-bold text-white">{account.fullName.slice(0, 1).toUpperCase()}</div><div><div className="text-sm font-bold text-ink">{account.sex}</div><div className="mt-1 text-xs text-slate">Your name and sex are shown in shared trips.</div></div></div><button className="button-primary mt-5 w-full justify-center" onClick={() => { setShowProfile(false); setView("trips"); }}><CalendarDays className="mr-2 h-4 w-4" /> Your trips</button><button className="button-soft mt-3 w-full justify-center" onClick={() => { setShowProfile(false); signOut(); }}><UserRound className="mr-2 h-4 w-4" /> Sign out</button></div></div>}
      {showAuth && <div className="sheet-backdrop" onMouseDown={() => !authBusy && setShowAuth(false)}><div className="sheet-panel max-w-md" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">LexRide account</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{authMode === "signup" ? "Create your account" : "Welcome back"}</h3></div><button className="icon-button" onClick={() => setShowAuth(false)} aria-label="Close"><X className="h-4 w-4" /></button></div><p className="mt-3 text-sm leading-6 text-slate">Use your name, sex, and a password. No OTP or email required.</p><form onSubmit={submitAuth} className="mt-5 space-y-4"><label className="field-label">Full name<input className="field-input" value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="e.g. Yaw Mensah" autoComplete="name" /></label>{authMode === "signup" && <fieldset><legend className="field-label">Your sex <span className="font-normal text-slate">(visible in trips)</span></legend><div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => setAuthSex("Male")} className={`button-soft justify-center ${authSex === "Male" ? "!border-terracotta !bg-[#eaf1ff]" : ""}`}>Male</button><button type="button" onClick={() => setAuthSex("Female")} className={`button-soft justify-center ${authSex === "Female" ? "!border-terracotta !bg-[#eaf1ff]" : ""}`}>Female</button></div></fieldset>}<label className="field-label">Password<input type="password" className="field-input" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={authMode === "signup" ? "new-password" : "current-password"} /></label><button className="button-primary w-full" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}</button></form><button className="back-link mx-auto mt-5" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>{authMode === "signup" ? "Already have an account? Sign in" : "New to LexRide? Create an account"}</button><p className="mt-4 text-center text-[11px] leading-5 text-slate">Remember your password: without an email or phone number, LexRide cannot reset it yet.</p></div></div>}
      {joinTrip && joinStage !== "room" && view !== "chat" && <div className="sheet-backdrop" onMouseDown={() => setJoinTrip(null)}><div className="sheet-panel" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><div className="eyebrow">{joinStage === "form" ? "Waiting room" : joinStage === "waiting" ? "Request sent" : joinStage === "closed" ? "Trip closed" : "Trip room"}</div><h3 className="mt-1 font-display text-2xl font-bold text-ink">{joinStage === "form" ? "Request to join" : joinStage === "waiting" ? "Waiting for approval" : joinStage === "closed" ? "Trip is closed" : "You’re approved"}</h3></div><button className="icon-button" onClick={() => setJoinTrip(null)} aria-label="Close"><X className="h-4 w-4" /></button></div><div className="mt-5 rounded-2xl bg-sand p-4"><RouteLine from={joinTrip.from} to={joinTrip.to} /><div className="mt-2 text-xs font-semibold text-slate">Host: {joinTrip.host} ({joinTrip.hostSex || "sex not provided"})</div><div className="mt-3 text-sm text-slate">{joinTrip.date} · {joinTrip.time}</div><div className="mt-1 font-display text-xl font-bold text-ink">About GHS {joinTrip.contribution} / person</div></div>{joinStage === "form" && <><p className="mt-5 text-sm leading-6 text-slate">Enter your details. The person who created this trip must approve you before you can see the group chat.</p><div className="mt-4 rounded-xl bg-sand p-3 text-sm text-slate"><div className="font-semibold text-ink">{account?.fullName}</div><div className="mt-1 text-xs">{account?.sex} · This is visible to the trip group</div></div><div className="mt-4 flex items-start gap-3 rounded-xl bg-[#e7f5ec] p-3 text-xs leading-5 text-slate"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" /><span>Your details are shown to the trip creator for approval. Meet in public.</span></div><button type="button" className="button-primary mt-5 w-full" disabled={joinSubmitting} aria-busy={joinSubmitting} onClick={submitJoinRequest}>{joinSubmitting ? "Sending request…" : "Send join request"} <ArrowRight className="ml-2 h-4 w-4" /></button></>}{(joinStage === "waiting" || joinStage === "closed") && <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf1ff] text-terracotta"><Clock3 className="h-6 w-6" /></div><h4 className="mt-4 font-display text-xl font-bold text-ink">{joinStage === "closed" ? "This trip is closed" : "You’re in the waiting room"}</h4><p className="mt-2 text-sm leading-6 text-slate">{joinStage === "closed" ? "The host has finished or cancelled this trip. It will no longer accept requests." : "Your name and sex were sent to the trip creator. The chat opens after they accept you."}</p><span className="status-pill status-warm mt-4">{joinStage === "closed" ? joinTrip.lifecycleStatus || "Closed" : "Waiting for approval"}</span></div>}{joinStage === "room" && <div className="mt-5"><div className="rounded-xl bg-[#e7f5ec] p-3 text-sm text-slate"><strong className="text-ink">You’re approved.</strong> You can now coordinate with the group.</div><div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-line bg-white p-3">{chatMessages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.mine ? "bg-ink text-white" : "bg-sand text-ink"}`}><div className="mb-0.5 text-[10px] font-bold opacity-60">{message.sender}</div>{message.text}</div></div>)}</div><div className="mt-3 flex gap-2"><input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }} disabled={joinTrip.lifecycleStatus !== "Open"} className="field-input" placeholder={joinTrip.lifecycleStatus === "Open" ? "Write to the trip group…" : "Trip chat is read-only"} /><button type="button" onClick={sendChatMessage} disabled={joinTrip.lifecycleStatus !== "Open"} className="button-primary !px-3 disabled:opacity-50"><Send className="h-4 w-4" /></button></div></div>}</div></div>}
    </div>
  );
}
