export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-violet-950 via-neutral-950 to-neutral-950 p-12">
        <div className="max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold text-white">
              G
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Game<span className="text-violet-400">Tracker</span>
            </h1>
          </div>
          <p className="text-lg text-neutral-400 leading-relaxed">
            Your personal game library. Track what you&apos;ve played, discover
            what to play next, and share your gaming journey.
          </p>
          <div className="flex gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              Track &amp; organize
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
              Get recommendations
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-pink-500" />
              All platforms
            </span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl font-bold text-white">
              G
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Game<span className="text-violet-400">Tracker</span>
            </h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
