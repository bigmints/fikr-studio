"use client"

export function MobileWall() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-8 text-center md:hidden" style={{ paddingBottom: "15vh" }}>
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5">
        <img src="logo-icon.png" alt="FikrPad" className="h-6 w-6 object-contain" />
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          FikrPad
        </span>
      </div>

      {/* Message */}
      <p className="mb-3 max-w-xs text-base font-medium text-foreground">
        Spatial thinking needs space.
      </p>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        FikrPad is built for large screens. Open it on a desktop or laptop browser to get the full experience.
      </p>
    </div>
  )
}
