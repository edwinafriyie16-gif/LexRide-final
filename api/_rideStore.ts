import { randomBytes } from "crypto";

export interface SharedRideJoiner {
  id: string;
  firstName: string;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  createdAt: number;
}

export interface SharedRide {
  id: string;
  fromLabel: string;
  toLabel: string;
  toLat?: number;
  toLng?: number;
  time: string;
  seats: number;
  platform: string;
  creatorName: string;
  createdAt: number;
  joined: SharedRideJoiner[];
  messages: ChatMessage[];
}

// NOTE: in-memory only. On Vercel each serverless function instance has its
// own memory, and instances are recycled/cold-started, so a ride created on
// one instance may not be visible from another. This is fine for a demo with
// a handful of requests close together, but it WILL drop data unpredictably
// under real, spread-out usage. Before relying on this for real users, swap
// this file for a real store (Supabase, Vercel KV, Upstash Redis) behind the
// same get/create/join/addMessage functions.
const sharedRides = new Map<string, SharedRide>();

export function makeRideId(): string {
  return randomBytes(4).toString("hex");
}

export function createRide(input: {
  fromLabel: string;
  toLabel: string;
  toLat?: number;
  toLng?: number;
  time: string;
  seats?: number;
  platform?: string;
  creatorName: string;
}): SharedRide {
  const id = makeRideId();
  const ride: SharedRide = {
    id,
    fromLabel: input.fromLabel,
    toLabel: input.toLabel,
    toLat: input.toLat,
    toLng: input.toLng,
    time: input.time,
    seats: Number(input.seats) || 3,
    platform: input.platform || "Bolt",
    creatorName: input.creatorName,
    createdAt: Date.now(),
    joined: [],
    messages: [],
  };
  sharedRides.set(id, ride);
  return ride;
}

export function getRide(id: string): SharedRide | undefined {
  return sharedRides.get(id);
}

export function joinRide(id: string, firstName: string): SharedRide | { error: string; status: number } {
  const ride = sharedRides.get(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  if (ride.joined.length >= ride.seats) return { error: "Ride is full", status: 409 };
  ride.joined.push({ id: makeRideId(), firstName, joinedAt: Date.now() });
  ride.messages.push({
    id: makeRideId(),
    sender: "System",
    text: `${firstName} joined the ride 🎉`,
    createdAt: Date.now(),
  });
  return ride;
}

export function addMessage(id: string, sender: string, text: string): SharedRide | { error: string; status: number } {
  const ride = sharedRides.get(id);
  if (!ride) return { error: "Ride not found", status: 404 };
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return { error: "Message is empty", status: 400 };
  ride.messages.push({ id: makeRideId(), sender: sender.slice(0, 40), text: trimmed, createdAt: Date.now() });
  return ride;
}
