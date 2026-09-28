export interface SharedRideJoiner {
  id: string;
  firstName: string;
  sex: "Male" | "Female";
  status: "Waiting" | "Approved" | "Declined";
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderSex?: "Male" | "Female";
  text: string;
  createdAt: number;
}

export interface SharedRide {
  id: string;
  fromLabel: string;
  toLabel: string;
  toLat?: number;
  toLng?: number;
  date?: string;
  time: string;
  seats: number;
  platform: string;
  creatorName: string;
  creatorSex?: "Male" | "Female";
  createdAt: number;
  joined: SharedRideJoiner[];
  messages: ChatMessage[];
}

type TripRow = {
  id: string;
  from_label: string;
  to_label: string;
  to_lat: number | null;
  to_lng: number | null;
  date: string | null;
  time: string;
  seats: number;
  platform: string;
  creator_name: string;
  creator_sex: "Male" | "Female" | null;
  created_at: string;
};

type MemberRow = {
  id: string;
  name: string;
  sex: "Male" | "Female";
  status: "Waiting" | "Approved" | "Declined";
  joined_at: string;
};

type MessageRow = {
  id: string;
  sender: string;
  sender_sex: "Male" | "Female" | null;
  text: string;
  created_at: string;
};

function getSupabaseConfig(admin = false) {
  const url = process.env.SUPABASE_URL;
  const key = admin ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error(admin ? "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables" : "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const { url, key } = getSupabaseConfig(admin);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

function makeId(): string {
  return `LX-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function toRide(trip: TripRow, members: MemberRow[], messages: MessageRow[]): SharedRide {
  return {
    id: trip.id,
    fromLabel: trip.from_label,
    toLabel: trip.to_label,
    toLat: trip.to_lat ?? undefined,
    toLng: trip.to_lng ?? undefined,
    date: trip.date ?? undefined,
    time: trip.time,
    seats: trip.seats,
    platform: trip.platform,
    creatorName: trip.creator_name,
    creatorSex: trip.creator_sex ?? undefined,
    createdAt: new Date(trip.created_at).getTime(),
    joined: members.map((member) => ({ id: member.id, firstName: member.name, sex: member.sex, status: member.status, joinedAt: new Date(member.joined_at).getTime() })),
    messages: messages.map((message) => ({ id: message.id, sender: message.sender, senderSex: message.sender_sex ?? undefined, text: message.text, createdAt: new Date(message.created_at).getTime() })),
  };
}

async function loadRide(id: string): Promise<SharedRide | undefined> {
  const trips = await supabaseRequest<TripRow[]>(`lexride_trip_rooms?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const trip = trips[0];
  if (!trip) return undefined;
  const [members, messages] = await Promise.all([
    supabaseRequest<MemberRow[]>(`lexride_trip_members?trip_id=eq.${encodeURIComponent(id)}&select=*&order=joined_at.asc&limit=100`),
    supabaseRequest<MessageRow[]>(`lexride_trip_messages?trip_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc&limit=200`),
  ]);
  return toRide(trip, members, messages);
}

export async function createRide(input: {
  fromLabel: string;
  toLabel: string;
  toLat?: number;
  toLng?: number;
  date?: string;
  time: string;
  seats?: number;
  platform?: string;
  creatorName: string;
  creatorSex?: "Male" | "Female";
}): Promise<SharedRide> {
  const id = makeId();
  const rows = await supabaseRequest<TripRow[]>("lexride_trip_rooms", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      from_label: input.fromLabel,
      to_label: input.toLabel,
      to_lat: input.toLat ?? null,
      to_lng: input.toLng ?? null,
      date: input.date ?? null,
      time: input.time,
      seats: Number(input.seats) || 3,
      platform: input.platform || "Passenger arranged",
      creator_name: input.creatorName,
      creator_sex: input.creatorSex ?? null,
    }),
  });
  const ride = await loadRide(rows[0]?.id || id);
  if (!ride) throw new Error("Ride was created but could not be loaded");
  return ride;
}

export async function getRide(id: string): Promise<SharedRide | undefined> {
  return loadRide(id);
}

export async function joinRide(id: string, firstName: string, sex: "Male" | "Female"): Promise<SharedRide | { error: string; status: number }> {
  const ride = await loadRide(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  if (ride.joined.filter((member) => member.status !== "Declined").length >= ride.seats) return { error: "Ride is full", status: 409 };
  await supabaseRequest<MemberRow[]>("lexride_trip_members", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ trip_id: id, name: firstName.trim().slice(0, 80), sex, status: "Waiting" }),
  });
  await supabaseRequest("lexride_trip_messages", {
    method: "POST",
    body: JSON.stringify({ trip_id: id, sender: "LexRide", sender_sex: null, text: `${firstName.trim().slice(0, 80)} requested to join the trip.` }),
  });
  return (await loadRide(id)) as SharedRide;
}

export async function setMemberStatus(id: string, memberId: string, status: "Approved" | "Declined"): Promise<SharedRide | { error: string; status: number }> {
  const ride = await loadRide(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  const rows = await supabaseRequest<MemberRow[]>(`lexride_trip_members?id=eq.${encodeURIComponent(memberId)}&trip_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status }),
  });
  if (!rows.length) return { error: "Member request not found", status: 404 };
  const member = rows[0];
  await supabaseRequest("lexride_trip_messages", {
    method: "POST",
    body: JSON.stringify({ trip_id: id, sender: "LexRide", sender_sex: null, text: `${member.name} was ${status.toLowerCase()}.` }),
  });
  return (await loadRide(id)) as SharedRide;
}

export async function addMessage(id: string, sender: string, text: string, senderSex?: "Male" | "Female"): Promise<SharedRide | { error: string; status: number }> {
  const ride = await loadRide(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return { error: "Message is empty", status: 400 };
  await supabaseRequest("lexride_trip_messages", {
    method: "POST",
    body: JSON.stringify({ trip_id: id, sender: sender.slice(0, 80), sender_sex: senderSex ?? null, text: trimmed }),
  });
  return (await loadRide(id)) as SharedRide;
}
