import { Github, Twitter } from "lucide-react";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-12">
      <div className="mx-auto max-w-screen-xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-medium">Ollalink</p>
            <p className="mt-2 text-sm text-primary/60">
              Device management, jobs, and audit for teams.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Product</p>
              <a
                href="/#features"
                className="block text-primary/60 hover:text-primary"
              >
                Features
              </a>
              <a
                href="/#pricing"
                className="block text-primary/60 hover:text-primary"
              >
                Pricing
              </a>
              <a
                href="/#faq"
                className="block text-primary/60 hover:text-primary"
              >
                FAQ
              </a>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Legal</p>
              <a
                href="/privacy"
                className="block text-primary/60 hover:text-primary"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="block text-primary/60 hover:text-primary"
              >
                Terms
              </a>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/ollalink/ollalink"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/60 hover:text-primary"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/ollalink"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/60 hover:text-primary"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
            <p className="text-xs text-primary/50">
              © {YEAR} Ollalink. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
