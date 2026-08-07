import { AnimatedText } from "@/components/animated-text";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import {
  Boxes,
  Check,
  Cpu,
  FileText,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: Cpu,
    title: "Remote devices",
    description:
      "Register, pair, and monitor your Windows agents from a single dashboard. See status, queue work, and audit every interaction.",
  },
  {
    icon: ListChecks,
    title: "Background jobs",
    description:
      "Schedule and run durable jobs across your fleet. Convex guarantees at-least-once execution with automatic retries and visibility.",
  },
  {
    icon: Boxes,
    title: "Multi-tenant workspaces",
    description:
      "Create workspaces for each team or customer, invite members with roles, and keep data and audit trails isolated by design.",
  },
  {
    icon: ShieldCheck,
    title: "Audit & security",
    description:
      "Every action is logged. Know who ran what, when, and on which device. Built for teams that need to stay compliant.",
  },
  {
    icon: FileText,
    title: "Files & storage",
    description:
      "Upload, store, and route files through jobs. Convex storage and backend functions handle the heavy lifting securely.",
  },
  {
    icon: Users,
    title: "Team management",
    description:
      "Invite colleagues, assign roles, and manage access from one workspace. Add billing and API keys when you are ready to scale.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$0",
    description: "For individuals and small teams getting started.",
    features: [
      "1 workspace",
      "Up to 5 devices",
      "1,000 jobs / month",
      "7-day audit history",
      "Community support",
    ],
    cta: "Get started",
    href: process.env.NEXT_PUBLIC_APP_URL,
  },
  {
    name: "Team",
    price: "$49",
    interval: "/month",
    description: "For growing teams that need more devices and history.",
    features: [
      "Unlimited workspaces",
      "Up to 50 devices",
      "50,000 jobs / month",
      "90-day audit history",
      "Email support",
      "API keys & webhooks",
    ],
    cta: "Start trial",
    href: process.env.NEXT_PUBLIC_APP_URL,
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For organizations with compliance and scale needs.",
    features: [
      "Unlimited everything",
      "Self-hosted option",
      "SSO & SCIM",
      "Custom retention",
      "SLA & dedicated support",
    ],
    cta: "Contact sales",
    href: "mailto:hello@ollalink.io",
  },
];

const FAQ = [
  {
    question: "What is Ollalink?",
    answer:
      "Ollalink is a multi-tenant operations platform that lets teams manage remote devices, run background jobs, store files, and keep a complete audit trail in one place.",
  },
  {
    question: "Can I self-host Ollalink?",
    answer:
      "Yes. The backend is built on Convex, and the repository includes self-hosted deployment scripts with Docker, Cloudflare tunnel, and self-hosted observability via GlitchTip.",
  },
  {
    question: "What devices are supported?",
    answer:
      "The Windows agent is the first supported client. It pairs with a workspace, executes jobs, and reports status back to the dashboard in real time.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The Starter plan is free for individuals and small teams. Upgrade when you need more devices, jobs, or retention.",
  },
];

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-32 text-center">
        <div className="absolute -top-[118px] inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(1000px)_rotateX(-63deg)] h-[80%] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent pointer-events-none -z-10" />

        <h1 className="font-departure text-[40px] md:text-[72px] relative z-10 max-w-4xl leading-tight">
          <AnimatedText text="Manage devices, run jobs, and audit everything" />
        </h1>

        <p className="relative z-10 mt-6 max-w-2xl text-lg text-primary/70 md:text-xl">
          Ollalink is a multi-tenant workspace for remote device fleets, background jobs, and
          secure audit trails. Built for teams that need to see and control their operations.
        </p>

        <div className="relative z-10 mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href={process.env.NEXT_PUBLIC_APP_URL}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-secondary transition-colors hover:bg-primary/90"
          >
            Get started
          </a>
          <a
            href="https://github.com/ollalink/ollalink"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-primary/5"
          >
            View on GitHub
          </a>
        </div>

        <div className="absolute -bottom-[280px] inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4.5rem_2rem] -z-10 [transform:perspective(560px)_rotateX(63deg)] pointer-events-none" />
        <div className="absolute w-full bottom-[100px] h-1/2 bg-gradient-to-b from-background to-transparent pointer-events-none -z-10" />
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-24">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-16 text-center">
            <h2 className="font-departure text-3xl md:text-4xl">
              Everything you need to operate at scale
            </h2>
            <p className="mt-4 text-primary/60">
              Devices, jobs, files, workspaces, and audit — integrated out of the box.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/20"
              >
                <feature.icon className="h-6 w-6 text-primary/70" />
                <h3 className="mt-4 font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm text-primary/60">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials (example placeholders) */}
      <section className="border-y border-border bg-secondary/50 px-4 py-24 dark:bg-black/50">
        <div className="mx-auto max-w-screen-xl">
          <p className="mb-12 text-center text-sm font-medium uppercase tracking-wide text-primary/50">
            Trusted by operations teams (examples)
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                quote:
                  "Ollalink replaced three separate tools for us. We can finally see device status, job history, and audit in one place.",
                author: "Alex Chen",
                role: "Platform Engineer, Example Corp",
              },
              {
                quote:
                  "The self-hosted option was critical. We deployed to our own infrastructure and kept full control over our data.",
                author: "Jordan Smith",
                role: "Security Lead, Sample Inc",
              },
              {
                quote:
                  "Background jobs are reliable. We stopped worrying about failed scripts on remote machines.",
                author: "Taylor Rivera",
                role: "DevOps Manager, Demo Co",
              },
            ].map((t) => (
              <div
                key={t.author}
                className="rounded-xl border border-border bg-background p-6"
              >
                <p className="text-sm leading-relaxed text-primary/80">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4">
                  <p className="text-sm font-medium">{t.author}</p>
                  <p className="text-xs text-primary/50">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-24">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-16 text-center">
            <h2 className="font-departure text-3xl md:text-4xl">Simple pricing</h2>
            <p className="mt-4 text-primary/60">
              Start free. Upgrade when you need more scale.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.highlighted
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="mt-2 font-departure text-4xl">
                  {plan.price}
                  {plan.interval && (
                    <span className="text-base font-sans text-primary/50">
                      {plan.interval}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-sm text-primary/60">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-primary/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`mt-8 block rounded-full px-4 py-2 text-center text-sm font-medium ${
                    plan.highlighted
                      ? "bg-primary text-secondary hover:bg-primary/90"
                      : "border border-border hover:bg-primary/5"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-y border-border bg-secondary/50 px-4 py-24 dark:bg-black/50">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-16 text-center">
            <h2 className="font-departure text-3xl md:text-4xl">Questions & answers</h2>
            <p className="mt-4 text-primary/60">
              Everything you need to know before getting started.
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-border bg-background p-6"
              >
                <h3 className="font-medium">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary/60">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 text-center">
        <h2 className="font-departure text-3xl md:text-4xl">
          Ready to streamline your operations?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary/60">
          Start free today, or contact us for a self-hosted enterprise trial.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={process.env.NEXT_PUBLIC_APP_URL}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-secondary transition-colors hover:bg-primary/90"
          >
            Get started free
          </a>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="mailto:hello@ollalink.io"
                  className="rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-primary/5"
                >
                  Contact sales
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                hello@ollalink.io
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </section>
    </main>
  );
}
