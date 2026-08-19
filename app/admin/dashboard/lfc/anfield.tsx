// Anfield under lights, drawn from scratch.
//
// Jacob: "I want it to look a lot like Anfield in the background." This is
// original CSS/SVG artwork evoking a floodlit night at the ground — packed red
// stands, the Kop behind the goal, four floodlight towers, a striped pitch —
// rather than a photograph, which would be someone else's copyright.

export default function AnfieldBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      {/* night sky over the ground */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #05060f 0%, #0b0410 45%, #1a0206 100%)' }} />

      {/* floodlight glow from the four corners */}
      {[
        { left: '6%', top: '-6%' }, { left: '30%', top: '-9%' },
        { left: '64%', top: '-9%' }, { left: '90%', top: '-6%' },
      ].map((p, i) => (
        <div key={i} className="absolute h-[70%] w-[26%] blur-2xl"
          style={{ ...p, background: 'radial-gradient(ellipse at top, rgba(255,250,220,0.22), rgba(255,250,220,0.06) 45%, transparent 72%)' }} />
      ))}

      <svg viewBox="0 0 1200 420" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="standRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a0a1c" />
            <stop offset="100%" stopColor="#C8102E" />
          </linearGradient>
          <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f5c2a" />
            <stop offset="100%" stopColor="#083d1b" />
          </linearGradient>
          <radialGradient id="lightPool" cx="50%" cy="0%" r="85%">
            <stop offset="0%" stopColor="rgba(255,255,240,0.20)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          {/* the crowd: thousands of tiny flecks of light in a sea of red */}
          <pattern id="crowd" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="url(#standRed)" />
            <circle cx="2" cy="2" r="0.9" fill="rgba(255,255,255,0.30)" />
            <circle cx="5.5" cy="4.5" r="0.7" fill="rgba(255,235,150,0.28)" />
            <circle cx="1" cy="5.5" r="0.6" fill="rgba(255,255,255,0.16)" />
          </pattern>
        </defs>

        {/* floodlight pylons */}
        {[70, 370, 830, 1130].map((x) => (
          <g key={x}>
            <rect x={x - 2} y="12" width="4" height="120" fill="#141420" />
            <rect x={x - 26} y="2" width="52" height="16" rx="2" fill="#1c1c28" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={x - 20 + i * 8} cy="10" r="3.4" fill="#fffbe6" opacity="0.95" />
            ))}
          </g>
        ))}

        {/* upper tier + the Kop, packed */}
        <path d="M0,120 L1200,120 L1200,205 L0,205 Z" fill="url(#crowd)" opacity="0.92" />
        <path d="M0,205 L1200,205 L1200,214 L0,214 Z" fill="#0a0a12" />
        {/* lower tier */}
        <path d="M0,214 L1200,214 L1200,272 L0,272 Z" fill="url(#crowd)" opacity="0.85" />

        {/* THE KOP across the stand front */}
        <text x="600" y="196" textAnchor="middle" fontSize="26" fontWeight="900" letterSpacing="14"
          fill="#F6EB61" opacity="0.5" fontFamily="system-ui, sans-serif">THE KOP</text>

        {/* advertising hoardings */}
        <rect x="0" y="272" width="1200" height="16" fill="#0d0d16" />
        <rect x="0" y="274" width="1200" height="12" fill="#C8102E" opacity="0.28" />

        {/* pitch, with mow stripes and markings */}
        <path d="M0,288 L1200,288 L1200,420 L0,420 Z" fill="url(#pitch)" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 120} y="288" width="60" height="132" fill="#ffffff" opacity="0.035" />
        ))}
        <rect x="0" y="288" width="1200" height="132" fill="url(#lightPool)" />
        {/* halfway line, centre circle, penalty box */}
        <line x1="600" y1="288" x2="600" y2="420" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        <ellipse cx="600" cy="420" rx="120" ry="46" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        <rect x="120" y="288" width="200" height="60" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
        <rect x="880" y="288" width="200" height="60" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
      </svg>

      {/* keep text readable over the artwork */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,2,6,0.35) 0%, rgba(10,2,6,0.72) 55%, rgba(10,2,6,0.92) 100%)' }} />
    </div>
  )
}
