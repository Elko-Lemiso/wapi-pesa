import satori from "satori";
import sharp from "sharp";
import { readFile } from "fs/promises";
import { join } from "path";
import type {
  AccentKey,
  BiggestDayCard,
  BillsMapCard,
  FulizaCard,
  GenerosityCard,
  HeadlineCard,
  InternationalCard,
  LateNightCard,
  PeopleMapCard,
  PunchlineCard,
  RecoveryCard,
  ReflectCard,
  StatsCard,
  SubscriptionsCard,
  TopMerchantCard,
  TopRecipientCard,
  TransportCard,
  TravelCard,
} from "./build-cards";
import type { AnalyticsResult } from "../parser/types";

/**
 * Wapi Pesa Reflect — share card renderer.
 *
 * Two formats per card:
 *   - story  (1080 × 1920, vertical) — Instagram Story / WhatsApp status
 *   - poster (1200 ×  675, horizontal) — Twitter / X / LinkedIn
 *
 * Each card type has its own layout function. The visual chrome (footer band
 * with wordmark + URL + "Get yours" pill + "N of M" indicator) is shared
 * across all cards via `withFrame()`.
 */

// =============================================================================
// Constants & palette
// =============================================================================

const STORY_W = 1080;
const STORY_H = 1920;
const POSTER_W = 1200;
const POSTER_H = 675;

const BG = "#0a0f1c";
const SURFACE = "#0e1524";
const TEXT_PRIMARY = "#f4f6fb";
const TEXT_SECONDARY = "#a8b1c2";
const TEXT_MUTED = "#5d6c84";
const TEXT_FAINT = "#3d4861";

interface AccentTokens {
  fg: string;
  glow: string;
  /** Soft tint for the accent strip / bottom band. */
  band: string;
}

const ACCENT: Record<AccentKey, AccentTokens> = {
  white:   { fg: "#f4f6fb", glow: "rgba(244,246,251,0.18)", band: "rgba(244,246,251,0.10)" },
  coral:   { fg: "#ff6a4a", glow: "rgba(255,106,74,0.30)",  band: "rgba(255,106,74,0.18)"  },
  teal:    { fg: "#2dd4bf", glow: "rgba(45,212,191,0.30)",  band: "rgba(45,212,191,0.18)"  },
  purple:  { fg: "#a78bfa", glow: "rgba(167,139,250,0.30)", band: "rgba(167,139,250,0.18)" },
  amber:   { fg: "#f5b731", glow: "rgba(245,183,49,0.30)",  band: "rgba(245,183,49,0.18)"  },
  blue:    { fg: "#60a5fa", glow: "rgba(96,165,250,0.30)",  band: "rgba(96,165,250,0.18)"  },
  gold:    { fg: "#facc15", glow: "rgba(250,204,21,0.30)",  band: "rgba(250,204,21,0.18)"  },
  magenta: { fg: "#ec4899", glow: "rgba(236,72,153,0.30)",  band: "rgba(236,72,153,0.18)"  },
  neutral: { fg: "#f4f6fb", glow: "rgba(244,246,251,0.10)", band: "rgba(244,246,251,0.06)" },
  multi:   { fg: "#f4f6fb", glow: "rgba(255,255,255,0.10)", band: "rgba(255,255,255,0.05)" },
};

// =============================================================================
// Font loading (cached for the lifetime of the process)
// =============================================================================

interface FontBundle {
  inter400: Buffer;
  inter600: Buffer;
  inter700: Buffer;
  display700: Buffer;
}

let fontCache: FontBundle | null = null;

async function getFonts(): Promise<FontBundle> {
  if (fontCache) return fontCache;
  const dir = join(process.cwd(), "src/lib/generation/fonts");
  const [inter400, inter600, inter700, display700] = await Promise.all([
    readFile(join(dir, "inter-400.ttf")),
    readFile(join(dir, "inter-600.ttf")),
    readFile(join(dir, "inter-700.ttf")),
    readFile(join(dir, "space-grotesk-700.ttf")),
  ]);
  fontCache = { inter400, inter600, inter700, display700 };
  return fontCache;
}

// =============================================================================
// Layout primitives — these return Satori-compatible JSX trees.
// Using JSX directly is the most readable way to compose Satori layouts.
// =============================================================================

type Variant = "story" | "poster";

interface FrameOpts {
  variant: Variant;
  card: ReflectCard;
}

function tokens(variant: Variant) {
  if (variant === "story") {
    return {
      width: STORY_W,
      height: STORY_H,
      pad: 90,
      footerHeight: 140,
      eyebrowSize: 28,
      headlineSize: 64,
      bigNumberSize: 220,
      mediumNumberSize: 140,
      bodySize: 32,
      taglineSize: 32,
      smallSize: 24,
      tinySize: 22,
      brandSize: 26,
      brandUrlSize: 18,
      indicatorSize: 22,
      pillPadX: 22,
      pillPadY: 12,
      pillSize: 22,
    };
  }
  return {
    width: POSTER_W,
    height: POSTER_H,
    pad: 64,
    footerHeight: 80,
    eyebrowSize: 18,
    headlineSize: 38,
    bigNumberSize: 144,
    mediumNumberSize: 92,
    bodySize: 22,
    taglineSize: 22,
    smallSize: 18,
    tinySize: 15,
    brandSize: 20,
    brandUrlSize: 14,
    indicatorSize: 16,
    pillPadX: 16,
    pillPadY: 8,
    pillSize: 16,
  };
}

/**
 * Common card frame: dark background, top accent strip, body slot, footer
 * band with brand + URL + "Get yours" pill + "N of M" indicator.
 */
function withFrame({ variant, card }: FrameOpts, body: React.ReactNode): React.ReactNode {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div
      style={{
        width: t.width,
        height: t.height,
        backgroundColor: BG,
        backgroundImage: `radial-gradient(circle at 80% 0%, ${a.glow}, transparent 55%)`,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter",
        color: TEXT_PRIMARY,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: a.fg,
          display: "flex",
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          paddingLeft: t.pad,
          paddingRight: t.pad,
          paddingTop: t.pad,
          paddingBottom: t.pad / 2,
        }}
      >
        {body}
      </div>
      <Footer variant={variant} card={card} />
    </div>
  );
}

function Footer({ variant, card }: { variant: Variant; card: ReflectCard }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div
      style={{
        height: t.footerHeight,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: t.pad,
        paddingRight: t.pad,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
        backgroundColor: a.band,
      }}
    >
      {/* Wordmark + url */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Logomark size={variant === "story" ? 38 : 26} accent={a.fg} />
          <div
            style={{
              fontFamily: "Space Grotesk",
              fontWeight: 700,
              fontSize: t.brandSize,
              letterSpacing: -0.4,
              color: TEXT_PRIMARY,
              display: "flex",
            }}
          >
            Wapi Pesa
          </div>
        </div>
        <div
          style={{
            color: TEXT_MUTED,
            fontSize: t.brandUrlSize,
            marginTop: 4,
            marginLeft: variant === "story" ? 50 : 38,
            display: "flex",
          }}
        >
          wapipesa.co.ke
        </div>
      </div>

      {/* Indicator + CTA pill */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <div
          style={{
            color: TEXT_MUTED,
            fontSize: t.indicatorSize,
            letterSpacing: 0.5,
            display: "flex",
          }}
        >
          {card.index} / {card.total}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingLeft: t.pillPadX,
            paddingRight: t.pillPadX,
            paddingTop: t.pillPadY,
            paddingBottom: t.pillPadY,
            borderRadius: 999,
            backgroundColor: a.fg,
            color: BG,
            fontSize: t.pillSize,
            fontWeight: 600,
          }}
        >
          <span style={{ display: "flex" }}>Get yours</span>
          <Arrow size={t.pillSize} color={BG} />
        </div>
      </div>
    </div>
  );
}

function Arrow({ size, color }: { size: number; color: string }) {
  // Inline SVG arrow — sidesteps font glyph coverage gaps for U+2192.
  const px = Math.round(size * 0.95);
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "flex" }}
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Logomark({ size, accent }: { size: number; accent: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: accent,
        color: BG,
        fontFamily: "Space Grotesk",
        fontWeight: 700,
        fontSize: size * 0.55,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      W
    </div>
  );
}

function Eyebrow({ children, accent, variant }: { children: string; accent: string; variant: Variant }) {
  const t = tokens(variant);
  return (
    <div
      style={{
        color: accent,
        fontSize: t.eyebrowSize,
        fontWeight: 600,
        letterSpacing: 4,
        textTransform: "uppercase",
        display: "flex",
      }}
    >
      {children}
    </div>
  );
}

function Tagline({ children, variant }: { children: string; variant: Variant }) {
  const t = tokens(variant);
  return (
    <div
      style={{
        color: TEXT_SECONDARY,
        fontSize: t.taglineSize,
        fontStyle: "italic",
        marginTop: variant === "story" ? 36 : 18,
        display: "flex",
        maxWidth: variant === "story" ? STORY_W - tokens(variant).pad * 2 : POSTER_W * 0.8,
        lineHeight: 1.35,
      }}
    >
      “{children}”
    </div>
  );
}

// =============================================================================
// Per-card body layouts
// =============================================================================

function HeadlineBody({ card, variant }: { card: HeadlineCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>
        {`Wapi Pesa · ${new Date().getFullYear()} edition`}
      </Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize,
          letterSpacing: -6,
          lineHeight: 0.95,
          color: a.fg,
          marginTop: variant === "story" ? 44 : 16,
          display: "flex",
        }}
      >
        {card.data.bigNumber}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 24 : 8,
          display: "flex",
        }}
      >
        {card.data.subtitle}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 24,
          marginTop: variant === "story" ? 24 : 12,
          color: TEXT_SECONDARY,
          fontSize: t.bodySize,
        }}
      >
        <div style={{ display: "flex" }}>{card.data.txCount}</div>
        <div style={{ color: TEXT_MUTED, display: "flex" }}>·</div>
        <div
          style={{
            color: card.data.netPositive ? "#00d68f" : "#ff6a4a",
            display: "flex",
          }}
        >
          {card.data.netLabel}
        </div>
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function TopRecipientBody({ card, variant }: { card: TopRecipientCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>{card.data.eyebrow}</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.headlineSize * 1.5,
          letterSpacing: -2,
          color: TEXT_PRIMARY,
          marginTop: variant === "story" ? 28 : 12,
          display: "flex",
        }}
      >
        {card.data.name}
      </div>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.85,
          color: a.fg,
          letterSpacing: -5,
          lineHeight: 0.95,
          marginTop: variant === "story" ? 36 : 14,
          display: "flex",
        }}
      >
        {card.data.amount}
      </div>
      <div
        style={{
          color: TEXT_SECONDARY,
          fontSize: t.bodySize,
          marginTop: variant === "story" ? 20 : 8,
          display: "flex",
          gap: 18,
        }}
      >
        <div style={{ display: "flex" }}>{card.data.frequency}</div>
        <div style={{ color: TEXT_MUTED, display: "flex" }}>·</div>
        <div style={{ display: "flex" }}>{card.data.avgPerSend}</div>
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function TopMerchantBody({ card, variant }: { card: TopMerchantCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>{card.data.eyebrow}</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.headlineSize * 1.4,
          letterSpacing: -2,
          color: TEXT_PRIMARY,
          marginTop: variant === "story" ? 28 : 12,
          display: "flex",
          maxWidth: t.width - t.pad * 2,
        }}
      >
        {card.data.merchant}
      </div>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.85,
          color: a.fg,
          letterSpacing: -5,
          lineHeight: 0.95,
          marginTop: variant === "story" ? 36 : 14,
          display: "flex",
        }}
      >
        {card.data.amount}
      </div>
      <div
        style={{
          color: TEXT_SECONDARY,
          fontSize: t.bodySize,
          marginTop: variant === "story" ? 20 : 8,
          display: "flex",
          gap: 18,
        }}
      >
        <div style={{ display: "flex" }}>{`${card.data.visits} visits`}</div>
        <div style={{ color: TEXT_MUTED, display: "flex" }}>·</div>
        <div style={{ display: "flex" }}>{card.data.avgPerVisit}</div>
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function LateNightBody({ card, variant }: { card: LateNightCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  // Tiny histogram for the late-night hours (22, 23, 0, 1, 2, 3, 4)
  const lateHours = [22, 23, 0, 1, 2, 3, 4];
  const bars = lateHours.map((h) => card.data.hourly[h] ?? 0);
  const max = Math.max(...bars, 1);
  const barW = (t.width - t.pad * 2 - 6 * 14) / 7;
  const barHeightMax = variant === "story" ? 240 : 90;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>Your late-night self</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize,
          color: a.fg,
          letterSpacing: -5,
          lineHeight: 0.95,
          marginTop: variant === "story" ? 36 : 14,
          display: "flex",
        }}
      >
        {card.data.bigNumber}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 8,
          display: "flex",
        }}
      >
        transactions between 10pm & 4am
      </div>
      <div
        style={{
          color: TEXT_SECONDARY,
          fontSize: t.bodySize,
          marginTop: variant === "story" ? 12 : 4,
          display: "flex",
        }}
      >
        {card.data.amount} after dark
      </div>

      {/* Tiny hour histogram */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 14,
          alignItems: "flex-end",
          marginTop: variant === "story" ? 60 : 22,
          height: barHeightMax,
        }}
      >
        {bars.map((value, i) => {
          const h = (value / max) * barHeightMax;
          return (
            <div
              key={i}
              style={{
                width: barW,
                height: Math.max(h, 4),
                backgroundColor: a.fg,
                opacity: value === 0 ? 0.18 : 1,
                borderRadius: 4,
                display: "flex",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 14,
          marginTop: 8,
          color: TEXT_FAINT,
          fontSize: t.tinySize,
        }}
      >
        {lateHours.map((h, i) => (
          <div key={i} style={{ width: barW, textAlign: "center", display: "flex", justifyContent: "center" }}>
            {h === 0 ? "12am" : h < 12 ? `${h}am` : `${h - 12}pm`}
          </div>
        ))}
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function FulizaBody({ card, variant }: { card: FulizaCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>Fuliza, our friend</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize,
          color: a.fg,
          letterSpacing: -6,
          lineHeight: 0.95,
          marginTop: variant === "story" ? 36 : 14,
          display: "flex",
        }}
      >
        {card.data.eventCount.toLocaleString()}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 6,
          display: "flex",
        }}
      >
        times Fuliza saved you
      </div>
      <div
        style={{
          color: TEXT_SECONDARY,
          fontSize: t.bodySize,
          marginTop: variant === "story" ? 24 : 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex" }}>
          {card.data.feesPaid} paid in fees
        </div>
        {card.data.busiestMonth && (
          <div style={{ color: TEXT_MUTED, display: "flex" }}>
            Busiest month: {card.data.busiestMonth}
          </div>
        )}
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function SubscriptionsBody({ card, variant }: { card: SubscriptionsCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>Things you forgot you pay for</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.95,
          color: a.fg,
          letterSpacing: -5,
          lineHeight: 0.95,
          marginTop: variant === "story" ? 28 : 10,
          display: "flex",
        }}
      >
        {card.data.annualTotal}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.bodySize,
          marginTop: variant === "story" ? 12 : 4,
          display: "flex",
        }}
      >
        a year on autopilot · {card.data.monthlyTotal}/mo
      </div>

      <div
        style={{
          marginTop: variant === "story" ? 48 : 18,
          display: "flex",
          flexDirection: "column",
          gap: variant === "story" ? 12 : 6,
        }}
      >
        {card.data.top.slice(0, variant === "story" ? 5 : 3).map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 12,
              paddingBottom: 12,
              borderRadius: 14,
              backgroundColor: SURFACE,
            }}
          >
            <div
              style={{
                color: TEXT_PRIMARY,
                fontSize: t.bodySize,
                fontWeight: 600,
                display: "flex",
              }}
            >
              {row.name}
            </div>
            <div
              style={{
                fontFamily: "Space Grotesk",
                fontWeight: 700,
                color: a.fg,
                fontSize: t.bodySize,
                display: "flex",
              }}
            >
              {row.monthly}/mo
            </div>
          </div>
        ))}
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

/**
 * Shared rendering for both the Bills map and the People map. They look
 * identical structurally — eyebrow, headline, ranked bars — but differ in
 * which recipients they list and how each one is labelled (rent vs friend).
 *
 * Capped at top 5 across both formats — the spec calls out 5 as the
 * culturally familiar count from Spotify Wrapped et al.
 */
type MapRow = {
  rank: number;
  name: string;
  amount: string;
  share: number;
  roleLabel: string;
};

function MapBody({
  variant,
  accent,
  eyebrow,
  headline,
  rows,
  tagline,
  showRoleChip,
}: {
  variant: Variant;
  accent: AccentTokens;
  eyebrow: string;
  headline: string;
  rows: MapRow[];
  tagline: string;
  showRoleChip: boolean;
}) {
  const t = tokens(variant);
  const limit = 5;
  const visible = rows.slice(0, limit);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={accent.fg} variant={variant}>{eyebrow}</Eyebrow>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 4,
          display: "flex",
        }}
      >
        {headline}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: variant === "story" ? 18 : 8,
          marginTop: variant === "story" ? 48 : 16,
        }}
      >
        {visible.map((r) => (
          <div
            key={r.rank}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: variant === "story" ? 24 : 14,
            }}
          >
            <div
              style={{
                fontFamily: "Space Grotesk",
                fontWeight: 700,
                color: accent.fg,
                fontSize: t.bodySize * 1.2,
                width: variant === "story" ? 64 : 36,
                display: "flex",
              }}
            >
              {String(r.rank).padStart(2, "0")}
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 10,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      color: TEXT_PRIMARY,
                      fontSize: t.bodySize,
                      fontWeight: 600,
                      display: "flex",
                    }}
                  >
                    {r.name}
                  </div>
                  {showRoleChip && r.roleLabel && (
                    <div
                      style={{
                        display: "flex",
                        fontSize: variant === "story" ? 18 : 11,
                        color: TEXT_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: 1.4,
                        fontWeight: 600,
                      }}
                    >
                      {r.roleLabel}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    fontSize: t.bodySize,
                    display: "flex",
                  }}
                >
                  {r.amount}
                </div>
              </div>
              <div
                style={{
                  height: variant === "story" ? 8 : 4,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  display: "flex",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(r.share * 100, 4)}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: accent.fg,
                    display: "flex",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Tagline variant={variant}>{tagline}</Tagline>
    </div>
  );
}

function BillsMapBody({ card, variant }: { card: BillsMapCard; variant: Variant }) {
  return (
    <MapBody
      variant={variant}
      accent={ACCENT[card.accent]}
      eyebrow="The bills that don't ask"
      headline={`Top ${Math.min(card.data.rows.length, 5)} recurring obligations`}
      rows={card.data.rows}
      tagline={card.tagline}
      showRoleChip
    />
  );
}

function PeopleMapBody({ card, variant }: { card: PeopleMapCard; variant: Variant }) {
  return (
    <MapBody
      variant={variant}
      accent={ACCENT[card.accent]}
      eyebrow="The people who got paid"
      headline={`Your top ${Math.min(card.data.rows.length, 5)}`}
      rows={card.data.rows}
      tagline={card.tagline}
      showRoleChip={false}
    />
  );
}

function BiggestDayBody({ card, variant }: { card: BiggestDayCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>Your biggest day</Eyebrow>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.headlineSize * 1.2,
          letterSpacing: -2,
          marginTop: variant === "story" ? 28 : 12,
          display: "flex",
        }}
      >
        {card.data.date}
      </div>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.95,
          color: a.fg,
          letterSpacing: -5,
          lineHeight: 0.95,
          marginTop: variant === "story" ? 36 : 14,
          display: "flex",
        }}
      >
        {card.data.amount}
      </div>
      <div
        style={{
          color: TEXT_SECONDARY,
          fontSize: t.bodySize,
          marginTop: variant === "story" ? 20 : 6,
          display: "flex",
        }}
      >
        {card.data.summary}
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function PunchlineBody({ card, variant }: { card: PunchlineCard; variant: Variant }) {
  const t = tokens(variant);
  // Punchline lives on contrast — single big quote-style line, no accent stripe usage
  const fontSize = variant === "story" ? 78 : 46;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <div
        style={{
          color: ACCENT.coral.fg,
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.7,
          lineHeight: 0.85,
          marginBottom: variant === "story" ? 4 : 0,
          letterSpacing: -2,
          display: "flex",
        }}
      >
        “
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize,
          lineHeight: 1.15,
          letterSpacing: -1.5,
          display: "flex",
          maxWidth: t.width - t.pad * 2,
        }}
      >
        {card.data.line}
      </div>
      <div
        style={{
          color: TEXT_MUTED,
          fontSize: t.smallSize,
          marginTop: variant === "story" ? 36 : 14,
          letterSpacing: 1.5,
          display: "flex",
        }}
      >
        — Wapi Pesa, your year
      </div>
    </div>
  );
}

function StatsBody({ card, variant }: { card: StatsCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  const cols = variant === "story" ? 2 : 3;
  const tints = ["#ff6a4a", "#2dd4bf", "#a78bfa", "#f5b731", "#60a5fa", "#facc15", "#ec4899", "#00d68f"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>Your year by the numbers</Eyebrow>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 6,
          display: "flex",
        }}
      >
        The receipt.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: variant === "story" ? 18 : 10,
          marginTop: variant === "story" ? 56 : 18,
        }}
      >
        {card.data.rows.slice(0, 8).map((r, i) => (
          <div
            key={i}
            style={{
              width: `${100 / cols - 2}%`,
              minHeight: variant === "story" ? 160 : 90,
              padding: variant === "story" ? 24 : 14,
              borderRadius: 18,
              backgroundColor: SURFACE,
              borderLeft: `4px solid ${tints[i % tints.length]}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                color: TEXT_MUTED,
                fontSize: t.tinySize,
                letterSpacing: 1,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                fontFamily: "Space Grotesk",
                fontWeight: 700,
                color: TEXT_PRIMARY,
                fontSize: t.bodySize * 1.05,
                letterSpacing: -0.5,
                display: "flex",
                marginTop: 8,
              }}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Conditional layouts (smaller — they just dress up a few stats)
function TransportBody({ card, variant }: { card: TransportCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>Hours in someone else’s car</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.9,
          color: a.fg,
          letterSpacing: -5,
          marginTop: variant === "story" ? 32 : 12,
          display: "flex",
        }}
      >
        {card.data.amount}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 6,
          display: "flex",
        }}
      >
        on {card.data.rideCount} rides
      </div>
      {card.data.topService && (
        <div
          style={{
            color: TEXT_SECONDARY,
            fontSize: t.bodySize,
            marginTop: variant === "story" ? 16 : 4,
            display: "flex",
          }}
        >
          Top service: {card.data.topService}
        </div>
      )}
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function InternationalBody({ card, variant }: { card: InternationalCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>From abroad, with care</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.9,
          color: a.fg,
          letterSpacing: -5,
          marginTop: variant === "story" ? 32 : 12,
          display: "flex",
        }}
      >
        {card.data.amount}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 6,
          display: "flex",
        }}
      >
        across {card.data.count} transfers
      </div>
      {card.data.topSource && (
        <div
          style={{
            color: TEXT_SECONDARY,
            fontSize: t.bodySize,
            marginTop: variant === "story" ? 16 : 4,
            display: "flex",
          }}
        >
          Mostly via {card.data.topSource}
        </div>
      )}
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function GenerosityBody({ card, variant }: { card: GenerosityCard; variant: Variant }) {
  const t = tokens(variant);
  const a = ACCENT[card.accent];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <Eyebrow accent={a.fg} variant={variant}>The bank of you</Eyebrow>
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: t.bigNumberSize * 0.9,
          color: a.fg,
          letterSpacing: -5,
          marginTop: variant === "story" ? 32 : 12,
          display: "flex",
        }}
      >
        {card.data.sent}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: t.headlineSize,
          fontWeight: 600,
          letterSpacing: -1,
          marginTop: variant === "story" ? 16 : 6,
          display: "flex",
        }}
      >
        sent to friends and family
      </div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function TravelBody({ card, variant }: { card: TravelCard; variant: Variant }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <div style={{ display: "flex" }}>{card.headline}</div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

function RecoveryBody({ card, variant }: { card: RecoveryCard; variant: Variant }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <div style={{ display: "flex" }}>{card.headline}</div>
      <Tagline variant={variant}>{card.tagline}</Tagline>
    </div>
  );
}

// =============================================================================
// Dispatcher
// =============================================================================

function CardLayout({ card, variant }: { card: ReflectCard; variant: Variant }) {
  let body: React.ReactNode;
  switch (card.cardType) {
    case "headline":      body = <HeadlineBody card={card} variant={variant} />; break;
    case "topRecipient":  body = <TopRecipientBody card={card} variant={variant} />; break;
    case "topMerchant":   body = <TopMerchantBody card={card} variant={variant} />; break;
    case "lateNight":     body = <LateNightBody card={card} variant={variant} />; break;
    case "fuliza":        body = <FulizaBody card={card} variant={variant} />; break;
    case "subscriptions": body = <SubscriptionsBody card={card} variant={variant} />; break;
    case "billsMap":      body = <BillsMapBody card={card} variant={variant} />; break;
    case "peopleMap":     body = <PeopleMapBody card={card} variant={variant} />; break;
    case "biggestDay":    body = <BiggestDayBody card={card} variant={variant} />; break;
    case "punchline":     body = <PunchlineBody card={card} variant={variant} />; break;
    case "stats":         body = <StatsBody card={card} variant={variant} />; break;
    case "transport":     body = <TransportBody card={card} variant={variant} />; break;
    case "international": body = <InternationalBody card={card} variant={variant} />; break;
    case "generosity":    body = <GenerosityBody card={card} variant={variant} />; break;
    case "travel":        body = <TravelBody card={card} variant={variant} />; break;
    case "recovery":      body = <RecoveryBody card={card} variant={variant} />; break;
  }
  return withFrame({ variant, card }, body);
}

// =============================================================================
// Render pipeline
// =============================================================================

async function renderCard(
  card: ReflectCard,
  variant: Variant
): Promise<Buffer> {
  const fonts = await getFonts();
  const t = tokens(variant);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(<CardLayout card={card} variant={variant} /> as any, {
    width: t.width,
    height: t.height,
    fonts: [
      { name: "Inter", data: fonts.inter400, weight: 400, style: "normal" },
      { name: "Inter", data: fonts.inter600, weight: 600, style: "normal" },
      { name: "Inter", data: fonts.inter700, weight: 700, style: "normal" },
      { name: "Space Grotesk", data: fonts.display700, weight: 700, style: "normal" },
    ],
  });

  return sharp(Buffer.from(svg))
    .png({ quality: 92, compressionLevel: 6 })
    .toBuffer();
}

/**
 * Render every card in both formats. Returns a map keyed by:
 *   "card-{id}-{story|poster}" → PNG buffer
 *
 * Old keys (`card-XX-story`, `card-XX-twitter`) are also populated for
 * backward compatibility with the existing report download API.
 */
export async function generateShareCards(
  cards: ReflectCard[],
  _analytics: AnalyticsResult,
  privateCards?: ReflectCard[]
): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();

  for (const card of cards) {
    const idx = String(card.index).padStart(2, "0");

    const [story, poster] = await Promise.all([
      renderCard(card, "story"),
      renderCard(card, "poster"),
    ]);

    result.set(`card-${card.id}-story`, story);
    result.set(`card-${card.id}-poster`, poster);

    // Legacy numeric keys (kept so older clients still work)
    result.set(`card-${idx}-story`, story);
    result.set(`card-${idx}-twitter`, poster);
  }

  // Privacy variants — names replaced with initials. Rendered as a separate
  // set so the client can toggle without re-fetching.
  if (privateCards && privateCards.length === cards.length) {
    for (const card of privateCards) {
      const [story, poster] = await Promise.all([
        renderCard(card, "story"),
        renderCard(card, "poster"),
      ]);
      result.set(`card-${card.id}-story-private`, story);
      result.set(`card-${card.id}-poster-private`, poster);
    }
  }

  return result;
}

/**
 * Lightweight metadata for the client — what cards exist, in what order,
 * with their type, accent, and the keys used to download each format.
 */
export interface CardManifest {
  id: string;
  index: number;
  total: number;
  cardType: string;
  accent: AccentKey;
  headline: string;
  tagline: string;
  storyKey: string;
  posterKey: string;
  /** Privacy-masked variants — same images, names rendered as initials. */
  storyKeyPrivate: string;
  posterKeyPrivate: string;
  /** True when this card actually shows a personal name that gets masked. */
  hasName: boolean;
}

const NAMED_CARD_TYPES = new Set([
  "topRecipient",
  "billsMap",
  "peopleMap",
  "punchline",
  "stats",
]);

export function buildCardManifest(cards: ReflectCard[]): CardManifest[] {
  return cards.map((c) => ({
    id: c.id,
    index: c.index,
    total: c.total,
    cardType: c.cardType,
    accent: c.accent,
    headline: c.headline,
    tagline: c.tagline,
    storyKey: `card-${c.id}-story`,
    posterKey: `card-${c.id}-poster`,
    storyKeyPrivate: `card-${c.id}-story-private`,
    posterKeyPrivate: `card-${c.id}-poster-private`,
    hasName: NAMED_CARD_TYPES.has(c.cardType),
  }));
}
