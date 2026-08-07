import polar from "@convex-dev/polar/convex.config";
import crons from "./crons";
import { defineApp } from "convex/server";

const app = defineApp({ crons });
app.use(polar);

export default app;
