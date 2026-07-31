import polar from "@convex-dev/polar/convex.config";
import crons from "./crons";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(polar);
app.use(crons);

export default app;
