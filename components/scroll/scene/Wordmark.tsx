import { LETTERS, SWASHES, WORDMARK_VIEWBOX } from "./wordmark-paths";

/**
 * Antique-copper wordmark, built as SVG:
 * copper/bronze gradient bands → botanical engraving with teal in the recesses →
 * hammered texture and weathering → bevel speculars → rim strokes → ambient shadow.
 * A second, unfiltered SVG on top carries the travelling light reflection.
 */
const [VX, VY, VW, VH] = WORDMARK_VIEWBOX;
const VB = `${VX} ${VY} ${VW} ${VH}`;

const C = {
  champagne: "#F5D8B0",
  copper: "#D49560",
  bronze: "#A66A3F",
  burnished: "#B87333",
  deep: "#56321F",
  teal: "#326C68",
  verdigris: "#244E4B",
  engraved: "#201B17",
};

function Shapes(props: React.SVGProps<SVGPathElement>) {
  return (
    <>
      <path d={LETTERS} {...props} />
      <path d={SWASHES} {...props} />
    </>
  );
}

export function Wordmark({ title, idPrefix = "wm" }: { title: string; idPrefix?: string }) {
  const id = idPrefix;
  return (
    <span className="wordmark" role="img" aria-label={title}>
      <svg viewBox={VB} className="wordmark-base" aria-hidden="true" focusable="false">
        <defs>
          {/* Copper bands, deliberately uneven */}
          <linearGradient id={`${id}-metal`} gradientUnits="userSpaceOnUse" x1="0" y1={VY + VH * 0.12} x2="0" y2={VY + VH * 0.86}>
            <stop offset="0" stopColor="#F2C892" />
            <stop offset="0.1" stopColor={C.copper} />
            <stop offset="0.3" stopColor={C.burnished} />
            <stop offset="0.45" stopColor={C.bronze} />
            <stop offset="0.52" stopColor="#6A3C20" />
            <stop offset="0.6" stopColor={C.burnished} />
            <stop offset="0.72" stopColor="#DE9A5C" />
            <stop offset="0.84" stopColor={C.copper} />
            <stop offset="1" stopColor={C.deep} />
          </linearGradient>
          <radialGradient id={`${id}-glint`} gradientUnits="userSpaceOnUse" cx={VX + VW * 0.14} cy={VY + VH * 0.3} r={VW * 0.22}>
            <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.45" />
            <stop offset="1" stopColor={C.champagne} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" x1="0" y1={VY + VH * 0.2} x2="0" y2={VY + VH * 0.85}>
            <stop offset="0" stopColor={C.champagne} stopOpacity="1" />
            <stop offset="0.45" stopColor={C.copper} stopOpacity="0.35" />
            <stop offset="1" stopColor={C.deep} stopOpacity="0.95" />
          </linearGradient>

          {/* Botanical engraving: vines, spirals and leaves; teal sits in the recesses */}
          <pattern id={`${id}-engrave`} width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(-8) scale(0.62)">
            <g fill="none" stroke={C.engraved} strokeWidth="1.5" strokeLinecap="round" opacity="0.62">
              <path d="M2 40 C14 30, 22 46, 32 34 S 50 20, 54 30" />
              <path d="M32 34 c-6 -2 -9 -9 -4 -13 c4 -3 9 0 7 5" />
              <path d="M14 33 c2 -8 10 -10 13 -6" />
              <path d="M44 22 c-1 -7 5 -12 10 -9" />
              <path d="M4 12 C12 6, 20 16, 28 8" />
              <path d="M28 8 c3 -4 8 -3 8 1 c0 3 -4 4 -5 1" />
            </g>
            <g fill={C.teal} opacity="0.55">
              <path d="M22 44 q5 -7 11 -1 q-6 5 -11 1 Z" />
              <path d="M46 34 q2 -7 9 -5 q-3 7 -9 5 Z" />
              <path d="M10 18 q4 -6 9 -2 q-5 5 -9 2 Z" />
            </g>
          </pattern>

          {/* Surface: weathering, hammering, patina, bevel and lower-edge shading */}
          <filter id={`${id}-surface`} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="3" result="weatherNoise" />
            <feDisplacementMap in="SourceGraphic" in2="weatherNoise" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="weathered" />
            <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="8" result="hammerNoise" />
            <feDiffuseLighting in="hammerNoise" surfaceScale="1.6" diffuseConstant="1.05" lightingColor="#fff" result="hammerLight">
              <feDistantLight azimuth="225" elevation="58" />
            </feDiffuseLighting>
            <feComposite in="weathered" in2="hammerLight" operator="arithmetic" k1="1.04" k2="0" k3="0" k4="0" result="hammered" />
            {/* scratches: thin streaks */}
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.6" numOctaves="2" seed="21" result="scratchNoise" />
            <feColorMatrix in="scratchNoise" type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.85  0 0 0 0 0.69  14 0 0 0 -11.6" result="scratches" />
            <feComposite in="scratches" in2="SourceAlpha" operator="in" result="scratchesIn" />
            {/* patina blotches in selected areas */}
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="11" result="patinaNoise" />
            <feColorMatrix in="patinaNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.6 0 0 0 -3.05" result="patinaMask" />
            <feFlood floodColor={C.verdigris} result="patinaColor" />
            <feComposite in="patinaColor" in2="patinaMask" operator="in" result="patinaShape" />
            <feComposite in="patinaShape" in2="SourceAlpha" operator="in" result="patina" />
            {/* bevel: speculars from a blurred alpha height map */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="height" />
            <feSpecularLighting in="height" surfaceScale="9" specularConstant="1.05" specularExponent="26" lightingColor={C.champagne} result="spec">
              <feDistantLight azimuth="235" elevation="40" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
            {/* darker bronze along lower edges */}
            <feOffset in="SourceAlpha" dy="-5" result="up" />
            <feComposite in="SourceAlpha" in2="up" operator="out" result="lowerEdge" />
            <feGaussianBlur in="lowerEdge" stdDeviation="0.9" result="lowerSoft" />
            <feFlood floodColor={C.deep} result="deepColor" />
            <feComposite in="deepColor" in2="lowerSoft" operator="in" result="lowerShade" />
            <feMerge result="layered">
              <feMergeNode in="hammered" />
              <feMergeNode in="patina" />
              <feMergeNode in="lowerShade" />
            </feMerge>
            <feComposite in="layered" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="lit" />
            <feComponentTransfer in="scratchesIn" result="scratchesSoft"><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feComposite in="scratchesSoft" in2="lit" operator="over" result="final" />
            <feComposite in="final" in2="SourceAlpha" operator="in" />
          </filter>

          {/* Ambient shadow behind the title */}
          <filter id={`${id}-shadow`} x="-5%" y="-15%" width="110%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="soft" />
            <feOffset in="soft" dy="10" result="softOff" />
            <feFlood floodColor="#06070a" floodOpacity="0.7" />
            <feComposite in2="softOff" operator="in" result="ambient" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="tight" />
            <feOffset in="tight" dx="1" dy="3" result="tightOff" />
            <feFlood floodColor="#120c08" floodOpacity="0.85" />
            <feComposite in2="tightOff" operator="in" result="contact" />
            <feMerge>
              <feMergeNode in="ambient" />
              <feMergeNode in="contact" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id={`${id}-clip`}>
            <path d={LETTERS} />
            <path d={SWASHES} />
          </clipPath>
        </defs>

        <g filter={`url(#${id}-shadow)`}>
          {/* raised outer edge */}
          <Shapes fill="none" stroke={C.engraved} strokeWidth="5.5" strokeLinejoin="round" />
          <Shapes fill="none" stroke={C.deep} strokeWidth="3" strokeLinejoin="round" />
          <g filter={`url(#${id}-surface)`}>
            <Shapes fill={`url(#${id}-metal)`} />
            <Shapes fill={`url(#${id}-glint)`} />
            <Shapes fill={`url(#${id}-engrave)`} opacity="0.85" />
          </g>
          {/* inner rim: champagne on top edges, bronze below */}
          <g clipPath={`url(#${id}-clip)`}>
            <Shapes fill="none" stroke={`url(#${id}-rim)`} strokeWidth="4.4" strokeLinejoin="round" />
          </g>
        </g>
      </svg>

      {/* Travelling reflection, kept unfiltered so it animates cheaply */}
      <svg viewBox={VB} className="wordmark-sheen" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff4e0" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff4e0" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff4e0" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-sheen-clip`}>
            <path d={LETTERS} />
            <path d={SWASHES} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-sheen-clip)`}>
          <rect className="wordmark-sheen-bar" x={VX - VW * 0.25} y={VY} width={VW * 0.16} height={VH} fill={`url(#${id}-sheen)`} />
        </g>
      </svg>
    </span>
  );
}

/** Symmetrical copper divider with botanical flourishes and a leaf emblem. */
export function WordmarkDivider({ idPrefix = "wd" }: { idPrefix?: string } = {}) {
  const half = (s: 1 | -1) => {
    const X = (x: number) => 500 + s * x;
    return (
      <g key={s}>
        {/* long tapered line */}
        <path d={`M${X(44)} 28.6 L${X(470)} 30 L${X(44)} 31.4 Z`} fill={`url(#${idPrefix}-metal)`} />
        {/* nodes along the line */}
        <path d={`M${X(200)} 30 l${s * 7} -4 l${s * 7} 4 l${-s * 7} 4 Z`} fill={`url(#${idPrefix}-metal)`} />
        <path d={`M${X(330)} 30 l${s * 5} -3 l${s * 5} 3 l${-s * 5} 3 Z`} fill={`url(#${idPrefix}-metal)`} />
        {/* botanical curls near the centre */}
        <path
          d={`M${X(26)} 30 C${X(40)} 18, ${X(62)} 16, ${X(78)} 24 C${X(90)} 30, ${X(104)} 30, ${X(116)} 26`}
          fill="none"
          stroke={`url(#${idPrefix}-metal)`}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d={`M${X(78)} 24 c${s * -6} -8 ${s * -2} -16 ${s * 6} -14 c${s * 6} 2 ${s * 5} 9 ${s * -1} 9`} fill="none" stroke={`url(#${idPrefix}-metal)`} strokeWidth="1.3" />
        <path d={`M${X(26)} 30 C${X(40)} 42, ${X(60)} 44, ${X(72)} 37`} fill="none" stroke={`url(#${idPrefix}-metal)`} strokeWidth="1.2" strokeLinecap="round" />
        <path d={`M${X(96)} 29 q${s * 8} -9 ${s * 16} -2 q${s * -8} 7 ${s * -16} 2 Z`} fill="#326C68" stroke={`url(#${idPrefix}-metal)`} strokeWidth="0.8" />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 1000 60" className="wordmark-divider" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${idPrefix}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5D8B0" />
          <stop offset="0.45" stopColor="#D49560" />
          <stop offset="0.75" stopColor="#B87333" />
          <stop offset="1" stopColor="#56321F" />
        </linearGradient>
        <filter id={`${idPrefix}-shadow`} x="-5%" y="-50%" width="110%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dy="2.5" result="s" />
          <feFlood floodColor="#06070a" floodOpacity="0.7" />
          <feComposite in2="s" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${idPrefix}-shadow)`} className="wordmark-divider-lines">
        {half(1)}
        {half(-1)}
      </g>
      <g filter={`url(#${idPrefix}-shadow)`} className="wordmark-divider-emblem">
        {/* leaf emblem inside a diamond frame */}
        <path d="M500 6 L522 30 L500 54 L478 30 Z" fill="none" stroke={`url(#${idPrefix}-metal)`} strokeWidth="2" />
        <path d="M500 12 C512 20, 512 40, 500 48 C488 40, 488 20, 500 12 Z" fill={`url(#${idPrefix}-metal)`} />
        <path d="M500 18 C506 24, 506 36, 500 42 C494 36, 494 24, 500 18 Z" fill="#244E4B" />
        <path d="M500 19 L500 41" stroke="#F5D8B0" strokeWidth="0.9" strokeOpacity="0.8" />
        <circle cx="470" cy="30" r="2.4" fill={`url(#${idPrefix}-metal)`} />
        <circle cx="530" cy="30" r="2.4" fill={`url(#${idPrefix}-metal)`} />
      </g>
    </svg>
  );
}
