// Renders a company's logo when it has a custom uploaded logo (base64 data URL),
// otherwise a colored circle with the company's initials — so a company with no
// logo is clearly distinct from the default UNNATI logo.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic pleasant color from the name so each company keeps a stable hue.
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function CompanyLogo({
  name, logoB64, size = 34, radius = 6,
}: {
  name: string;
  logoB64?: string | null;
  size?: number;
  radius?: number;
}) {
  const hasLogo = !!logoB64 && logoB64.startsWith("data:");
  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoB64!} alt={name} style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, borderRadius: radius }} />
    );
  }
  const hue = hueFor(name || "Company");
  return (
    <div
      aria-label={name}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: radius,
        background: `hsl(${hue} 65% 45%)`, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: size * 0.4, letterSpacing: "0.02em",
      }}
    >
      {initials(name || "?")}
    </div>
  );
}
