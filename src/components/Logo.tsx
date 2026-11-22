interface LogoProps {
  height?: number;
  variant?: 'full' | 'mark';
  className?: string;
  title?: string;
  tone?: 'light' | 'dark';
}

const NAVY = '#1B2A4A';
const BEIGE = '#E8D5B7';

export function Logo({
  height = 32,
  variant = 'full',
  className = '',
  title = 'Keen Node',
  tone = 'light',
}: LogoProps) {
  const markSize = height;
  const gap = Math.round(height * 0.28);
  const wordSize = Math.round(height * 0.52);
  const wordWeight = 700;
  const letterSpacing = '-0.02em';
  const fullWidth = markSize + gap + Math.round(wordSize * 5.2);
  const fg = tone === 'light' ? BEIGE : NAVY;
  const accent = tone === 'light' ? NAVY : BEIGE;

  if (variant === 'mark') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={markSize}
        height={markSize}
        role="img"
        aria-label={title}
        className={className}
        focusable="false"
      >
        <title>{title}</title>
        <rect width="64" height="64" rx="14" fill={fg} />
        <path
          d="M18 46V18h6v12.5L34 18h7.5L31 31l11 15h-7.5L26 33.5V46h-8z"
          fill={accent}
        />
        <path
          d="M40 46V18h6v28h-6z"
          fill={accent}
          opacity="0.5"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${fullWidth} ${height}`}
      width={fullWidth}
      height={height}
      role="img"
      aria-label={title}
      className={className}
      focusable="false"
    >
      <title>{title}</title>
      <rect
        x="0"
        y={height * 0.08}
        width={markSize}
        height={height * 0.84}
        rx={markSize * 0.22}
        fill={fg}
      />
      <path
        d={`M${markSize * 0.28} ${height * 0.72}V${height * 0.28}h${markSize * 0.094}v${height * 0.195}L${markSize * 0.53} ${height * 0.28}h${markSize * 0.117}L${markSize * 0.484} ${height * 0.484}L${markSize * 0.656} ${height * 0.72}h${markSize * 0.117}L${markSize * 0.406} ${height * 0.523}v${height * 0.197}h${markSize * 0.094}z`}
        fill={accent}
      />
      <path
        d={`M${markSize * 0.625} ${height * 0.72}V${height * 0.28}h${markSize * 0.094}v${height * 0.44}h${markSize * 0.094}z`}
        fill={accent}
        opacity="0.5"
      />
      <text
        x={markSize + gap}
        y={height * 0.72}
        fontSize={wordSize}
        fontWeight={wordWeight}
        letterSpacing={letterSpacing}
        fill={fg}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        Keen Node
      </text>
    </svg>
  );
}

export default Logo;
