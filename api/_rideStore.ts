import { randomBytes } from "crypto";

export interface SharedRideJoiner {
  id: string;
  firstName: string;
  joinedAt: number;
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
}

// NOTE: in-memory only. On Vercel each serverless function instance has its
// own memory, and instances are recycled/cold-started, so a ride created on
// one instance may not be visible from another. This is fine for a demo with
// a handful of requests close together, but it WILL drop data unpredictably
// under real, spread-out usage. Before relying on this for real users, swap
// this file for a real store (Vercel KV, Upstash Redis, or a Postgres table)
// behind the same get/create/join functions.
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
  return ride;
}
