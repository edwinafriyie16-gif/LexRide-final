import { createHash } from "node:crypto";

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
  creator_account_id: string | null;
  created_at: string;
};

type MemberRow = {
  id: string;
  name: string;
  sex: "Male" | "Female";
  status: "Waiting" | "Approved" | "Declined";
  joined_at: string;
  account_id: string | null;
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

function makeJoinRequestId(tripId: string, accountId: string): string {
  const bytes = createHash("sha1").update(`lexride-join:${tripId}:${accountId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function deduplicateMembers(members: MemberRow[]): MemberRow[] {
  const priority: Record<MemberRow["status"], number> = { Declined: 0, Waiting: 1, Approved: 2 };
  const unique = new Map<string, MemberRow>();
  for (const member of members) {
    const key = member.account_id ? `account:${member.account_id}` : `member:${member.id}`;
    const current = unique.get(key);
    if (!current || priority[member.status] > priority[current.status]) unique.set(key, member);
  }
  return Array.from(unique.values()).sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
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
    joined: deduplicateMembers(members).map((member) => ({ id: member.id, firstName: member.name, sex: member.sex, status: member.status, joinedAt: new Date(member.joined_at).getTime() })),
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
  creatorAccountId?: string;
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
      creator_account_id: input.creatorAccountId ?? null,
    }),
  });
  const tripId = rows[0]?.id || id;
  await recordSystemMessage(tripId, "Trip group created. Approved passengers will be able to join this chat.", true);
  const ride = await loadRide(tripId);
  if (!ride) throw new Error("Ride was created but could not be loaded");
  return ride;
}

export async function getRide(id: string): Promise<SharedRide | undefined> {
  return loadRide(id);
}

export async function getRideCreatorAccountId(id: string): Promise<string | null | undefined> {
  const rows = await supabaseRequest<Array<{ creator_account_id: string | null }>>(
    `lexride_trip_rooms?id=eq.${encodeURIComponent(id)}&select=creator_account_id&limit=1`,
    {},
    true,
  );
  return rows[0]?.creator_account_id;
}

export async function canAccessTripChat(id: string, accountId: string): Promise<boolean> {
  const creatorAccountId = await getRideCreatorAccountId(id);
  if (creatorAccountId === undefined) return false;
  if (creatorAccountId === accountId) return true;
  const approved = await supabaseRequest<Array<{ id: string }>>(
    `lexride_trip_members?trip_id=eq.${encodeURIComponent(id)}&account_id=eq.${encodeURIComponent(accountId)}&status=eq.Approved&select=id&limit=1`,
    {},
    true,
  );
  return approved.length > 0;
}

async function recordSystemMessage(id: string, text: string, admin = true): Promise<void> {
  try {
    await supabaseRequest("lexride_trip_messages", {
      method: "POST",
      body: JSON.stringify({ trip_id: id, sender: "LexRide", sender_sex: null, text }),
    }, admin);
  } catch (error) {
    console.error(`[Ride ${id}] Could not record system message:`, error);
  }
}

export async function joinRide(id: string, firstName: string, sex: "Male" | "Female", accountId?: string): Promise<SharedRide | { error: string; status: number }> {
  const ride = await loadRide(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  const name = firstName.trim().slice(0, 80);
  if (accountId) {
    const existing = await supabaseRequest<MemberRow[]>(`lexride_trip_members?trip_id=eq.${encodeURIComponent(id)}&account_id=eq.${encodeURIComponent(accountId)}&select=*&order=joined_at.desc&limit=100`, {}, true);
    if (existing.some((member) => member.status === "Approved" || member.status === "Waiting")) return ride;
    const declined = existing.find((member) => member.status === "Declined");
    if (declined) {
      const reactivated = await supabaseRequest<MemberRow[]>(`lexride_trip_members?id=eq.${encodeURIComponent(declined.id)}&trip_id=eq.${encodeURIComponent(id)}&status=eq.Declined`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name, sex, status: "Waiting" }),
      }, true);
      if (!reactivated.length) return (await loadRide(id)) || ride;
      await recordSystemMessage(id, `${name} requested to join the trip again.`, true);
      return (await loadRide(id)) || ride;
    }
  }
  if (ride.joined.filter((member) => member.status !== "Declined").length >= ride.seats) return { error: "Ride is full", status: 409 };
  const memberId = accountId ? makeJoinRequestId(id, accountId) : undefined;
  const inserted = await supabaseRequest<MemberRow[]>(accountId ? "lexride_trip_members?on_conflict=id" : "lexride_trip_members", {
    method: "POST",
    headers: { Prefer: accountId ? "resolution=ignore-duplicates,return=representation" : "return=representation" },
    body: JSON.stringify({ ...(memberId ? { id: memberId } : {}), trip_id: id, account_id: accountId ?? null, name, sex, status: "Waiting" }),
  }, Boolean(accountId));
  if (inserted?.length) await recordSystemMessage(id, `${name} requested to join the trip.`, Boolean(accountId));
  const member = inserted?.[0] || (memberId ? { id: memberId, name, sex, status: "Waiting" as const, joined_at: new Date().toISOString(), account_id: accountId } : undefined);
  if (!member) return (await loadRide(id)) || ride;
  const joined = ride.joined.filter((item) => item.id !== member.id);
  joined.push({ id: member.id, firstName: member.name, sex: member.sex, status: member.status, joinedAt: new Date(member.joined_at).getTime() });
  return { ...ride, joined };
}

export async function setMemberStatus(id: string, memberId: string, status: "Approved" | "Declined"): Promise<SharedRide | { error: string; status: number }> {
  const ride = await loadRide(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  const selected = await supabaseRequest<MemberRow[]>(`lexride_trip_members?id=eq.${encodeURIComponent(memberId)}&trip_id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, true);
  const member = selected[0];
  if (!member) return { error: "Member request not found", status: 404 };
  if (member.status === status) return ride;
  if (member.status !== "Waiting") return { error: "This request has already been handled", status: 409 };

  let message = `${member.name} was ${status.toLowerCase()}.`;
  if (member.account_id) {
    const accountMembers = await supabaseRequest<MemberRow[]>(`lexride_trip_members?trip_id=eq.${encodeURIComponent(id)}&account_id=eq.${encodeURIComponent(member.account_id)}&select=*&order=joined_at.asc&limit=100`, {}, true);
    const alreadyApproved = status === "Approved" && accountMembers.some((row) => row.id !== memberId && row.status === "Approved");
    if (alreadyApproved) {
      await supabaseRequest<MemberRow[]>(`lexride_trip_members?trip_id=eq.${encodeURIComponent(id)}&account_id=eq.${encodeURIComponent(member.account_id)}&status=eq.Waiting`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "Declined" }),
      }, true);
      message = `${member.name} already has an approved seat; duplicate requests were closed.`;
    } else {
      await supabaseRequest<MemberRow[]>(`lexride_trip_members?trip_id=eq.${encodeURIComponent(id)}&account_id=eq.${encodeURIComponent(member.account_id)}&status=eq.Waiting&id=neq.${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "Declined" }),
      }, true);
      const changed = await supabaseRequest<MemberRow[]>(`lexride_trip_members?id=eq.${encodeURIComponent(memberId)}&trip_id=eq.${encodeURIComponent(id)}&status=eq.Waiting`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status }),
      }, true);
      if (!changed.length) {
        const latest = await supabaseRequest<MemberRow[]>(`lexride_trip_members?id=eq.${encodeURIComponent(memberId)}&trip_id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, true);
        if (latest[0]?.status !== status) return { error: "This request has already been handled", status: 409 };
      }
    }
  } else {
    const changed = await supabaseRequest<MemberRow[]>(`lexride_trip_members?id=eq.${encodeURIComponent(memberId)}&trip_id=eq.${encodeURIComponent(id)}&status=eq.Waiting`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    }, true);
    if (!changed.length) return { error: "This request has already been handled", status: 409 };
  }
  await recordSystemMessage(id, message, true);
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
