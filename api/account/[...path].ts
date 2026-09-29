import { getAccountFromToken, readCookie } from "../_authStore.js";
import { createRide, supabaseRequest } from "../_rideStore.js";

type GroupRow = { id: string; name: string; from_label: string; to_label: string; usual_time: string; days: string[]; seats: number; owner_account_id: string; created_at: string };
type TripRow = { id: string; from_label: string; to_label: string; date: string | null; time: string; seats: number; creator_name: string; creator_sex: "Male" | "Female" | null; creator_account_id: string | null; created_at: string };
type PendingMemberRow = { id: string; trip_id: string; account_id: string | null; name: string; sex: "Male" | "Female"; status: "Waiting" | "Approved"; joined_at: string };

function pathOf(req: any) {
  const value = req.query?.path;
  if (value) return (Array.isArray(value) ? value.join("/") : String(value)).replace(/^\/+|\/+$/g, "");
  return String(req.url || "").split("?", 1)[0].replace(/^\/api\/account\/?/, "").replace(/^\/+|\/+$/g, "");
}

async function currentAccount(req: any) {
  return getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
}

export default async function handler(req: any, res: any) {
  const path = pathOf(req);
  try {
    const account = await currentAccount(req);
    if (!account) return res.status(401).json({ error: "Sign in required" });

    if (path === "requests" && req.method === "GET") {
      const hostedTrips = await supabaseRequest<TripRow[]>(`lexride_trip_rooms?creator_account_id=eq.${encodeURIComponent(account.id)}&select=id,from_label,to_label,date,time,creator_name,creator_sex,creator_account_id,created_at&order=created_at.desc&limit=100`, {}, true);
      if (!hostedTrips.length) {
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
        return res.json({ requests: [] });
      }
      const hostedTripIds = hostedTrips.map((trip) => encodeURIComponent(trip.id)).join(",");
      const activeMembers = await supabaseRequest<PendingMemberRow[]>(`lexride_trip_members?trip_id=in.(${hostedTripIds})&status=in.(Waiting,Approved)&select=id,trip_id,account_id,name,sex,status,joined_at&order=joined_at.asc&limit=200`, {}, true);
      const tripById = new Map(hostedTrips.map((trip) => [trip.id, trip]));
      const approvedAccounts = new Set(activeMembers.filter((member) => member.status === "Approved" && member.account_id).map((member) => `${member.trip_id}:${member.account_id}`));
      const seenRequests = new Set<string>();
      const requests = activeMembers.flatMap((member) => {
        if (member.status !== "Waiting") return [];
        const key = member.account_id ? `${member.trip_id}:${member.account_id}` : `row:${member.id}`;
        if ((member.account_id && approvedAccounts.has(key)) || seenRequests.has(key)) return [];
        seenRequests.add(key);
        const trip = tripById.get(member.trip_id);
        return trip ? [{ id: member.id, tripId: trip.id, name: member.name, sex: member.sex, status: member.status, joinedAt: member.joined_at, from: trip.from_label, to: trip.to_label, date: trip.date || "Shared trip", time: trip.time }] : [];
      });
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.json({ requests });
    }

    if (path === "trips" && req.method === "GET") {
      const created = await supabaseRequest<TripRow[]>(`lexride_trip_rooms?creator_account_id=eq.${encodeURIComponent(account.id)}&select=id,from_label,to_label,date,time,seats,creator_name,creator_sex,creator_account_id,created_at&order=created_at.desc&limit=100`, {}, true);
      const memberships = await supabaseRequest<{ trip_id: string; status: "Waiting" | "Approved" | "Declined"; joined_at: string }[]>(`lexride_trip_members?account_id=eq.${encodeURIComponent(account.id)}&select=trip_id,status,joined_at&order=joined_at.desc&limit=100`, {}, true);
      const joinedIds = memberships.map((item) => item.trip_id).filter((id) => !created.some((trip) => trip.id === id));
      const joined = joinedIds.length ? await supabaseRequest<TripRow[]>(`lexride_trip_rooms?id=in.(${joinedIds.map(encodeURIComponent).join(",")})&select=id,from_label,to_label,date,time,seats,creator_name,creator_sex,creator_account_id,created_at&order=created_at.desc&limit=100`, {}, true) : [];
      return res.json({ trips: [...created, ...joined].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((trip) => {
        const tripMemberships = memberships.filter((item) => item.trip_id === trip.id);
        const requestStatus = trip.creator_account_id === account.id ? undefined : tripMemberships.some((item) => item.status === "Approved") ? "Approved" : tripMemberships[0]?.status || "Waiting";
        return { id: trip.id, from: trip.from_label, to: trip.to_label, date: trip.date || "Shared trip", time: trip.time, seats: trip.seats, host: trip.creator_name, hostSex: trip.creator_sex, role: trip.creator_account_id === account.id ? "created" : "joined", requestStatus };
      }) });
    }

    if (path === "groups" && req.method === "GET") {
      const memberships = await supabaseRequest<{ group_id: string }[]>(`lexride_commute_group_members?account_id=eq.${encodeURIComponent(account.id)}&status=eq.Approved&select=group_id&limit=100`, {}, true);
      const ids = memberships.map((item) => item.group_id);
      const groups = ids.length ? await supabaseRequest<GroupRow[]>(`lexride_commute_groups?id=in.(${ids.map(encodeURIComponent).join(",")})&select=*&order=created_at.desc&limit=100`, {}, true) : [];
      return res.json({ groups });
    }

    if (path === "groups" && req.method === "POST") {
      const { name, fromLabel, toLabel, usualTime, days, seats } = req.body || {};
      if (!name || !fromLabel || !toLabel || !usualTime) return res.status(400).json({ error: "Name, route, and usual time are required" });
      const rows = await supabaseRequest<GroupRow[]>("lexride_commute_groups", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, from_label: fromLabel, to_label: toLabel, usual_time: usualTime, days: Array.isArray(days) && days.length ? days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], seats: Number(seats) || 3, owner_account_id: account.id }) }, true);
      const group = rows?.[0];
      if (!group) return res.status(500).json({ error: "Group was created but could not be loaded" });
      await supabaseRequest("lexride_commute_group_members", { method: "POST", body: JSON.stringify({ group_id: group.id, account_id: account.id, status: "Approved" }) }, true);
      return res.status(201).json({ group });
    }

    const groupMatch = path.match(/^groups\/([^/]+)\/(start|join)$/);
    if (groupMatch && req.method === "POST") {
      const [, groupId, action] = groupMatch;
      const groups = await supabaseRequest<GroupRow[]>(`lexride_commute_groups?id=eq.${encodeURIComponent(groupId)}&select=*&limit=1`, {}, true);
      const group = groups[0];
      if (!group) return res.status(404).json({ error: "Commute group not found" });
      if (action === "join") {
        await supabaseRequest("lexride_commute_group_members", { method: "POST", body: JSON.stringify({ group_id: group.id, account_id: account.id, status: "Approved" }) }, true);
        return res.json({ group });
      }
      const trip = await createRide({ fromLabel: group.from_label, toLabel: group.to_label, date: new Date().toISOString().slice(0, 10), time: group.usual_time, seats: group.seats, platform: "Regular commute group", creatorName: account.fullName, creatorSex: account.sex, creatorAccountId: account.id });
      return res.status(201).json({ trip });
    }

    return res.status(404).json({ error: "Account route not found" });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Account data request failed" });
  }
}
