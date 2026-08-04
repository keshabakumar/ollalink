import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Ollalink",
  description: "Ollalink privacy policy.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24">
      <h1 className="font-departure text-3xl">Privacy Policy</h1>
      <p className="mt-4 text-sm text-primary/60">
        Last updated: August 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-primary/80">
        <p>
          Ollalink (“we”, “us”, or “our”) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, and safeguard your information
          when you use our website and services.
        </p>

        <h2 className="font-medium text-primary">1. Information we collect</h2>
        <p>
          We collect account information (name, email, password), workspace and device data,
          job execution logs, audit events, and files you upload. We also collect standard
          analytics data such as page views and interactions to improve the product.
        </p>

        <h2 className="font-medium text-primary">2. How we use information</h2>
        <p>
          We use your information to provide and improve the service, authenticate users,
          manage workspaces and devices, process jobs, send transactional emails, and maintain
          security and audit trails.
        </p>

        <h2 className="font-medium text-primary">3. Data sharing</h2>
        <p>
          We do not sell your personal data. We may share data with subprocessors such as
          hosting providers, email delivery services, and payment processors only as needed
          to operate the service.
        </p>

        <h2 className="font-medium text-primary">4. Security</h2>
        <p>
          We use encryption in transit, hashed passwords, role-based access control, and
          detailed audit logs. No system is completely secure, and we encourage you to use
          strong passwords and two-factor authentication where available.
        </p>

        <h2 className="font-medium text-primary">5. Your rights</h2>
        <p>
          You may access, update, or delete your account and workspace data from the dashboard.
          For other requests, contact us at hello@ollalink.io.
        </p>

        <h2 className="font-medium text-primary">6. Changes</h2>
        <p>
          We may update this policy as the service evolves. We will notify users of material
          changes through the dashboard or by email.
        </p>

        <p>
          If you have questions about this policy, please contact us at{" "}
          <a href="mailto:hello@ollalink.io" className="underline">
            hello@ollalink.io
          </a>
          .
        </p>
      </div>
    </div>
  );
}
