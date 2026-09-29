import assert from "node:assert/strict";
import { joinRide, setMemberStatus } from "../api/_rideStore.ts";

process.env.SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const trip = {
  id: "LX-TEST",
  from_label: "Apaasi",
  to_label: "KNUST",
  to_lat: null,
  to_lng: null,
  date: "2026-09-29",
  time: "12:08",
  seats: 4,
  platform: "Passenger arranged",
  creator_name: "Host",
  creator_sex: "Male",
  creator_account_id: "host-1",
  created_at: "2026-09-29T10:00:00Z",
};

let members = [];
let messages = [];
let accountLookupCount = 0;
let releaseLookups;
let lookupBarrier = new Promise((resolve) => { releaseLookups = resolve; });
let forceConcurrentLookup = false;
let failSystemMessages = false;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const matchesEq = (filter, value) => {
  const expected = filter?.startsWith("eq.") ? filter.slice(3) : undefined;
  return expected === undefined || expected === value;
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop();
  const params = url.searchParams;
  const method = String(init.method || "GET").toUpperCase();

  if (table === "lexride_trip_rooms") return json([trip]);

  if (table === "lexride_trip_members") {
    if (method === "GET") {
      const snapshot = members.filter((row) =>
        matchesEq(params.get("trip_id"), row.trip_id)
        && matchesEq(params.get("account_id"), row.account_id)
        && matchesEq(params.get("id"), row.id)
        && matchesEq(params.get("status"), row.status));
      if (forceConcurrentLookup && params.has("account_id")) {
        accountLookupCount += 1;
        if (accountLookupCount === 2) releaseLookups();
        await lookupBarrier;
      }
      return json(snapshot);
    }

    if (method === "POST") {
      const body = JSON.parse(String(init.body));
      const alreadyExists = body.id && members.some((row) => row.id === body.id);
      if (alreadyExists && params.has("on_conflict")) return json([], 201);
      const row = {
        ...body,
        id: body.id || `db-${members.length + 1}`,
        joined_at: new Date().toISOString(),
      };
      members.push(row);
      return json([row], 201);
    }

    if (method === "PATCH") {
      const patch = JSON.parse(String(init.body));
      const selected = members.filter((row) => {
        for (const [key, value] of params.entries()) {
          if (key === "on_conflict") continue;
          if (value.startsWith("eq.") && row[key] !== value.slice(3)) return false;
          if (value.startsWith("neq.") && row[key] === value.slice(4)) return false;
        }
        return true;
      });
      for (const row of selected) Object.assign(row, patch);
      return json(selected);
    }
  }

  if (table === "lexride_trip_messages") {
    if (method === "GET") return json(messages.filter((row) => matchesEq(params.get("trip_id"), row.trip_id)));
    if (method === "POST") {
      if (failSystemMessages) return json({ error: "simulated message write failure" }, 500);
      const row = JSON.parse(String(init.body));
      messages.push(row);
      return json([row], 201);
    }
  }

  throw new Error(`Unexpected mock request: ${method} ${url}`);
};

forceConcurrentLookup = true;
const concurrent = await Promise.all([
  joinRide("LX-TEST", "Yaw Mensah", "Male", "passenger-1"),
  joinRide("LX-TEST", "Yaw Mensah", "Male", "passenger-1"),
]);
assert.equal(members.length, 1, "rapid duplicate taps create one membership row");
assert.match(members[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.equal(messages.length, 1, "duplicate retry records only one join activity message");
assert.ok(concurrent.every((ride) => !("error" in ride) && ride.joined.length === 1), "both taps return a consistent waiting result");
console.log("PASS: concurrent repeated join creates one request and one system message");

forceConcurrentLookup = false;
accountLookupCount = 0;
members = [];
messages = [];
failSystemMessages = true;
const originalConsoleError = console.error;
let savedDespiteMessageFailure;
console.error = () => {};
try {
  savedDespiteMessageFailure = await joinRide("LX-TEST", "Kofi", "Male", "passenger-log-failure");
} finally {
  console.error = originalConsoleError;
}
assert.ok(!("error" in savedDespiteMessageFailure), "optional chat-log failure does not fail the join request");
assert.equal(members.length, 1);
failSystemMessages = false;
console.log("PASS: join succeeds even if the optional activity message write fails");

members = [
  { id: "pending-a", trip_id: "LX-TEST", account_id: "passenger-2", name: "Yaw Mensah", sex: "Male", status: "Waiting", joined_at: "2026-09-29T10:01:00Z" },
  { id: "pending-b", trip_id: "LX-TEST", account_id: "passenger-2", name: "Yaw Mensah", sex: "Male", status: "Waiting", joined_at: "2026-09-29T10:01:01Z" },
];
messages = [];
const approvedDuplicate = await setMemberStatus("LX-TEST", "pending-a", "Approved");
assert.ok(!("error" in approvedDuplicate));
assert.deepEqual(members.map((row) => row.status).sort(), ["Approved", "Declined"]);
assert.equal(approvedDuplicate.joined.length, 1, "duplicate memberships count as one rider");
assert.equal(approvedDuplicate.joined[0].status, "Approved");
console.log("PASS: approving a legacy duplicate closes the extra row and counts one seat");

members = [
  { id: "already-approved", trip_id: "LX-TEST", account_id: "passenger-3", name: "Ama", sex: "Female", status: "Approved", joined_at: "2026-09-29T10:01:00Z" },
  { id: "stale-pending", trip_id: "LX-TEST", account_id: "passenger-3", name: "Ama", sex: "Female", status: "Waiting", joined_at: "2026-09-29T10:02:00Z" },
];
messages = [];
const approvedStaleRequest = await setMemberStatus("LX-TEST", "stale-pending", "Approved");
assert.ok(!("error" in approvedStaleRequest));
assert.deepEqual(members.map((row) => row.status).sort(), ["Approved", "Declined"]);
assert.equal(approvedStaleRequest.joined.length, 1, "a stale duplicate does not allocate a second seat");
console.log("PASS: stale pending duplicate cannot create a second approval for an already-approved account");

members = [
  { id: "declined-a", trip_id: "LX-TEST", account_id: "passenger-4", name: "Esi", sex: "Female", status: "Declined", joined_at: "2026-09-29T10:01:00Z" },
];
messages = [];
const retried = await joinRide("LX-TEST", "Esi", "Female", "passenger-4");
assert.ok(!("error" in retried));
assert.equal(members.length, 1, "retry after a decline reuses the prior membership row");
assert.equal(members[0].status, "Waiting");
console.log("PASS: a re-request after decline reactivates one existing row");
