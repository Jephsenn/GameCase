export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2 items-center justify-center overflow-hidden bg-neutral-950 p-12">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-neutral-950 to-fuchsia-950/40" />

        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute top-1/4 left-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-fuchsia-500/10 blur-[80px]" />

        {/* Subtle grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-md space-y-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl font-black text-white shadow-2xl shadow-violet-500/30">
              G
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Game<span className="text-violet-400">Case</span>
            </h1>
          </div>
          <p className="text-lg leading-relaxed text-neutral-300">
            Your personal game library. Track what you&apos;ve played, discover
            what to play next, and share your gaming journey.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              Track &amp; organize
            </span>
            <span className="flex items-center gap-2 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-300">
              <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
              Get recommendations
            </span>
            <span className="flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-4 py-2 text-sm text-pink-300">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              All platforms
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-6 pt-2">
            <div>
              <p className="text-2xl font-bold text-white">500K+</p>
              <p className="text-xs text-neutral-500">Games Tracked</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">1M+</p>
              <p className="text-xs text-neutral-500">Library Entries</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">50K+</p>
              <p className="text-xs text-neutral-500">Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        {/* Subtle ambient glow for form side */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/5 blur-[100px]" />
        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl font-black text-white shadow-lg shadow-violet-500/25">
              G
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Game<span className="text-violet-400">Case</span>
            </h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
