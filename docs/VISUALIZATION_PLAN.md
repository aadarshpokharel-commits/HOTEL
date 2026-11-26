# Aurelia — architectural visualization upgrade plan

Living document: the status column is the source of truth for what is done.
Nothing is marked done until it is built, type-checked and checked in the app.

## 1. What exists today (inspection, 2026-11-26)

| Area | Implementation | Notes |
| --- | --- | --- |
| App shell | `src/App.tsx` | Header, floor rail, building ↔ interior transition (framer-motion), about panel. |
| Floor data | `src/data/floors.ts` | 6 floors: G = reception/lobby, 1–5 = one-bedroom residences. **No restaurant floor exists.** |
| Exterior | `src/components/HotelScene.tsx` | One `FloorLevel` per floor built from ~70 primitive boxes, branching on `floor.id`. Invisible hit-box per floor for hover/select, gold wireframe highlight, floor label text, `CameraRig` that eases to a floor. |
| Interiors | `src/components/InteriorScene.tsx` (1.8k lines) | One shared room shell; furniture from boxes, cylinders, spheres and drei `RoundedBox`. `FEATURES` table drives clickable room details; selection rings and camera focus points are separate lookup tables keyed by feature id. |
| Materials | `src/three/surfaces.ts`, `src/three/Surface.tsx` | Procedural, tileable PBR sets (albedo, roughness, normal) for 12 kinds, scene-scale UVs, bevelled boxes. |
| 3D assets | none | No GLB/GLTF, no HDRI, no image textures; `public/` is empty. |
| Rendering | R3F `Canvas` ×2 | ACES tone mapping, sRGB output, PCF soft shadows (2048²), drei `Environment` built from `Lightformer`s, `ContactShadows`. No AO. |
| Deployment | Vite static build | No `vercel.json` in the repo; Vercel uses its Vite defaults (`npm run build` → `dist/`). Nothing here should change that. |

Interaction contract to preserve: floor hover → preview card; floor click →
camera eases to floor then 700 ms later the interior opens; double-click resets;
interior: click a feature → card + camera focus; Reset view; Back to building;
floor rail in both views; mobile layout at ≤640 px.

## 2. Asset strategy

* **Sources:** Poly Haven (models, textures, HDRIs — CC0) and ambientCG
  (textures — CC0) first. Both are public-domain-equivalent and allow
  commercial use without attribution. Sketchfab/BlenderKit need an account and
  per-asset licence checks; only used if the user approves specific assets.
* **Coverage reality:** CC0 libraries have good sofas, armchairs, tables,
  lamps, plants, vases, frames and some bathroom fixtures, but few or no beds,
  wardrobes, showers or restaurant tableware sets. Those are modelled in code
  as detailed parametric components (real dimensions, bevels, upholstery
  seams, layered bedding) rather than left as primitives.
* **Layout:** `public/models/<category>/…glb`, `public/textures/<category>/…`,
  `public/hdri/…`, plus `public/assets-manifest.json` recording source URL,
  author, licence and date for every file.
* **Pipeline:** `useGLTF` with Draco/Meshopt, cached per URL, lazy-loaded per
  floor via `Suspense`; mobile gets 1k textures, desktop 2k; repeated pieces
  use instancing or merged geometry.
* **Downloads need the user's go-ahead** (file names, sources and sizes are
  listed before downloading).

## 3. Phases and status

### Phase 1 — Exterior architecture *(done, 2026-11-26)*

| Item | Status |
| --- | --- |
| Merged-geometry architecture builder (few draw calls per floor, world-scale UVs) | ✅ |
| Travertine and board-formed concrete materials | ✅ |
| Structural grid facade: corner piers, pilasters, thin expressed slabs | ✅ |
| Recessed windows with stone reveals, sills, bronze frames, mullions | ✅ |
| Lit room depth behind glass (2700 K, per-window variation, drawn drapes) | ✅ |
| Floor variations: G portico, F1 French balconies, F2 projecting balconies, F3 punched windows, F4 deep loggia with fins and terrace, F5 glass penthouse pavilion | ✅ |
| Entrance: portico, storefront, doors, canopy with signage and downlights, steps | ✅ |
| Service core with lift overrun, rooftop plant room, roof slab and fascia | ✅ |
| Podium/foundation, paving, planters with trees, bollards, uplights | ✅ |
| Preserve hover/select hit-boxes, highlight, labels, camera rig | ✅ |

Verified: `tsc` and `vite build` pass; in the browser, hover preview, 3D floor
click → camera move → interior, Back to building, and the 375 px mobile layout
all work with no console errors after a clean reload. Draw calls stay low: each
storey is ~12 merged meshes regardless of detail.

Known gaps carried forward: the lobby behind the portico is only partly
visible at the default camera angle (Phase 4/5 lighting); the large paving
plane is still flat stone (no joints or street furniture beyond bollards);
exterior glass uses the Lightformer environment, not an HDRI (Phase 5).

### Phase 2 — Bedrooms
*Done, 2026-11-26.* Applies to all five residence floors (`src/components/interior/Bedroom.tsx`).

| Item | Source | Status |
| --- | --- | --- |
| Asset pipeline: local GLB (meshopt + WebP), desktop/mobile variants, cached `useGLTF`, Suspense per model, preload on residence entry | code | ✅ |
| PBR texture sets with AO at real-world scale (`src/three/pbr.tsx`) | Poly Haven CC0 | ✅ |
| Asset manifest with source, author, licence (`public/assets-manifest.json`) | — | ✅ |
| Lounge chair, desk chair, ottoman, globe pendants, plant, vases, photo frame | **Poly Haven GLB** | ✅ |
| Herringbone parquet, wool upholstery, walnut veneer | **Poly Haven textures** | ✅ |
| Bed: plinth, upholstered base, mattress, channel-tufted headboard on walnut wall panel | code-built | ✅ |
| Bedding with real drape: duvet with turned-down fold, wool throw, pinched-seam pillows | code-built (deformed meshes) | ✅ |
| Floating walnut nightstands, ceramic lathe-turned lamps with linen shades | code-built | ✅ |
| Walnut wardrobe, full-length mirror, wall TV, writing desk on brass frame | code-built | ✅ |
| Window with bronze frame, dusk city view, pleated drapes and sheer | code-built | ✅ |
| Wool rug, framed artwork above the bed | code-built | ✅ |
| Queen bed on floors 1–3, king on 4–5 | — | ✅ |

Verified: `tsc` and `vite build` pass; residence opens with no console errors;
clicking the bed opens its detail card and focuses the camera; mobile loads
only `.mobile` assets; the building view loads no interior assets.

Not done / carried forward: `modern_wooden_cabinet` was downloaded but is not
placed yet (intended for the living room, Phase 3). Frame-rate was not
measured: the browser pane was backgrounded during testing, so timings were
throttled and unreliable. To keep integrated GPUs safe the sheer uses plain
alpha (no transmission pass) and both bedside lamps share one point light.

### Phase 3 — Bathrooms, restaurant, other interiors
Marble bathrooms with glass shower, vanity, basin, WC, bathtub in suites,
fittings, towel rails. Restaurant identity (needs a decision on which floor —
see §4). Lobby upgrade. *Not started.*

### Phase 4 — Floor cutaway
True per-floor plan: structural walls, partitions, door frames and doors,
windows matching the exterior, corridor, ceilings where appropriate.
*Not started.*

### Phase 5 — Lighting and rendering
HDRI environment, SSAO/N8AO (light), warm practical lights per room, shadow
tuning, glass reflections. *Not started.*

### Phase 6 — Performance and mobile
Lazy loading per floor, texture/LOD variants for mobile, instancing review,
bundle split. *Not started.*

## 4. Open decisions

1. **Restaurant floor.** The data has no restaurant. Options: convert floor 1
   ("Tavola Residence", whose tagline is already "The art of gathering") into
   the restaurant, or add it to the ground floor beside the lobby.
2. **Asset downloads.** Approve Poly Haven / ambientCG CC0 downloads (Phase 2
   onward), and whether Sketchfab assets are acceptable at all.
