# 3D Door Configurator - System Architecture

## 1. MODULE STRUCTURE

```
src/
├── core/
│   ├── Engine.ts                    # Main 3D engine controller
│   ├── SceneManager.ts              # Scene setup, camera, lights, environment
│   ├── RenderLoop.ts                # RAF loop, resize handling
│   └── ResourceManager.ts           # Texture, material caching
│
├── geometry/
│   ├── DoorGeometryFactory.ts       # Main geometry orchestrator
│   ├── primitives/
│   │   ├── FrameGeometry.ts         # Door frame generation
│   │   ├── LeafGeometry.ts          # Door leaf/panel generation
│   │   ├── GlassGeometry.ts         # Glass panel generation
│   │   └── EmbossingGeometry.ts     # 3D embossed patterns
│   ├── hardware/
│   │   ├── HingeGeometry.ts         # Hinge models
│   │   ├── HandleGeometry.ts        # Handle/lever models
│   │   ├── LockGeometry.ts          # Lock cylinder models
│   │   └── BoltGeometry.ts          # Inactive leaf bolt models
│   └── PlacementEngine.ts           # Hardware positioning algorithms
│
├── state/
│   ├── ConfigurationState.ts        # Central parameter state
│   ├── AnimationState.ts            # Door animation FSM
│   └── ValidationEngine.ts          # Parameter constraint validation
│
├── animation/
│   ├── DoorAnimator.ts              # Door open/close animation
│   ├── SequenceController.ts        # Multi-door timing coordination
│   └── InterpolationEngine.ts       # Smooth motion curves
│
├── materials/
│   ├── MaterialLibrary.ts           # PBR material definitions
│   ├── TextureLoader.ts             # Async texture loading
│   └── EnvironmentMapper.ts         # HDR environment maps
│
├── interaction/
│   ├── EventBus.ts                  # Internal pub/sub system
│   ├── UIBridge.ts                  # UI ↔ Engine interface
│   └── CameraController.ts          # Orbit controls, auto-framing
│
├── optimization/
│   ├── LODManager.ts                # Level-of-detail switching
│   ├── InstancePool.ts              # Hardware component instancing
│   └── GeometryCache.ts             # Reusable geometry buffers
│
└── types/
    ├── DoorConfig.types.ts          # TypeScript interfaces
    ├── GeometrySpec.types.ts        # Geometry parameter types
    └── HardwareSpec.types.ts        # Hardware placement types
```

## 2. RESPONSIBILITY SEPARATION

### 2.1 Core Layer
**Responsibilities:**
- Initialize Three.js renderer, scene, camera
- Manage render loop (60fps target)
- Handle window resize, pixel ratio
- Coordinate between all subsystems

**Does NOT:**
- Generate geometry
- Manage parameters
- Handle animations

### 2.2 Geometry Layer
**Responsibilities:**
- Generate door frame BufferGeometry from dimensions
- Generate door leaf panels (single, double, with/without glass)
- Generate hardware models (hinges, locks, handles)
- Calculate UV coordinates for materials
- Apply embossing/extrusion based on patterns

**Inputs:**
- DoorConfiguration object (validated)
- Material specifications
- LOD level indicator

**Outputs:**
- THREE.BufferGeometry objects
- Metadata (bounding boxes, anchor points)

**Does NOT:**
- Position hardware (delegates to PlacementEngine)
- Animate doors
- Manage state

### 2.3 Placement Layer (PlacementEngine)
**Responsibilities:**
- Calculate exact 3D positions for all hardware
- Apply hinge placement algorithm
- Apply lock placement algorithm
- Apply handle placement algorithm
- Apply inactive leaf bolt algorithm
- Return Transform3D (position, rotation, scale)

**Inputs:**
- Door dimensions (width, height, thickness)
- Door type (single, double, opening direction)
- Hardware specifications (hinge count, type)
- Reference coordinate system

**Outputs:**
- Array of HardwarePlacement objects:
  ```typescript
  {
    type: 'hinge' | 'lock' | 'handle' | 'bolt',
    position: Vector3,
    rotation: Euler,
    metadata: {...}
  }
  ```

**Does NOT:**
- Create geometry
- Render objects
- Validate parameters (expects validated input)

### 2.4 State Layer
**Responsibilities:**
- Store current door configuration parameters
- Validate parameter changes against constraints
- Emit change events via EventBus
- Maintain animation state (FSM)
- Track user interaction state

**State Shape:**
```typescript
{
  config: DoorConfiguration,
  animation: {
    state: AnimationState,
    progress: number,
    activeDoors: string[]
  },
  validation: {
    errors: ValidationError[],
    warnings: ValidationWarning[]
  }
}
```

**Does NOT:**
- Generate geometry
- Perform rendering
- Execute animations (triggers AnimationController)

### 2.5 Animation Layer
**Responsibilities:**
- Execute door open/close animations
- Manage state transitions (closed → opening → open → closing → closed)
- Coordinate timing for double doors
- Apply easing functions
- Update door rotation transforms per frame

**Inputs:**
- Target animation state
- Door configuration (for pivot point calculation)
- Animation duration/easing parameters

**Does NOT:**
- Modify ConfigurationState
- Generate new geometry

### 2.6 Material Layer
**Responsibilities:**
- Define PBR materials (wood, metal, glass)
- Load and cache textures (albedo, normal, roughness, metalness)
- Apply environment maps
- Manage material variants

**Does NOT:**
- Apply materials to geometry (DoorGeometryFactory does this)

### 2.7 Interaction Layer
**Responsibilities:**
- Expose clean API for UI to trigger actions
- Convert UI events into state changes
- Emit events back to UI (loading complete, validation errors)
- Handle camera positioning/animation

**API Surface (UIBridge):**
```typescript
interface UIBridge {
  updateConfiguration(params: Partial<DoorConfiguration>): void;
  triggerAnimation(action: 'open' | 'close' | 'toggle'): void;
  resetCamera(): void;
  exportConfiguration(): DoorConfiguration;
  exportGeometry(format: 'gltf' | 'obj'): Promise<Blob>;
}
```

### 2.8 Optimization Layer
**Responsibilities:**
- Switch geometry LOD based on camera distance
- Manage instanced hardware (reuse same hinge mesh)
- Cache generated geometries for quick parameter rollback
- Dispose unused Three.js resources

**Does NOT:**
- Generate geometry (uses cached/instanced existing)

## 3. DATA FLOW

```
UI Event
  ↓
UIBridge.updateConfiguration()
  ↓
ConfigurationState.update()
  ↓
ValidationEngine.validate()
  ↓
EventBus.emit('config:changed')
  ↓
DoorGeometryFactory.rebuild()
  ↓
[GeometryModules generate primitives]
  ↓
PlacementEngine.calculatePositions()
  ↓
SceneManager.updateScene()
  ↓
RenderLoop renders frame
```

## 4. CRITICAL INTERFACES

### 4.1 DoorGeometryFactory → Geometry Primitives
```typescript
interface FrameGeometryInput {
  width: number;
  height: number;
  depth: number;
  thickness: number;
  material: MaterialSpec;
  lod: LODLevel;
}

interface LeafGeometryInput {
  width: number;
  height: number;
  thickness: number;
  glassConfig?: GlassConfig;
  embossingPattern?: EmbossingPattern;
  material: MaterialSpec;
  lod: LODLevel;
}
```

### 4.2 PlacementEngine → Hardware Modules
```typescript
interface HingePlacementInput {
  doorHeight: number;
  hingeCount: number;
  hingeType: HingeType;
  openingDirection: 'left' | 'right';
  coordinateSystem: 'door' | 'world';
}

interface LockPlacementInput {
  doorHeight: number;
  doorThickness: number;
  lockType: LockType;
  handleHeight: number;
  edge: 'left' | 'right';
}
```

### 4.3 AnimationController → State Machine
```typescript
interface AnimationCommand {
  action: 'open' | 'close';
  doors: DoorIdentifier[];
  sequence: 'simultaneous' | 'sequential';
  duration: number;
  easing: EasingFunction;
}
```

## 5. COORDINATE SYSTEM

**Primary System: Right-Handed Y-Up**
- X: Width (left-to-right from viewer)
- Y: Height (floor-to-ceiling)
- Z: Depth (viewer-to-door, negative forward)

**Door Local Space:**
- Origin: Bottom-left corner of door frame (exterior view)
- X: Frame width direction
- Y: Frame height direction
- Z: Frame depth direction (toward viewer)

**Hinge Pivot:**
- For left-opening: Left edge at X=0
- For right-opening: Right edge at X=doorWidth
- Rotation axis: Y-axis (vertical)

## 6. UPDATE STRATEGY

### 6.1 Parameter Change Categories

**Category A: Geometry Rebuild Required**
- Door type change (single ↔ double)
- Dimension changes (width, height, thickness)
- Glass configuration changes
- Embossing pattern changes

**Action:** Full rebuild via DoorGeometryFactory

**Category B: Hardware Reposition Only**
- Hinge count change
- Lock type change
- Handle type change

**Action:** Keep existing geometry, recalculate PlacementEngine, update transforms

**Category C: Material Update Only**
- Wood color/texture change
- Metal finish change
- Glass transparency change

**Action:** Update material properties, no geometry change

### 6.2 Optimization Rules
- **Debounce:** Batch rapid parameter changes (300ms window)
- **Incremental:** Category B/C updates skip full rebuild
- **Async:** Load textures asynchronously, show placeholder
- **Cache:** Store last 3 configurations for instant undo

## 7. THREADING CONSIDERATIONS

**Main Thread:**
- Rendering (Three.js)
- Animation updates (60fps)
- User interaction events

**Deferred to Web Workers (if needed):**
- Complex embossing geometry generation
- Texture processing
- Validation of large constraint sets

**Not Recommended for Workers:**
- Three.js operations (not thread-safe)
- Simple primitive generation (overhead > benefit)

## 8. ERROR HANDLING

**Validation Errors:**
- Caught in ValidationEngine before geometry generation
- Emitted via EventBus
- UI displays error, prevents invalid state

**Runtime Errors:**
- Geometry generation failures → fallback to simple box geometry
- Texture load failures → fallback to default material
- Animation errors → stop animation, log error

**Recovery Strategy:**
- Never leave scene in broken state
- Always show _something_ (degraded mode acceptable)
- Log detailed errors for debugging

## 9. EXTENSIBILITY POINTS

**Adding New Door Types:**
1. Extend DoorConfiguration schema
2. Add geometry generation in LeafGeometry
3. Add hardware placement rules in PlacementEngine
4. Update ValidationEngine constraints

**Adding New Hardware:**
1. Create geometry in hardware/ directory
2. Add placement algorithm to PlacementEngine
3. Extend HardwareSpec types
4. Add to InstancePool for optimization

**Adding Export Formats:**
1. Implement exporter in core/Exporter.ts
2. Expose via UIBridge.exportGeometry()
3. Handle async conversion

## 10. TESTING STRATEGY

**Unit Tests:**
- PlacementEngine algorithms (pure functions)
- ValidationEngine constraint logic
- Material property calculations

**Integration Tests:**
- DoorGeometryFactory with various configs
- AnimationController state transitions
- Full parameter update flow

**Visual Regression Tests:**
- Render reference images for standard configs
- Detect unintended visual changes

**Performance Tests:**
- Frame time budget: 16ms (60fps)
- Initial load time budget: 2s
- Parameter update budget: 100ms