import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every 60s, mark devices offline if they haven't heartbeated in 90s.
crons.interval(
  "markStaleDevicesOffline",
  { seconds: 60 },
  internal.devices.markStaleDevicesOffline,
  {},
);

export default crons;