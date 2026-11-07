// Educational line drawing of a torso with one organ highlighted.
// The patient faces the viewer, so the patient's right side is on the viewer's left.
export type Organ = "liver" | "heart" | "spine";

export function organFrom(text: string): Organ | null {
  if (/liver|hepat|foie/i.test(text)) return "liver";
  if (/heart|cardi|blood pressure|c(oe|œ)ur/i.test(text)) return "heart";
  if (/spine|vertebr|back|colonne|rachis/i.test(text)) return "spine";
  return null;
}

const INK = "#1A2530";
const ACCENT = "#1F5C4D";

const LABEL: Record<Organ, { text: string; from: [number, number]; to: [number, number] }> = {
  liver: { text: "liver", from: [150, 140], to: [236, 140] },
  heart: { text: "heart", from: [158, 106], to: [236, 106] },
  spine: { text: "spine", from: [136, 196], to: [236, 196] },
};

export function OrganFigure({ organ }: { organ: Organ }) {
  const l = LABEL[organ];
  return (
    <svg
      viewBox="0 0 280 320"
      className="w-56 max-w-full"
      role="img"
      aria-label={`Line drawing of a torso with the ${organ} highlighted`}
    >
      {/* Body outline */}
      <path
        d="M112 14 C112 34 108 42 88 50 C62 58 44 68 40 96 L44 176 C46 208 56 232 60 256 C63 278 58 296 56 312 M168 14 C168 34 172 42 192 50 C218 58 236 68 240 96 L236 176 C234 208 224 232 220 256 C217 278 222 296 224 312"
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Collarbones */}
      <path d="M86 62 C104 70 122 66 138 70 M194 62 C176 70 158 66 142 70" fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
      {/* Ribs (faint) */}
      <g fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="1.2" strokeLinecap="round">
        {[86, 102, 118, 134, 150].map((y, i) => (
          <g key={y}>
            <path d={`M136 ${y} C${112 - i * 2} ${y - 4} ${78 - i} ${y + 6} ${66 - i} ${y + 22}`} />
            <path d={`M144 ${y} C${168 + i * 2} ${y - 4} ${202 + i} ${y + 6} ${214 + i} ${y + 22}`} />
          </g>
        ))}
        {/* Lower rib edge */}
        <path d="M62 176 C90 168 118 150 140 136 C162 150 190 168 218 176" strokeOpacity="0.3" />
      </g>
      {/* Navel */}
      <circle cx="140" cy="236" r="2" fill={INK} fillOpacity="0.35" />

      {/* Highlighted organ */}
      {organ === "liver" && (
        <path
          d="M64 132 C84 114 132 110 166 120 C176 123 177 132 168 137 C150 147 126 160 102 170 C86 176 70 172 65 160 C61 150 60 140 64 132 Z"
          fill={ACCENT}
          fillOpacity="0.2"
          stroke={ACCENT}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {organ === "heart" && (
        <path
          d="M122 90 C132 78 156 82 161 96 C164 108 162 122 157 135 C142 129 124 117 118 104 C116 97 117 93 122 90 Z"
          fill={ACCENT}
          fillOpacity="0.2"
          stroke={ACCENT}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {organ === "spine" && (
        <g fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeWidth="1.4">
          {Array.from({ length: 13 }, (_, i) => (
            <rect key={i} x="132" y={58 + i * 15} width="16" height="11" rx="3" />
          ))}
        </g>
      )}

      {/* Label */}
      <path d={`M${l.from[0]} ${l.from[1]} L${l.to[0]} ${l.to[1]}`} stroke={ACCENT} strokeWidth="1" />
      <circle cx={l.from[0]} cy={l.from[1]} r="2" fill={ACCENT} />
      <text x={l.to[0] + 4} y={l.to[1] + 4} fontSize="13" fontFamily="Inter Variable, Inter, sans-serif" fill={ACCENT}>
        {l.text}
      </text>
    </svg>
  );
}
