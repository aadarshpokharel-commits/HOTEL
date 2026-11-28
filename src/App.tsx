import { AnimatePresence, motion } from "framer-motion";
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Compass,
  ConciergeBell,
  Gem,
  House,
  MapPin,
  Orbit,
  RotateCcw,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import InteriorScene, { type InteriorFeature } from "./components/InteriorScene";
import HotelHero from "./components/HotelHero";

/**
 * "side": the hotel stands right of the title and floor list (wide windows).
 * "center": title on top, hotel in the middle, floor chips below.
 */
function useSceneLayout() {
  const pick = () =>
    typeof window !== "undefined" && window.innerWidth >= 980 && window.innerWidth / window.innerHeight >= 1.2
      ? "side"
      : "center";
  const [layout, setLayout] = useState<"side" | "center">(pick);
  useEffect(() => {
    const update = () => setLayout(pick());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return layout;
}
import { floors, formatRate, type FloorRate, type HotelFloor } from "./data/floors";

/**
 * Nightly price and a "Book now" call to action.
 *
 * The button is intentionally inert for now: it renders, hovers and presses
 * like a live control but does nothing. To connect it later, pass `onBook`
 * (e.g. navigate to the booking page with the floor id).
 */
function BookingPanel({ floor, rate, onBook }: { floor: HotelFloor; rate: FloorRate; onBook?: (floor: HotelFloor) => void }) {
  return (
    <motion.aside
      className="booking-panel"
      key={`booking-${floor.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`${floor.name} rate`}
    >
      <div className="booking-price">
        <span className="booking-category">{rate.category}</span>
        <span className="booking-amount">
          <span className="booking-from">From</span>
          <strong>{formatRate(rate)}</strong>
          <span className="booking-unit">/ {rate.unit ?? "night"}</span>
        </span>
        <span className="booking-note">{rate.note}</span>
      </div>
      <button
        type="button"
        className="booking-button"
        onClick={onBook ? () => onBook(floor) : undefined}
        aria-label={`Book ${floor.name}, from ${formatRate(rate)} per ${rate.unit ?? "night"}`}
      >
        <span>Book now</span>
        <ArrowRight size={14} strokeWidth={1.8} />
      </button>
    </motion.aside>
  );
}

function Brand() {
  return (
    <a className="brand" href="#" aria-label="Aurelia Milano home">
      <span className="brand-mark">A</span>
      <span className="brand-copy">
        <span className="brand-name">AURELIA</span>
        <span className="brand-location">MILANO · ITALIA</span>
      </span>
    </a>
  );
}

const FLOOR_ICONS: LucideIcon[] = [ConciergeBell, UtensilsCrossed, BedDouble, Armchair, House, Gem];

function FloorRail({
  activeFloor,
  onSelect,
  onHover,
  compact = false,
}: {
  activeFloor: number | null;
  onSelect: (floorId: number) => void;
  onHover?: (floorId: number | null) => void;
  compact?: boolean;
}) {
  return (
    <nav
      className={`floor-rail${compact ? " floor-rail--compact" : ""}`}
      aria-label="Explore hotel floors"
    >
      <div className="rail-heading">
        <span>FLOORS</span>
        <span className="rail-line" />
        <span>{String(floors.length).padStart(2, "0")}</span>
      </div>
      <div className="rail-list">
        {floors.map((floor) => {
          const active = activeFloor === floor.id;
          const Icon = FLOOR_ICONS[floor.id] ?? Sparkles;
          return (
            <button
              key={floor.id}
              type="button"
              className={`rail-item${active ? " is-active" : ""}`}
              onClick={() => onSelect(floor.id)}
              onPointerEnter={onHover ? () => onHover(floor.id) : undefined}
              onPointerLeave={onHover ? () => onHover(null) : undefined}
              onFocus={onHover ? () => onHover(floor.id) : undefined}
              onBlur={onHover ? () => onHover(null) : undefined}
              aria-current={active ? "step" : undefined}
              aria-label={`Explore ${floor.level}: ${floor.shortName}`}
            >
              <span className="rail-number">
                {floor.id === 0 ? "G" : String(floor.id).padStart(2, "0")}
              </span>
              <span className="rail-name">
                {floor.name.replace(/^The /, "").replace(/ Residence$/, "")}
              </span>
              <span className="rail-dot" />
              <span className="rail-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.4} /></span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function InteriorView({
  floor,
  onSelectFloor,
  onBack,
  resetSignal,
  onResetScene,
}: {
  floor: HotelFloor;
  onSelectFloor: (floorId: number) => void;
  onBack: () => void;
  resetSignal: number;
  onResetScene: () => void;
}) {
  const [selectedFeature, setSelectedFeature] = useState<InteriorFeature | null>(null);

  useEffect(() => {
    setSelectedFeature(null);
  }, [floor.id]);

  return (
    <motion.main
      className="interior-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="interior-scene">
        <InteriorScene
          floor={floor}
          resetSignal={resetSignal}
          onFeatureSelect={setSelectedFeature}
        />
      </div>
      <div className="interior-vignette" />

      <div className="interior-topline">
        <span>{floor.level}</span>
        <span className="interior-topline-rule" />
        <span>3D ROOM EXPERIENCE</span>
      </div>

      <motion.section
        className="interior-copy"
        key={`copy-${floor.id}`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.12 }}
      >
        <p className="eyebrow"><span className="eyebrow-mark" />{floor.tag}</p>
        <h1>{floor.name}</h1>
        <p className="interior-description">{floor.description}</p>
        <div className="interior-instructions">
          <span className="instruction-icon"><Compass size={13} /></span>
          <span>DRAG TO EXPLORE <i /> SCROLL TO ZOOM</span>
        </div>
        {/* The rate belongs to the floor's title: under the copy on desktop,
            folded into the title card on phones. */}
        {floor.rate && <BookingPanel floor={floor} rate={floor.rate} />}
      </motion.section>

      {selectedFeature && (
        <motion.aside
          className="feature-card"
          key={selectedFeature.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-live="polite"
        >
          <span className="feature-card-kicker"><Sparkles size={12} /> ROOM DETAIL</span>
          <strong>{selectedFeature.name}</strong>
          <span>{selectedFeature.note}</span>
        </motion.aside>
      )}

      <button
        className="interior-reset"
        type="button"
        title="Reset view"
        onClick={() => {
          setSelectedFeature(null);
          onResetScene();
        }}
        aria-label="Reset interior camera"
      >
        <RotateCcw size={14} /> Reset view
      </button>

      <div className="interior-bottom-controls">
        <button
          className="back-building"
          type="button"
          onClick={onBack}
          aria-label="Back to 3D building"
          title="Back to 3D building"
        >
          <span className="back-building-icon"><ArrowLeft size={15} /></span>
          <span>Back to 3D building</span>
        </button>
        <div className="interior-rail-wrap">
          <FloorRail activeFloor={floor.id} onSelect={onSelectFloor} compact />
        </div>
      </div>
      <div className="interior-image-credit">SELECT A DETAIL TO DISCOVER MORE</div>
    </motion.main>
  );
}

export default function App() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const sceneLayout = useSceneLayout();
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFloor = floors.find((floor) => floor.id === activeFloor) ?? floors[0];
  const previewFloor = floors.find(
    (floor) => floor.id === (selectedFloor ?? hoveredFloor),
  );

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
    },
    [],
  );

  const exploreFloor = useCallback((floorId: number) => {
    const alreadyExploringInterior = activeFloor !== null;
    setSelectedFloor(floorId);
    setHoveredFloor(null);
    setShowAbout(false);
    setIsEntering(true);
    if (enterTimer.current) clearTimeout(enterTimer.current);
    const enter = () => {
      setActiveFloor(floorId);
      setIsEntering(false);
    };
    if (alreadyExploringInterior) {
      enter();
    } else {
      enterTimer.current = setTimeout(enter, 700);
    }
  }, [activeFloor]);

  const resetCamera = () => {
    setSelectedFloor(null);
    setHoveredFloor(null);
    setIsEntering(false);
    setResetSignal((current) => current + 1);
    if (enterTimer.current) clearTimeout(enterTimer.current);
  };

  const returnToBuilding = () => {
    resetCamera();
    setActiveFloor(null);
  };

  const openAbout = () => {
    setShowAbout(true);
    setSelectedFloor(null);
    setHoveredFloor(null);
    setActiveFloor(null);
    setIsEntering(false);
    if (enterTimer.current) clearTimeout(enterTimer.current);
  };

  return (
    <div className={`app-shell${activeFloor === null ? ` is-landing is-${sceneLayout}` : ""}`}>
      <header className="site-header">
        <Brand />
        <nav className="top-nav" aria-label="Main navigation">
          <button
            type="button"
            className={!showAbout ? "top-nav-link is-current" : "top-nav-link"}
            onClick={() => {
              setShowAbout(false);
              setActiveFloor(null);
              resetCamera();
            }}
          >
            Explore hotel
          </button>
          <button
            type="button"
            className={showAbout ? "top-nav-link is-current" : "top-nav-link"}
            onClick={openAbout}
          >
            About
          </button>
          <button type="button" className="top-nav-link" onClick={() => exploreFloor(2)}>
            Rooms
          </button>
          <button type="button" className="top-nav-link" onClick={() => exploreFloor(1)}>
            Dining
          </button>
          {/* No gallery page yet: inert, like Book now, until it is connected. */}
          <button type="button" className="top-nav-link">
            Gallery
          </button>
        </nav>
        <button className="header-note" type="button" onClick={() => exploreFloor(2)}>
          <CalendarDays size={13} strokeWidth={1.5} />
          <span>Book a Stay</span>
        </button>
      </header>

      <main className="experience" id="explore">
        <AnimatePresence mode="wait">
          {activeFloor !== null ? (
            <InteriorView
              key="interior"
              floor={currentFloor}
              onSelectFloor={exploreFloor}
              onBack={returnToBuilding}
              resetSignal={resetSignal}
              onResetScene={() => setResetSignal((current) => current + 1)}
            />
          ) : (
            <motion.div
              key="building"
              className="building-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <HotelHero
                floors={floors}
                layout={sceneLayout}
                selectedFloor={selectedFloor}
                hoveredFloor={hoveredFloor}
                onHover={isEntering ? () => undefined : setHoveredFloor}
                onSelect={exploreFloor}
              />

              <div className="landing-html">
              <section className="hero-title" aria-label="Aurelia Milano">
                <p className="eyebrow"><span className="eyebrow-mark" />A NEW PERSPECTIVE ON MILAN</p>
                <h1>A stay, <em>well</em><br />considered.</h1>
                <p className="hero-subtitle">
                  Experience refined comfort in the heart of Milan, where Italian
                  heritage meets modern living.
                </p>
              </section>

              <FloorRail
                activeFloor={selectedFloor ?? hoveredFloor}
                onSelect={exploreFloor}
                onHover={isEntering ? undefined : setHoveredFloor}
              />

              <div className="scene-caption">
                <span className="caption-orbit"><Compass size={14} strokeWidth={1.4} /></span>
                <span>SELECT A FLOOR TO EXPLORE</span>
                <span className="caption-separator" />
                <span className="caption-orbit caption-orbit--plain"><Orbit size={18} strokeWidth={1.3} /></span>
                <span className="caption-hint-mouse">HOVER TO PREVIEW</span>
                <span className="caption-hint-touch">TAP · SWIPE TO PREVIEW</span>
              </div>

              <button
                className={`camera-reset${hoveredFloor !== null || selectedFloor !== null ? " is-armed" : ""}`}
                type="button"
                onClick={resetCamera}
                aria-label="Reset camera position"
                title="Reset camera"
              >
                <RotateCcw size={15} strokeWidth={1.55} />
                <span>Reset view</span>
              </button>
              </div>

              {showAbout && (
                <motion.aside
                  className="about-card"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    className="about-close"
                    type="button"
                    onClick={() => setShowAbout(false)}
                    aria-label="Close about panel"
                  >
                    ×
                  </button>
                  <p className="eyebrow"><span className="eyebrow-mark" />OUR POINT OF VIEW</p>
                  <h2>Rooted in Milan.<br /><em>Made for elsewhere.</em></h2>
                  <p>
                    Aurelia is a small love letter to the city: six thoughtful
                    floors, a familiar warmth, and room to see things differently.
                  </p>
                  <button
                    className="about-explore"
                    type="button"
                    onClick={() => exploreFloor(0)}
                  >
                    Begin on the ground floor <ArrowRight size={14} />
                  </button>
                </motion.aside>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">AURELIA MILANO</span>
        <span className="footer-center">A BOUTIQUE HOTEL IN MILAN</span>
        <span className="footer-place"><MapPin size={15} strokeWidth={1.5} /> MILANO, ITALIA</span>
      </footer>
    </div>
  );
}
