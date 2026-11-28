import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { formatRate, type HotelFloor } from "../data/floors";

/**
 * The building view: the Aurelia photograph with every storey made live.
 *
 * Mouse: hover a storey (or a row in the floor list) to light it, click to
 * go inside. Touch: tap to preview, tap again (or "Explore") to go inside,
 * swipe up and down on the hotel to step between floors. Keyboard: arrows
 * step, Enter goes in, Escape clears.
 *
 * Coordinates are in the photograph's own 1365×768 pixel space.
 */

const IMG_W = 1365;
const IMG_H = 768;

/** Each storey: front face, corner pier and side face of the hotel. */
const STOREYS: Record<number, string> = {
  5: "768,196 852,150 852,136 935,104 1018,96 1100,100 1192,140 1182,152 1226,190 1234,236 1115,238 768,238",
  4: "768,238 1115,238 1234,236 1234,300 1115,300 768,300",
  3: "768,300 1115,300 1234,300 1234,369 1115,369 768,369",
  2: "768,369 1115,369 1234,369 1234,436 1115,436 768,436",
  1: "768,436 1115,436 1234,436 1234,502 1115,502 768,502",
  0: "768,502 1115,502 1234,502 1234,575 1115,604 1010,606 830,590 768,584",
};
const STOREY_CENTRE_Y: Record<number, number> = { 5: 168, 4: 269, 3: 334, 2: 402, 1: 469, 0: 552 };

/** The hotel's extent in the photograph, used to frame it on any screen. */
const HOTEL = { x0: 765, x1: 1236, y0: 94, y1: 608, cx: 1000 };

/** Lamps in the photograph that softly breathe. */
const LAMPS: [x: number, y: number, r: number][] = [
  [614, 597, 9],
  [739, 621, 9],
  [929, 661, 10],
  [905, 548, 30],
  [327, 556, 7],
  [447, 556, 7],
  [1180, 584, 6],
];

type Layout = "side" | "center";
type Rect = { left: number; top: number; width: number; height: number };

/**
 * Where the photograph sits inside the frame.
 *  side:   fills the frame, hotel kept on the right beside the copy;
 *  center: hotel sized to fit between the title and the floor chips, with the
 *          picture fading into matching dusk above and below.
 */
function frameStage(layout: Layout, W: number, H: number, band: { top: number; bottom: number }): Rect {
  const ratio = IMG_W / IMG_H;
  if (layout === "side") {
    const hotelH = (HOTEL.y1 - HOTEL.y0) / IMG_H;
    // Cover the frame, but never so large that the hotel loses its roof or
    // base (very wide windows); then the picture's left edge fades into dusk.
    const fitHotel = ((H * 0.88) / hotelH) * ratio;
    const width = Math.min(Math.max(W, H * ratio), Math.max(fitHotel, H * ratio));
    const height = width / ratio;
    const hotelRight = (HOTEL.x1 / IMG_W) * width;
    const left = Math.max(W - width, Math.min(Math.max(0, W - width), W * 0.94 - hotelRight));
    const hotelMid = ((HOTEL.y0 + HOTEL.y1) / 2 / IMG_H) * height;
    const top = Math.min(0, Math.max(H - height, H * 0.5 - hotelMid));
    return { left, top, width, height };
  }
  // Fit the hotel into the free band between the title and the floor chips,
  // never narrower than the window so no edge of the picture shows.
  const hotelW = (HOTEL.x1 - HOTEL.x0) / IMG_W;
  const hotelH = (HOTEL.y1 - HOTEL.y0) / IMG_H;
  const bandH = Math.max(160, band.bottom - band.top);
  const width = Math.max(W, Math.min((W * 0.9) / hotelW, (bandH / hotelH) * ratio));
  const height = width / ratio;
  const hotelPx = hotelH * height;
  const top = band.top + (bandH - hotelPx) / 2 - (HOTEL.y0 / IMG_H) * height;
  const left = Math.min(0, Math.max(W - width, W / 2 - (HOTEL.cx / IMG_W) * width));
  return { left, top, width, height };
}

const label = (floor: HotelFloor) => (floor.id === 0 ? "G" : String(floor.id).padStart(2, "0"));

export default function HotelHero({
  floors,
  layout,
  selectedFloor,
  hoveredFloor,
  onHover,
  onSelect,
}: {
  floors: HotelFloor[];
  layout: Layout;
  selectedFloor: number | null;
  hoveredFloor: number | null;
  onHover: (floorId: number | null) => void;
  onSelect: (floorId: number) => void;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<Rect | null>(null);
  const lastPointer = useRef<string>("mouse");
  const lit = selectedFloor ?? hoveredFloor;
  const litFloor = floors.find((floor) => floor.id === lit) ?? null;
  const entering = selectedFloor !== null;

  // Frame the photograph whenever the window (or layout) changes.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const update = () => {
      // The free band between the title and the floor list, in frame pixels.
      const box = el.getBoundingClientRect();
      const title = document.querySelector(".building-view .hero-title")?.getBoundingClientRect();
      const rail = document.querySelector(".building-view .floor-rail")?.getBoundingClientRect();
      const band = {
        top: title ? title.bottom - box.top + 4 : box.height * 0.3,
        bottom: rail ? rail.top - box.top - 10 : box.height * 0.8,
      };
      setStage(frameStage(layout, el.clientWidth, el.clientHeight, band));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout]);

  // Gentle depth: the picture drifts a few pixels against the mouse.
  useEffect(() => {
    let raf = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = (event.clientY / window.innerHeight) * 2 - 1;
        inner.current?.style.setProperty("--drift-x", x.toFixed(3));
        inner.current?.style.setProperty("--drift-y", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  const ordered = floors.map((floor) => floor.id).sort((a, b) => a - b);
  const step = useCallback(
    (direction: 1 | -1) => {
      const current = hoveredFloor ?? (direction > 0 ? -1 : ordered.length);
      const index = ordered.indexOf(current);
      const next = index < 0 ? (direction > 0 ? ordered[0] : ordered[ordered.length - 1]) : ordered[index + direction];
      if (next !== undefined) onHover(next);
    },
    [hoveredFloor, ordered, onHover],
  );

  // Keyboard: arrows step through floors, Enter goes in, Escape clears.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "Enter" && hoveredFloor !== null && target === document.body) {
        onSelect(hoveredFloor);
      } else if (event.key === "Escape") {
        onHover(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [step, hoveredFloor, onHover, onSelect]);

  // Touch: swipe up/down over the hotel to step floors.
  const swipe = useRef<{ y: number; x: number; t: number } | null>(null);
  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (event: TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const t = event.changedTouches[0];
    const dy = t.clientY - s.y;
    const dx = t.clientX - s.x;
    if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.4 && Date.now() - s.t < 700) step(dy < 0 ? 1 : -1);
  };

  const activate = (floorId: number) => {
    // Mouse: one click goes in. Touch and pen: first tap previews.
    if (lastPointer.current !== "mouse" && hoveredFloor !== floorId) onHover(floorId);
    else onSelect(floorId);
  };

  const stageStyle: CSSProperties | undefined = stage
    ? {
        left: stage.left,
        top: stage.top,
        width: stage.width,
        height: stage.height,
        // Very wide windows: the picture's left edge melts into the dusk backdrop.
        ...(layout === "side" && stage.left > 1
          ? {
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 16%)",
              maskImage: "linear-gradient(90deg, transparent 0%, #000 16%)",
            }
          : {}),
        transformOrigin: entering
          ? `${(HOTEL.cx / IMG_W) * 100}% ${(STOREY_CENTRE_Y[selectedFloor!] / IMG_H) * 100}%`
          : undefined,
      }
    : undefined;

  // Preview card next to the lit storey (side), or above the chips (center).
  const cardStyle: CSSProperties | undefined =
    stage && litFloor && layout === "side"
      ? {
          left: Math.max(16, stage.left + (HOTEL.x0 / IMG_W) * stage.width - 18),
          top: stage.top + (STOREY_CENTRE_Y[litFloor.id] / IMG_H) * stage.height,
        }
      : undefined;

  return (
    <div
      ref={frame}
      className={`hh-frame hh-frame--${layout}${entering ? " is-entering" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onPointerDown={(event) => {
        lastPointer.current = event.pointerType;
      }}
      onClick={(event) => {
        // Tap on the sky or plaza clears a touch preview.
        const target = event.target as Element;
        if (lastPointer.current !== "mouse" && !target.closest(".hh-storey, .hh-card, .hh-stepper")) onHover(null);
      }}
    >
      {stage && (
        <div className="hh-stage" style={stageStyle}>
          <div ref={inner} className="hh-inner">
            <img
              className="hh-photo"
              src="/images/aurelia-hotel-2560.webp"
              srcSet="/images/aurelia-hotel-2560.webp 2560w, /images/aurelia-hotel-3840.webp 3840w"
              sizes={`${Math.round(stage.width)}px`}
              width={IMG_W}
              height={IMG_H}
              alt="Aurelia Milano at sunset: a six-storey travertine hotel with every window lit, on a lamp-lit terrace above Milan, the cathedral glowing against a violet and orange sky."
              draggable={false}
              fetchPriority="high"
            />
            <svg className="hh-overlay" viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none">
              <defs>
                <radialGradient id="hh-lamp">
                  <stop offset="0" stopColor="#fff2cc" stopOpacity="0.9" />
                  <stop offset="0.35" stopColor="#ffc46e" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#ff9d42" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="hh-lift" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#fff3dc" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#ffd59a" stopOpacity="0.1" />
                </linearGradient>
                <mask id="hh-spot" maskUnits="userSpaceOnUse" x="0" y="0" width={IMG_W} height={IMG_H}>
                  <rect width={IMG_W} height={IMG_H} fill="#fff" />
                  {lit !== null && STOREYS[lit] && <polygon points={STOREYS[lit]} fill="#000" />}
                </mask>
              </defs>
              <g className="hh-lamps" aria-hidden="true">
                {LAMPS.map(([x, y, r], index) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="url(#hh-lamp)" style={{ animationDelay: `${(index * 0.7) % 4}s` }} />
                ))}
              </g>
              {/* Spotlight: everything but the chosen storey sinks into dusk. */}
              <rect className={`hh-veil${lit !== null ? " is-on" : ""}`} width={IMG_W} height={IMG_H} mask="url(#hh-spot)" />
              {floors.map((floor) => (
                <polygon
                  key={floor.id}
                  points={STOREYS[floor.id]}
                  className={`hh-storey${lit === floor.id ? " is-lit" : ""}`}
                  role="button"
                  aria-label={`${floor.level}: ${floor.name}`}
                  onPointerDown={(event) => {
                    lastPointer.current = event.pointerType;
                  }}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") onHover(floor.id);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") onHover(null);
                  }}
                  onClick={() => activate(floor.id)}
                />
              ))}
            </svg>
          </div>
        </div>
      )}

      {litFloor && !entering && (
        <div
          key={litFloor.id}
          className={`hh-card hh-card--${layout}`}
          style={cardStyle}
          role="status"
          aria-live="polite"
        >
          <span className="hh-card-number">{label(litFloor)}</span>
          <span className="hh-card-copy">
            <span className="hh-card-level">{litFloor.level}</span>
            <strong>{litFloor.name}</strong>
            {litFloor.rate && (
              <span className="hh-card-rate">
                From <b>{formatRate(litFloor.rate)}</b> / night
              </span>
            )}
          </span>
          <button type="button" className="hh-card-go" onClick={() => onSelect(litFloor.id)} aria-label={`Explore ${litFloor.name}`}>
            <span>Explore</span>
            <ArrowRight size={15} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Step through floors without a mouse (shown on touch screens). */}
      <div className="hh-stepper" aria-label="Step between floors">
        <button type="button" onClick={() => step(1)} aria-label="Floor above">
          <ChevronUp size={18} strokeWidth={1.8} />
        </button>
        <span>{litFloor ? label(litFloor) : "—"}</span>
        <button type="button" onClick={() => step(-1)} aria-label="Floor below">
          <ChevronDown size={18} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
