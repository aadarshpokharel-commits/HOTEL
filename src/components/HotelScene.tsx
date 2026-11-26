import { ContactShadows, Environment, Lightformer, OrbitControls, Text } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { HotelFloor } from "../data/floors";
import { Surface, SurfaceUVs } from "../three/Surface";

type HotelSceneProps = {
  floors: HotelFloor[];
  selectedFloor: number | null;
  onSelectFloor: (id: number) => void;
  onHoverFloor: (id: number | null) => void;
  onFocusBuilding: () => void;
  resetSignal: number;
  controlsLocked: boolean;
};

const BUILDING_WIDTH = 4.8;
const BUILDING_DEPTH = 3.25;
const FLOOR_HEIGHT = 1.02;
const GROUND_Y = 0.18;
const GOLD = "#c8aa79";
const BRONZE = "#66503a";
const STONE = "#c5b79e";
// The exterior model is built at roughly 1:3 (a 1.02-unit floor is a ~3.2 m
// storey), so real-world texture tiles are scaled down to match.
const EXTERIOR_SCALE = 0.32;
// The previous limestone map darkened and warmed its base colour; keep that tone.
const LIMESTONE_TONE = new THREE.Color().setRGB(0.745, 0.715, 0.648, THREE.SRGBColorSpace);

function LimestoneMaterial({ color = STONE }: { color?: string }) {
  const tone = useMemo(() => new THREE.Color(color).multiply(LIMESTONE_TONE), [color]);
  return (
    <Surface
      kind="limestone"
      textureScale={EXTERIOR_SCALE}
      color={tone}
      roughness={0.82}
      metalness={0.015}
    />
  );
}

function BronzeMaterial({ color = BRONZE }: { color?: string }) {
  return (
    <Surface
      kind="brass"
      textureScale={EXTERIOR_SCALE}
      color={color}
      roughness={0.38}
      metalness={0.72}
    />
  );
}

function FloorLevel({
  floor,
  isActive,
  isHovered,
  hasSelection,
  onHover,
  onSelect,
}: {
  floor: HotelFloor;
  isActive: boolean;
  isHovered: boolean;
  hasSelection: boolean;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}) {
  const y = GROUND_Y + floor.id * FLOOR_HEIGHT;
  const width = floor.id === 5 ? 4.12 : floor.id === 4 ? 4.52 : 4.8;
  const setback = floor.id >= 4 ? 0.17 : 0;
  const depth = floor.id === 5 ? 2.96 : BUILDING_DEPTH;
  const hasBalcony = floor.id === 1 || floor.id === 2 || floor.id === 4;
  const balconyWidth = floor.id === 4 ? 2.55 : width - 0.25;
  const windowCount = floor.id === 0 ? 4 : floor.id === 5 ? 3 : 5;
  const windowWidth = (width - 0.54) / windowCount - 0.12;
  const highlight = isActive || isHovered;
  const isDimmed = hasSelection && !isActive;
  const clickFloor = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(floor.id);
  };
  const hoverFloor = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(floor.id);
  };

  const floorOutlineMaterial = highlight ? GOLD : "#000000";

  return (
    <group position={[setback, y, 0]}>
      <mesh
        position={[0, FLOOR_HEIGHT / 2, 0]}
        onClick={clickFloor}
        onPointerOver={hoverFloor}
        onPointerOut={(event) => {
          event.stopPropagation();
          onHover(null);
        }}
      >
        <bevelBoxGeometry args={[width + 0.15, FLOOR_HEIGHT - 0.12, depth + 0.15]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
        <bevelBoxGeometry args={[width + 0.24, 0.09, depth + 0.26]} />
        <LimestoneMaterial color={highlight ? "#d1c2a8" : isDimmed ? "#7a766e" : "#c5b79e"} />
      </mesh>
      <mesh position={[0, 0.096, 0]} castShadow>
        <bevelBoxGeometry args={[width + 0.18, 0.018, depth + 0.2]} />
        <BronzeMaterial color="#71604b" />
      </mesh>
      <mesh position={[0, FLOOR_HEIGHT - 0.025, 0]} castShadow>
        <bevelBoxGeometry args={[width + 0.2, 0.055, depth + 0.22]} />
        <LimestoneMaterial color={highlight ? "#d8c8aa" : "#b7a88e"} />
      </mesh>

      <mesh position={[0, FLOOR_HEIGHT * 0.49, -depth / 2 + 0.07]} castShadow receiveShadow>
        <bevelBoxGeometry args={[width, FLOOR_HEIGHT - 0.18, 0.14]} />
        <LimestoneMaterial color={isDimmed ? "#77736b" : "#c9bea9"} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (width / 2 - 0.105), FLOOR_HEIGHT / 2, 0]}>
          <mesh castShadow>
            <bevelBoxGeometry args={[0.21, FLOOR_HEIGHT - 0.11, depth]} />
            <LimestoneMaterial color={isDimmed ? "#77736b" : "#c7b99f"} />
          </mesh>
          {[-1.02, 0, 1.02].map((windowZ, index) => (
            <group
              key={windowZ}
              position={[side * 0.112, 0, windowZ]}
              rotation={[0, side * Math.PI / 2, 0]}
            >
              <mesh position={[0, 0, -0.02]}>
                <bevelBoxGeometry args={[0.54, 0.72, 0.045]} />
                <Surface kind="satin" textureScale={EXTERIOR_SCALE} color="#252725" roughness={0.8} />
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[0.45, 0.62]} />
                <meshPhysicalMaterial
                  color={index === 1 ? "#b4c0bc" : "#8e9b99"}
                  roughness={0.18}
                  metalness={0.22}
                  transparent
                  opacity={0.46}
                  envMapIntensity={1.2}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
              {[-0.24, 0.24].map((frameX) => (
                <mesh key={frameX} position={[frameX, 0, 0.035]}>
                  <bevelBoxGeometry args={[0.035, 0.68, 0.045]} />
                  <BronzeMaterial color="#514538" />
                </mesh>
              ))}
              {[-0.33, 0.33].map((frameY) => (
                <mesh key={frameY} position={[0, frameY, 0.035]}>
                  <bevelBoxGeometry args={[0.5, 0.035, 0.045]} />
                  <BronzeMaterial color="#514538" />
                </mesh>
              ))}
              <mesh position={[0, 0, 0.035]}>
                <bevelBoxGeometry args={[0.022, 0.62, 0.045]} />
                <BronzeMaterial color="#66553f" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.035, depth / 2 + 0.012]}>
            <bevelBoxGeometry args={[0.045, FLOOR_HEIGHT - 0.2, 0.025]} />
            <BronzeMaterial color="#8b7557" />
          </mesh>
        </group>
      ))}

      {Array.from({ length: windowCount }, (_, index) => {
        const x = -width / 2 + 0.34 + (index + 0.5) * ((width - 0.68) / windowCount);
        const frontZ = depth / 2 - 0.03;
        const winHeight = floor.id === 0 ? 0.71 : 0.69;
        const baseY = floor.id === 0 ? 0.43 : 0.48;
        const isFeatureBay =
          (floor.id === 1 && index === 1) ||
          (floor.id === 2 && index === 3) ||
          (floor.id === 4 && index === 1);
        const widthThisWindow = isFeatureBay ? windowWidth * 1.28 : windowWidth;
        return (
          <group key={index} position={[x, 0, frontZ]}>
            <mesh position={[0, FLOOR_HEIGHT * 0.49, -0.07]}>
              <bevelBoxGeometry args={[widthThisWindow + 0.13, FLOOR_HEIGHT - 0.2, 0.13]} />
              <Surface kind="satin" textureScale={EXTERIOR_SCALE} color="#292b28" roughness={0.86} />
            </mesh>
            <mesh position={[0, baseY + winHeight / 2, 0]}>
              <planeGeometry args={[widthThisWindow, winHeight]} />
              <meshPhysicalMaterial
                color="#a9b5b4"
                roughness={0.14}
                metalness={0.28}
                transparent
                opacity={0.48}
                envMapIntensity={1.35}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {[-widthThisWindow / 2, widthThisWindow / 2].map((frameX) => (
              <mesh key={frameX} position={[frameX, baseY + winHeight / 2, 0.014]}>
                <bevelBoxGeometry args={[0.042, winHeight + 0.055, 0.055]} />
                <BronzeMaterial color="#514538" />
              </mesh>
            ))}
            {[
              [0, baseY - 0.018, widthThisWindow + 0.08, 0.045],
              [0, baseY + winHeight + 0.022, widthThisWindow + 0.08, 0.045],
              [0, baseY + winHeight * 0.52, widthThisWindow, 0.022],
            ].map(([frameX, frameY, frameWidth, frameHeight], frameIndex) => (
              <mesh key={frameIndex} position={[frameX, frameY, 0.025]}>
                <bevelBoxGeometry args={[frameWidth, frameHeight, 0.055]} />
                <BronzeMaterial color="#554838" />
              </mesh>
            ))}
            <mesh position={[0, baseY + winHeight * 0.52, 0.036]}>
              <bevelBoxGeometry args={[0.024, winHeight, 0.035]} />
              <BronzeMaterial color="#66553f" />
            </mesh>
            {/* Stone sill with a slight projection, and sheer drapes inside the glass. */}
            <mesh position={[0, baseY - 0.058, 0.045]} castShadow>
              <bevelBoxGeometry args={[widthThisWindow + 0.16, 0.032, 0.1]} />
              <LimestoneMaterial color="#d4c6ab" />
            </mesh>
            {floor.id > 0 &&
              [-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[side * (widthThisWindow / 2 - widthThisWindow * 0.09), baseY + winHeight / 2, -0.003]}
                >
                  <bevelBoxGeometry args={[widthThisWindow * 0.16, winHeight - 0.03, 0.003]} />
                  <Surface
                    kind="linen"
                    textureScale={EXTERIOR_SCALE}
                    color="#d8c9ae"
                    roughness={0.95}
                    emissive="#6b4f2c"
                    emissiveIntensity={0.18}
                  />
                </mesh>
              ))}
            {floor.id === 0 && (
              <mesh position={[0, FLOOR_HEIGHT * 0.47, 0.032]}>
                <bevelBoxGeometry args={[widthThisWindow * 0.42, 0.035, 0.024]} />
                <meshStandardMaterial
                  color="#f4d5a0"
                  emissive="#d89c51"
                  emissiveIntensity={0.7}
                  roughness={0.32}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {floor.id === 3 && (
        <mesh position={[0, FLOOR_HEIGHT * 0.51, depth / 2 + 0.025]}>
          <bevelBoxGeometry args={[0.06, FLOOR_HEIGHT - 0.2, 0.11]} />
          <BronzeMaterial color="#8d785e" />
        </mesh>
      )}

      {hasBalcony && (
        <group position={[0, 0.13, depth / 2 + 0.37]}>
          <mesh position={[0, 0, 0.14]} castShadow receiveShadow>
            <bevelBoxGeometry args={[balconyWidth, 0.075, 0.93]} />
            <LimestoneMaterial color="#b4a58c" />
          </mesh>
          <mesh position={[0, 0.49, 0.57]} castShadow>
            <bevelBoxGeometry args={[balconyWidth - 0.08, 0.025, 0.025]} />
            <BronzeMaterial color="#65533d" />
          </mesh>
          <mesh position={[0, 0.25, 0.57]}>
            <bevelBoxGeometry args={[balconyWidth - 0.15, 0.39, 0.018]} />
            <meshPhysicalMaterial
              color="#b5c5c1"
              roughness={0.16}
              metalness={0.12}
              transparent
              opacity={0.32}
              transmission={0.35}
              thickness={0.04}
              side={THREE.DoubleSide}
              envMapIntensity={1.25}
            />
          </mesh>
          {Array.from({ length: Math.floor(balconyWidth / 0.56) }, (_, index) => {
            const count = Math.floor(balconyWidth / 0.56);
            const postX = -((count - 1) * 0.56) / 2 + index * 0.56;
            return (
              <mesh key={index} position={[postX, 0.25, 0.58]}>
                <bevelBoxGeometry args={[0.018, 0.4, 0.025]} />
                <BronzeMaterial color="#806a4d" />
              </mesh>
            );
          })}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (balconyWidth / 2 - 0.035), 0.22, 0.12]}>
              <bevelBoxGeometry args={[0.05, 0.045, 0.82]} />
              <BronzeMaterial color="#67543e" />
            </mesh>
          ))}
          <mesh position={[0, -0.047, 0.2]}>
            <bevelBoxGeometry args={[balconyWidth * 0.72, 0.014, 0.022]} />
            <Surface kind="brass" textureScale={EXTERIOR_SCALE} color="#8e7c62" roughness={0.48} metalness={0.4} />
          </mesh>
        </group>
      )}

      {floor.id === 0 && (
        <group position={[0, 0, depth / 2 + 0.54]}>
          <mesh position={[0, 0.66, 0.02]} castShadow>
            <bevelBoxGeometry args={[2.6, 0.075, 0.92]} />
            <LimestoneMaterial color="#b5a586" />
          </mesh>
          {[-1.15, 1.15].map((x) => (
            <mesh key={x} position={[x, 0.31, 0.02]}>
              <bevelBoxGeometry args={[0.055, 0.65, 0.08]} />
              <BronzeMaterial color="#735c40" />
            </mesh>
          ))}
          <mesh position={[0, 0.98, 0.4]} castShadow>
            <bevelBoxGeometry args={[3.1, 0.045, 0.025]} />
            <meshStandardMaterial
              color="#ffd899"
              emissive="#e8a84f"
              emissiveIntensity={1.35}
              roughness={0.4}
            />
          </mesh>
        </group>
      )}

      {Array.from({ length: 3 }, (_, index) => (
        <mesh key={index} position={[-width * 0.32 + index * width * 0.32, 0.13, -depth / 2 + 0.1]}>
          <bevelBoxGeometry args={[width * 0.18, 0.018, 0.012]} />
          <Surface kind="limestone" textureScale={EXTERIOR_SCALE} color="#8f806b" roughness={0.82} />
        </mesh>
      ))}

      {highlight && (
        <mesh
          position={[0, FLOOR_HEIGHT / 2, 0]}
          scale={[1.012, 1.015, 1.016]}
          raycast={() => null}
        >
          <bevelBoxGeometry args={[width + 0.2, FLOOR_HEIGHT - 0.1, depth + 0.23]} />
          <meshBasicMaterial
            color={floorOutlineMaterial}
            wireframe
            transparent
            opacity={isActive ? 0.72 : 0.42}
            depthWrite={false}
          />
        </mesh>
      )}

      <Text
        position={[-width / 2 + 0.16, FLOOR_HEIGHT / 2, depth / 2 + 0.09]}
        fontSize={0.16}
        color={highlight ? "#f0d7ad" : "#aba18f"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#24231f"
        raycast={() => null}
      >
        {floor.id === 0 ? "G" : String(floor.id).padStart(2, "0")}
      </Text>
    </group>
  );
}

function CameraRig({
  selectedFloor,
  resetSignal,
  controls,
}: {
  selectedFloor: number | null;
  resetSignal: number;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, size } = useThree();
  const cameraTarget = useRef(new THREE.Vector3(8, 6, 12));
  const controlsTarget = useRef(new THREE.Vector3(0, 2.85, 0));
  const isAnimating = useRef(false);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = size.width < 640 ? 48 : 36;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width]);

  useEffect(() => {
    if (selectedFloor === null) {
      cameraTarget.current.set(8, 6.15, 12);
      controlsTarget.current.set(0, 2.85, 0);
    } else {
      const focusY = GROUND_Y + selectedFloor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
      controlsTarget.current.set(0, focusY, 0);
      cameraTarget.current.set(4.1, focusY + 1.25, 7.5);
    }
    isAnimating.current = true;
  }, [selectedFloor, resetSignal]);

  useFrame((_, delta) => {
    if (!isAnimating.current || !controls.current) return;

    const easing = 1 - Math.exp(-delta * 2.4);
    controls.current.target.lerp(controlsTarget.current, easing);
    camera.position.lerp(cameraTarget.current, easing);
    controls.current.update();

    if (
      camera.position.distanceToSquared(cameraTarget.current) < 0.0004 &&
      controls.current.target.distanceToSquared(controlsTarget.current) < 0.0004
    ) {
      camera.position.copy(cameraTarget.current);
      controls.current.target.copy(controlsTarget.current);
      controls.current.update();
      isAnimating.current = false;
    }
  });

  return null;
}

function Building({
  floors,
  selectedFloor,
  onSelectFloor,
  onHoverFloor,
}: Pick<HotelSceneProps, "floors" | "selectedFloor" | "onSelectFloor" | "onHoverFloor">) {
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const handleHover = (floorId: number | null) => {
    setHoveredFloor(floorId);
    onHoverFloor(floorId);
  };

  return (
    <group>
      <mesh position={[0, -0.04, 0]} receiveShadow castShadow>
        <bevelBoxGeometry args={[BUILDING_WIDTH + 0.7, 0.16, BUILDING_DEPTH + 0.66]} />
        <LimestoneMaterial color="#9d927d" />
      </mesh>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <bevelBoxGeometry args={[BUILDING_WIDTH + 1.1, 0.09, BUILDING_DEPTH + 1.08]} />
        <Surface kind="limestone" textureScale={EXTERIOR_SCALE} color="#34332e" roughness={0.78} metalness={0.08} />
      </mesh>
      {Array.from({ length: 11 }, (_, index) => (
        <mesh key={index} position={[-2.7 + index * 0.54, -0.109, BUILDING_DEPTH / 2 + 0.77]}>
          <bevelBoxGeometry args={[0.5, 0.012, 0.9]} />
          <Surface kind="limestone" textureScale={EXTERIOR_SCALE}
            color={index % 2 ? "#716653" : "#8d7e66"}
            roughness={0.76}
          />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.85, 0, BUILDING_DEPTH / 2 + 0.55]}>
          <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
            <bevelBoxGeometry args={[0.66, 0.52, 0.7]} />
            <LimestoneMaterial color="#9e8c70" />
          </mesh>
          <mesh position={[0, 0.59, 0]}>
            <cylinderGeometry args={[0.24, 0.26, 0.1, 20]} />
            <Surface kind="plaster" textureScale={EXTERIOR_SCALE} color="#514536" roughness={0.92} />
          </mesh>
          {[-0.12, 0, 0.12].map((x, index) => (
            <mesh key={x} position={[x, 0.92 + (index === 1 ? 0.18 : 0), 0]} castShadow>
              <sphereGeometry args={[0.21, 10, 12]} />
              <Surface kind="foliage" textureScale={EXTERIOR_SCALE} color={index === 1 ? "#566449" : "#667452"} roughness={0.88} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.15, BUILDING_DEPTH / 2 + 1.33]} receiveShadow>
        <bevelBoxGeometry args={[2.9, 0.16, 0.72]} />
        <LimestoneMaterial color="#c7b89d" />
      </mesh>
      <mesh position={[0, 0.238, BUILDING_DEPTH / 2 + 1.33]}>
        <bevelBoxGeometry args={[2.75, 0.014, 0.56]} />
        <Surface kind="rug" textureScale={EXTERIOR_SCALE} color="#72624b" roughness={0.58} />
      </mesh>
      {[-1.28, 1.28].map((x) => (
        <mesh key={x} position={[x, 0.49, BUILDING_DEPTH / 2 + 1.33]} castShadow>
          <bevelBoxGeometry args={[0.035, 0.62, 0.04]} />
          <BronzeMaterial color="#725d40" />
        </mesh>
      ))}
      <mesh position={[0, 0.82, BUILDING_DEPTH / 2 + 1.33]}>
        <bevelBoxGeometry args={[2.67, 0.025, 0.035]} />
        <meshStandardMaterial
          color="#f0c983"
          emissive="#d89c51"
          emissiveIntensity={1.2}
          roughness={0.38}
        />
      </mesh>

      {floors.map((floor) => (
        <FloorLevel
          key={floor.id}
          floor={floor}
          isActive={selectedFloor === floor.id}
          isHovered={hoveredFloor === floor.id}
          hasSelection={selectedFloor !== null}
          onHover={handleHover}
          onSelect={onSelectFloor}
        />
      ))}

      <group position={[0, GROUND_Y + floors.length * FLOOR_HEIGHT + 0.12, 0]}>
        <mesh castShadow receiveShadow>
          <bevelBoxGeometry args={[4.32, 0.11, 3.13]} />
          <LimestoneMaterial color="#b9aa8f" />
        </mesh>
        <mesh position={[0, 0.15, -0.15]} castShadow>
          <bevelBoxGeometry args={[3.9, 0.08, 2.72]} />
          <BronzeMaterial color="#665945" />
        </mesh>
        <mesh position={[0, 0.24, -0.15]} castShadow>
          <bevelBoxGeometry args={[3.68, 0.075, 2.48]} />
          <LimestoneMaterial color="#c4b698" />
        </mesh>
        <mesh position={[0, 0.3, -0.15]}>
          <bevelBoxGeometry args={[3.6, 0.02, 2.4]} />
          <Surface kind="satin" textureScale={EXTERIOR_SCALE} color="#656253" roughness={0.62} />
        </mesh>
        {[-1.55, -0.8, 0, 0.8, 1.55].map((x) => (
          <mesh key={x} position={[x, 0.36, -0.15]}>
            <bevelBoxGeometry args={[0.026, 0.012, 2.38]} />
            <Surface kind="brass" textureScale={EXTERIOR_SCALE} color="#98866a" roughness={0.45} metalness={0.35} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 1.72, 0.36, 0]}>
            <mesh position={[0, 0.045, -0.28]} castShadow>
              <bevelBoxGeometry args={[0.48, 0.1, 0.52]} />
              <LimestoneMaterial color="#a59579" />
            </mesh>
            <mesh position={[0, 0.15, -0.28]}>
              <cylinderGeometry args={[0.18, 0.18, 0.08, 18]} />
              <Surface kind="plaster" textureScale={EXTERIOR_SCALE} color="#40382e" roughness={0.9} />
            </mesh>
            {[-0.09, 0.09].map((x) => (
              <mesh key={x} position={[x, 0.39, -0.28]} castShadow>
                <sphereGeometry args={[0.16, 9, 10]} />
                <Surface kind="foliage" textureScale={EXTERIOR_SCALE} color="#607150" roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0.1, 0.65]} castShadow>
          <bevelBoxGeometry args={[2.1, 0.12, 0.62]} />
          <LimestoneMaterial color="#ab9a7e" />
        </mesh>
        <mesh position={[0, 0.18, 0.65]}>
          <bevelBoxGeometry args={[1.96, 0.018, 0.52]} />
          <BronzeMaterial color="#6e5940" />
        </mesh>
      </group>

      <Text
        position={[0, GROUND_Y + floors.length * FLOOR_HEIGHT + 0.38, BUILDING_DEPTH / 2 + 0.11]}
        fontSize={0.16}
        color="#dfd5c2"
        letterSpacing={0.23}
        anchorX="center"
        anchorY="middle"
        raycast={() => null}
      >
        A U R E L I A
      </Text>
    </group>
  );
}

export default function HotelScene({
  floors,
  selectedFloor,
  onSelectFloor,
  onHoverFloor,
  onFocusBuilding,
  resetSignal,
  controlsLocked,
}: HotelSceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [8, 6.15, 12], fov: 36, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      onPointerMissed={() => undefined}
      onDoubleClick={() => onFocusBuilding()}
    >
      <color attach="background" args={["#111312"]} />
      <fog attach="fog" args={["#111312", 18, 32]} />
      <ambientLight intensity={0.56} />
      <hemisphereLight args={["#e2ddcf", "#373027", 1.2]} />
      <directionalLight
        position={[-7, 12, 8]}
        intensity={2.25}
        color="#ffe0b0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={25}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={12}
        shadow-camera-bottom={-5}
      />
      <pointLight position={[5, 5, -4]} intensity={24} color="#cbd6d6" />
      <pointLight position={[0, 1, BUILDING_DEPTH / 2 + 2.2]} intensity={7} distance={7} color="#e3b978" />
      <Environment resolution={128} background={false}>
        <Lightformer form="rect" intensity={2.3} position={[-5, 5, -5]} scale={[8, 5, 1]} color="#e5dfd1" />
        <Lightformer form="rect" intensity={1.7} position={[5, 4, 4]} scale={[6, 4, 1]} color="#f3d9ac" />
        <Lightformer form="rect" intensity={1.4} position={[0, 6, 0]} scale={[10, 0.5, 1]} color="#fff4dd" />
      </Environment>
      <SurfaceUVs />
      <Building
        floors={floors}
        selectedFloor={selectedFloor}
        onSelectFloor={onSelectFloor}
        onHoverFloor={onHoverFloor}
      />
      <ContactShadows
        position={[0, -0.19, 0]}
        opacity={0.42}
        scale={11}
        blur={2.8}
        far={5}
        resolution={512}
        color="#070807"
      />
      <CameraRig
        selectedFloor={selectedFloor}
        resetSignal={resetSignal}
        controls={controls}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!controlsLocked}
        enableDamping
        dampingFactor={0.065}
        minDistance={7}
        maxDistance={23}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2.03}
        target={[0, 2.85, 0]}
        panSpeed={0.65}
        rotateSpeed={0.55}
      />
    </Canvas>
  );
}
