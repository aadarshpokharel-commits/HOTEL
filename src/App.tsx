import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Compass,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import InteriorScene, { type InteriorFeature } from "./components/InteriorScene";
import HotelScene from "./components/HotelScene";
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
          <span className="booking-unit">/ night</span>
        </span>
        <span className="booking-note">{rate.note}</span>
      </div>
      <button
        type="button"
        className="booking-button"
        onClick={onBook ? () => onBook(floor) : undefined}
        aria-label={`Book ${floor.name}, from ${formatRate(rate)} per night`}
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

function FloorRail({
  activeFloor,
  onSelect,
  compact = false,
}: {
  activeFloor: number | null;
  onSelect: (floorId: number) => void;
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
          return (
            <button
              key={floor.id}
              type="button"
              className={`rail-item${active ? " is-active" : ""}`}
              onClick={() => onSelect(floor.id)}
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
      className={`interior-view${floor.rate ? " interior-view--bookable" : ""}`}
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
      {floor.rate && <BookingPanel floor={floor} rate={floor.rate} />}
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
    <div className="app-shell">
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
        </nav>
        <a className="header-note" href="#explore">
          A PLACE TO <span>STAY A LITTLE LONGER</span>
          <ArrowDownRight size={14} strokeWidth={1.5} />
        </a>
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
              <div className="scene-backdrop" />
              <div className="canvas-wrap">
                <HotelScene
                  floors={floors}
                  selectedFloor={selectedFloor}
                  onSelectFloor={exploreFloor}
                  onHoverFloor={setHoveredFloor}
                  onFocusBuilding={resetCamera}
                  resetSignal={resetSignal}
                  controlsLocked={isEntering}
                />
              </div>

              <section className="hero-title" aria-label="Aurelia Milano">
                <p className="eyebrow"><span className="eyebrow-mark" />A NEW PERSPECTIVE ON MILAN</p>
                <h1>A stay, <em>well</em><br />considered.</h1>
                <p className="hero-subtitle">AURELIA MILANO</p>
              </section>

              <FloorRail activeFloor={selectedFloor} onSelect={exploreFloor} />

              <div className="scene-caption">
                <span className="caption-orbit"><Compass size={14} strokeWidth={1.4} /></span>
                <span>SELECT A FLOOR TO EXPLORE</span>
                <span className="caption-separator" />
                <span>DRAG TO ORBIT</span>
              </div>

              <button
                className="camera-reset"
                type="button"
                onClick={resetCamera}
                aria-label="Reset camera position"
                title="Reset camera"
              >
                <RotateCcw size={15} strokeWidth={1.55} />
                <span>Reset view</span>
              </button>

              {previewFloor && (
                <motion.div
                  className="selection-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <span className="selection-card-number">
                    {previewFloor.id === 0 ? "G" : String(previewFloor.id).padStart(2, "0")}
                  </span>
                  <span className="selection-card-copy">
                    <span>{previewFloor.level}</span>
                    <strong>{previewFloor.shortName}</strong>
                    {previewFloor.rate && (
                      <span className="selection-card-rate">
                        From <b>{formatRate(previewFloor.rate)}</b> / night
                      </span>
                    )}
                  </span>
                  <span className="selection-card-icon"><Sparkles size={14} /></span>
                </motion.div>
              )}

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

              <div className="hero-footnote">
                <span>AN EXPLORATION IN HOSPITALITY</span>
                <span>SCROLL TO DISCOVER</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer className="site-footer">
        <span>© AURELIA MILANO</span>
        <span className="footer-center">MADE OF PLACE, MADE TO FEEL LIKE YOURS</span>
      </footer>
    </div>
  );
}
