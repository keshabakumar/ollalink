import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Ollalink",
  description: "Ollalink terms of service.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24">
      <h1 className="font-departure text-3xl">Terms of Service</h1>
      <p className="mt-4 text-sm text-primary/60">
        Last updated: August 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-primary/80">
        <p>
          By accessing or using Ollalink (“the Service”), you agree to be bound by these Terms
          of Service. If you do not agree, do not use the Service.
        </p>

        <h2 className="font-medium text-primary">1. Use of the Service</h2>
        <p>
          You may use Ollalink to manage devices, run jobs, store files, and collaborate with
          team members. You must comply with all applicable laws and not use the Service for
          illegal, harmful, or abusive activities.
        </p>

        <h2 className="font-medium text-primary">2. Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activity that occurs under your account. You must provide accurate and
          complete information when creating an account.
        </p>

        <h2 className="font-medium text-primary">3. Workspaces and data</h2>
        <p>
          Workspaces are owned by the user who creates them. Invited members may access data
          according to the role assigned to them. You are responsible for the data you upload
          and the actions performed by your devices and team members.
        </p>

        <h2 className="font-medium text-primary">4. Payments and subscriptions</h2>
        <p>
          Some features require a paid subscription. Fees are billed in advance and are
          non-refundable unless otherwise required by law. You may cancel your subscription at
          any time from the billing settings.
        </p>

        <h2 className="font-medium text-primary">5. Limitation of liability</h2>
        <p>
          Ollalink is provided “as is” without warranties of any kind. To the maximum extent
          permitted by law, we are not liable for indirect, incidental, or consequential
          damages arising from your use of the Service.
        </p>

        <h2 className="font-medium text-primary">6. Termination</h2>
        <p>
          We may suspend or terminate your access if you violate these terms. You may delete
          your account at any time from the dashboard.
        </p>

        <h2 className="font-medium text-primary">7. Changes</h2>
        <p>
          We may update these terms from time to time. Continued use of the Service after changes
          constitutes acceptance of the new terms.
        </p>

        <p>
          For questions, contact{" "}
          <a href="mailto:hello@ollalink.io" className="underline">
            hello@ollalink.io
          </a>
          .
        </p>
      </div>
    </div>
  );
}
