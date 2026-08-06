import { CalEmbed } from "@/components/cal-embed";
import type { Metadata } from "next";

// Force dynamic rendering — CalEmbed loads an external script that breaks
// static page data collection during `next build`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talk to us — Ollalink",
  description: "Book a demo or contact the Ollalink team.",
};

export default function Page() {
  // Read directly from process.env to avoid the t3-env validation throwing
  // during static page data collection when NEXT_PUBLIC_CAL_LINK is unset.
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-32 pb-24">
      <div className="max-w-2xl text-center">
        <h1 className="font-departure text-3xl md:text-4xl">Talk to us</h1>
        <p className="mt-4 text-primary/60">
          Book a demo or reach out to{" "}
          <a href="mailto:hello@ollalink.io" className="underline">
            hello@ollalink.io
          </a>
          .
        </p>
      </div>

      {calLink ? (
        <div className="mt-12 w-full max-w-4xl">
          <CalEmbed calLink={calLink} />
        </div>
      ) : (
        <div className="mt-12 w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-primary/60">
            Calendar booking is not configured yet. Email us directly and we will set up a
            time.
          </p>
          <a
            href="mailto:hello@ollalink.io"
            className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-secondary"
          >
            Email hello@ollalink.io
          </a>
        </div>
      )}
    </div>
  );
}
