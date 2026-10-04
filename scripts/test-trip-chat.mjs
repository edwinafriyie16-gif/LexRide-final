import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canAccessTripChat, createRide, joinRide, setMemberStatus, supabaseRequest } from "../api/_rideStore.ts";
import rideHandler from "../api/rides/[...path].ts";
import chatMessageHandler from "../api/chat-message.ts";

process.env.SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const trips = [];
const members = [];
const messages = [];
const messageWriteAuthHeaders = [];
const databaseAuthHeaders = [];
const accounts = new Map([
  ["host-1", { id: "host-1", full_name: "Trip Host", sex: "Male", password_hash: "unused" }],
  ["passenger-1", { id: "passenger-1", full_name: "Approved Passenger", sex: "Female", password_hash: "unused" }],
]);
const tokens = new Map([["host-token", "host-1"], ["passenger-token", "passenger-1"]]);
const tokenHashes = new Map([...tokens].map(([token, accountId]) => [createHash("sha256").update(token).digest("hex"), accountId]));

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
const matches = (value, filter) => {
  if (!filter) return true;
  if (filter.startsWith("eq.")) return value === filter.slice(3);
  if (filter.startsWith("neq.")) return value !== filter.slice(4);
  if (filter.startsWith("gt.")) return String(value) > filter.slice(3);
  return true;
};
const matchesRow = (row, params, keys) => keys.every((key) => matches(row[key], params.get(key)));

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop();
  const params = url.searchParams;
  const method = String(init.method || "GET").toUpperCase();
  databaseAuthHeaders.push(new Headers(init.headers).get("Authorization"));

  if (table === "lexride_trip_rooms") {
    if (method === "POST") {
      const body = JSON.parse(String(init.body));
      const row = { ...body, created_at: new Date().toISOString() };
      trips.push(row);
      return json([row], 201);
    }
    const selected = trips.filter((row) => matchesRow(row, params, ["id", "creator_account_id"]));
    return json(selected);
  }

  if (table === "lexride_trip_members") {
    if (method === "GET") return json(members.filter((row) => matchesRow(row, params, ["id", "trip_id", "account_id", "status"])));
    if (method === "POST") {
      const body = JSON.parse(String(init.body));
      const row = { ...body, id: body.id || `member-${members.length + 1}`, joined_at: new Date().toISOString() };
      members.push(row);
      return json([row], 201);
    }
    if (method === "PATCH") {
      const patch = JSON.parse(String(init.body));
      const filterKeys = ["id", "trip_id", "account_id", "status"];
      const selected = members.filter((row) => matchesRow(row, params, filterKeys));
      for (const row of selected) Object.assign(row, patch);
      return json(selected);
    }
  }

  if (table === "lexride_trip_messages") {
    if (method === "GET") return json(messages.filter((row) => matches(row.trip_id, params.get("trip_id"))));
    if (method === "POST") {
      messageWriteAuthHeaders.push(new Headers(init.headers).get("Authorization"));
      const row = { ...JSON.parse(String(init.body)), id: `message-${messages.length + 1}`, created_at: new Date().toISOString() };
      messages.push(row);
      return json([row], 201);
    }
  }

  if (table === "lexride_sessions" && method === "GET") {
    const accountId = tokenHashes.get(params.get("token_hash")?.slice(3) || "");
    return json(accountId ? [{ account_id: accountId, expires_at: new Date(Date.now() + 60_000).toISOString() }] : []);
  }

  if (table === "lexride_accounts" && method === "GET") {
    const account = accounts.get(params.get("id")?.slice(3) || "");
    return json(account ? [{ id: account.id, full_name: account.full_name, sex: account.sex }] : []);
  }

  throw new Error(`Unexpected mock request: ${method} ${url}`);
};

async function callRideApi(method, path, token, body) {
  const response = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(data) { this.body = data; return this; },
  };
  await rideHandler({
    method,
    query: { path: path.split("/") },
    headers: { cookie: token ? `lexride_session=${encodeURIComponent(token)}` : "" },
    body,
  }, response);
  return response;
}

async function callChatMessageApi(tripId, token, body) {
  const response = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(data) { this.body = data; return this; },
  };
  await chatMessageHandler({
    method: "POST",
    query: {},
    headers: { cookie: token ? `lexride_session=${encodeURIComponent(token)}` : "" },
    body: { tripId, ...body },
  }, response);
  return response;
}

const created = await createRide({
  fromLabel: "Apaasi",
  toLabel: "KNUST",
  date: "2026-09-29",
  time: "12:08",
  seats: 3,
  creatorName: "Trip Host",
  creatorSex: "Male",
  creatorAccountId: "host-1",
});
assert.ok(trips.some((trip) => trip.id === created.id), "trip room is created with the trip");
assert.ok(created.messages.some((message) => message.sender === "LexRide" && message.text.includes("Trip group created")), "new group is initialized with a welcome message");
assert.equal(await canAccessTripChat(created.id, "host-1"), true, "host has group access immediately");
assert.equal(await canAccessTripChat("missing-trip", "passenger-1"), false, "unknown trips do not grant chat access");
console.log("PASS: trip creation initializes the host’s in-app group chat");

members.push({
  id: "request-1",
  trip_id: created.id,
  account_id: "passenger-1",
  name: "Approved Passenger",
  sex: "Female",
  status: "Waiting",
  joined_at: new Date().toISOString(),
});
assert.equal(await canAccessTripChat(created.id, "passenger-1"), false, "waiting passengers are not group members yet");
const pendingJoinResponse = await joinRide(created.id, "Approved Passenger", "Female", "passenger-1");
assert.ok(!("error" in pendingJoinResponse));
assert.deepEqual(pendingJoinResponse.joined.map((member) => member.id), ["request-1"], "waiting users receive only their own request row");
assert.deepEqual(pendingJoinResponse.messages, [], "waiting users do not receive chat history in a join response");
const waitingRead = await callRideApi("GET", created.id, "passenger-token");
assert.deepEqual(waitingRead.body.joined, [], "waiting passengers cannot enumerate member details");
assert.equal(waitingRead.body.activeMemberCount, 1, "waiting passengers retain the public occupancy count");
assert.equal(waitingRead.body.messages.length, 0, "waiting passengers cannot read group messages");
const blockedSend = await callChatMessageApi(created.id, "passenger-token", { text: "Too early" });
assert.equal(blockedSend.statusCode, 403, "waiting passengers cannot post to the group");

const approvedRide = await setMemberStatus(created.id, "request-1", "Approved");
assert.ok(!("error" in approvedRide));
assert.equal(await canAccessTripChat(created.id, "passenger-1"), true, "approval automatically grants group membership");
const approvedRead = await callRideApi("GET", created.id, "passenger-token");
assert.equal(approvedRead.headers["cache-control"], "private, no-store", "account-specific group responses are never cached");
assert.ok(approvedRead.body.messages.some((message) => message.text.includes("Trip group created")), "approved passengers can read existing group history");
members.push({ id: "request-2", trip_id: created.id, account_id: "passenger-2", name: "Private Pending Person", sex: "Male", status: "Waiting", joined_at: new Date().toISOString() });
const approvedReadWithPending = await callRideApi("GET", created.id, "passenger-token");
assert.deepEqual(approvedReadWithPending.body.joined.map((member) => member.id), ["request-1"], "approved passengers see approved group members but not pending requests");
const allowedSend = await callChatMessageApi(created.id, "passenger-token", { sender: "Spoofed name", text: "Hello group" });
assert.equal(allowedSend.statusCode, 200, "approved passenger can post");
assert.equal(allowedSend.headers["cache-control"], "private, no-store", "chat message responses are not cached");
const sentMessage = allowedSend.body.messages.at(-1);
assert.equal(sentMessage.sender, "Approved Passenger", "message sender comes from the signed-in account, not the request body");
  assert.equal(sentMessage.senderSex, "Female");
  assert.equal(messageWriteAuthHeaders.at(-1), `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "approved chat messages are persisted with the server role after access checks");
  assert.ok(databaseAuthHeaders.every((header) => header === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`), "all server-side trip queries and writes use the service role");
  const anonymousSend = await callChatMessageApi(created.id, undefined, { text: "Anonymous" });
assert.equal(anonymousSend.statusCode, 401, "anonymous users cannot post to a group");
console.log("PASS: approval grants chat access; unapproved and anonymous users are blocked");

const publicRead = await callRideApi("GET", created.id, undefined);
assert.deepEqual(publicRead.body.messages, [], "public trip details never expose private group messages");
assert.deepEqual(publicRead.body.joined, [], "public trip details never expose passenger names or request statuses");
assert.equal(publicRead.body.activeMemberCount, 2, "public trip details expose only the occupancy count");
const hostRead = await callRideApi("GET", created.id, "host-token");
assert.ok(hostRead.body.messages.some((message) => message.text === "Hello group"), "the host can read the group chat");
assert.ok(hostRead.body.joined.some((member) => member.id === "request-2"), "the host can still see pending requests");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
await assert.rejects(() => supabaseRequest("lexride_trip_rooms"), /Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/, "the public anon key is never used as a fallback");
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
assert.ok(databaseAuthHeaders.length > 0 && databaseAuthHeaders.every((header) => header === `Bearer ${serviceRoleKey}`), "all server-side trip and auth queries use the service role");
console.log("PASS: chat history stays private to the host and approved passengers");
console.log("PASS: public and pending responses redact member details; only server-role database access is used");
