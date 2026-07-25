/**
 * Registration mark — the crosshair printed on a press sheet to align
 * colour plates. Used once per panel heading as the section marker.
 */
export function RegistrationMark({ size = 12 }: { size?: number }) {
  const half = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <circle
        cx={half}
        cy={half}
        r={half - 3}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <line x1={half} y1="0" x2={half} y2={size} stroke="currentColor" strokeWidth="1" />
      <line x1="0" y1={half} x2={size} y2={half} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
