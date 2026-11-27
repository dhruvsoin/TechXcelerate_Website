/** A gliding raven silhouette. Wings flap slowly via CSS (see .raven-wing in globals.css). */
export default function Raven({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 100" aria-hidden="true" focusable="false">
      <g fill="#0b0f1a">
        <path
          className="raven-wing raven-wing-l"
          d="M100,50 C84,36 58,26 14,30 L26,35 L12,39 L28,42 L18,46 L34,48 L28,52 L46,52 C66,54 86,57 100,58 Z"
        />
        <path
          className="raven-wing raven-wing-r"
          d="M100,50 C116,36 142,26 186,30 L174,35 L188,39 L172,42 L182,46 L166,48 L172,52 L154,52 C134,54 114,57 100,58 Z"
        />
        <path d="M100,40 C106,44 107,58 104,66 L109,79 L100,75 L91,79 L96,66 C93,58 94,44 100,40 Z" />
        <circle cx="100" cy="41" r="5" />
        <path d="M98,37 L100,30 L102,37 Z" />
      </g>
    </svg>
  );
}
