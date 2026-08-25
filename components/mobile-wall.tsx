"use client"

export function MobileWall() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-8 text-center min-[900px]:hidden" style={{ paddingBottom: "15vh" }}>
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5">
        <img src="./logo-icon.png" alt="Fikr" className="h-6 w-6 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Fikr
        </span>
      </div>

      {/* Message */}
      <p className="mb-3 max-w-xs text-base font-medium text-foreground">
        Fikr works best on a larger screen.
      </p>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        Widen this window or open the desktop app on a larger display.
      </p>
    </div>
  )
}
