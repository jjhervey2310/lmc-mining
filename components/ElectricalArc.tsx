'use client'

export default function ElectricalArc() {
  return (
    <svg
      className="electrical-arc-overlay pointer-events-none absolute inset-0 w-full h-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Arc 1 — top-left corner region */}
      <polyline
        className="arc arc-1"
        points="42,0 58,18 44,31 67,48 50,62 79,80 63,95"
        fill="none"
        stroke="rgba(160,224,255,0.85)"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arc 2 — top-right area */}
      <polyline
        className="arc arc-2"
        points="1280,0 1264,22 1290,38 1271,52 1295,71 1278,88 1301,104"
        fill="none"
        stroke="rgba(255,200,100,0.75)"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arc 3 — left edge, mid-height */}
      <polyline
        className="arc arc-3"
        points="0,310 24,325 8,341 31,357 12,374 38,390 18,407"
        fill="none"
        stroke="rgba(200,240,255,0.7)"
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arc 4 — right edge, lower */}
      <polyline
        className="arc arc-4"
        points="1440,520 1418,537 1436,553 1411,568 1432,584 1414,601 1438,618"
        fill="none"
        stroke="rgba(247,180,80,0.7)"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arc 5 — bottom-right diagonal */}
      <polyline
        className="arc arc-5"
        points="1380,900 1358,878 1374,862 1349,844 1368,826 1343,808 1360,790"
        fill="none"
        stroke="rgba(180,230,255,0.65)"
        strokeWidth="0.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
