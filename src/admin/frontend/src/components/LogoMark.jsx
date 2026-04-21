// Inline SVG brand mark — same geometry as public/favicon.svg.
// Replaces the U+2733 (eight-pointed black star) character, which iOS
// (Safari, Chrome iOS, WeChat) renders as a green emoji glyph regardless
// of CSS color. Inline SVG is stable across all platforms and stays in
// lockstep with the favicon.
export default function LogoMark({ size = 28, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <g transform="translate(16,16)" fill={color}>
        <rect x="-1.5" y="-13" width="3" height="26" rx="1.5" />
        <rect x="-1.5" y="-13" width="3" height="26" rx="1.5" transform="rotate(45)" />
        <rect x="-1.5" y="-13" width="3" height="26" rx="1.5" transform="rotate(90)" />
        <rect x="-1.5" y="-13" width="3" height="26" rx="1.5" transform="rotate(135)" />
      </g>
    </svg>
  )
}
