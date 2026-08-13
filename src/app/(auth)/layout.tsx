import { Logo } from "@/components/logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-surface-muted">
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex justify-center mb-8">
            <Logo />
          </Link>
          {children}
        </div>
      </div>
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative z-10 max-w-md px-10 text-white">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">Never miss a domain renewal again.</h2>
          <p className="mt-4 text-indigo-100 text-balance">
            Domiify tracks every domain you own, warns you well before expiry, and keeps a complete record of every
            renewal payment — so your business, portfolio, and projects stay online.
          </p>
          <div className="mt-10 space-y-4">
            {[
              "Smart, multi-stage expiry reminders",
              "One-click renewal workflow",
              "Full payment history & analytics",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-indigo-50">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
