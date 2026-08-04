"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { SubscribeForm } from "./subscribe-form";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="absolute top-0 w-full flex items-center justify-between p-4 z-10">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="Ollalink logo"
          width={32}
          height={32}
          quality={100}
        />
        <span className="hidden md:block text-sm font-medium">Ollalink</span>
      </Link>

      <nav className="hidden md:flex items-center gap-6 text-sm text-primary/70">
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="hover:text-primary transition-colors"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <nav className="md:mt-2">
        <ul className="flex items-center gap-3">
          <li>
            <a
              href={process.env.NEXT_PUBLIC_APP_URL}
              className="text-sm px-4 py-2 bg-primary text-secondary rounded-full font-medium"
            >
              Sign in
            </a>
          </li>
          <li>
            <a
              href="https://github.com/ollalink/ollalink"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 border border-border rounded-full font-medium hover:bg-primary/5"
            >
              GitHub
            </a>
          </li>
          <li>
            <Dialog>
              <DialogTrigger
                className="text-sm px-4 py-2 bg-secondary text-primary rounded-full font-medium cursor-pointer"
                asChild
              >
                <span>Get updates</span>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Stay updated</DialogTitle>
                  <DialogDescription>
                    Subscribe to our newsletter to get the latest news and updates.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                  <SubscribeForm
                    group="ollalink-newsletter"
                    placeholder="Email address"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </li>
        </ul>
      </nav>
    </header>
  );
}
