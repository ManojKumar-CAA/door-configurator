# Hardware Placement Algorithm

## 1. OVERVIEW

This document defines precise algorithms for placing door hardware:
- **Locks** (cylinder, mortise, deadbolt, smart)
- **Handles** (lever, knob, pull, bar)
- **Inactive Leaf Bolts** (flush, surface, automatic)

Each algorithm produces exact 3D transforms (position, rotation) in door local coordinate system.

## 2. LOCK PLACEMENT ALGORITHM

### 2.1 Input Parameters

```typescript
interface LockPlacementInput {
  doorHeight: number;        // mm
  doorWidth: number;         // mm
  leafThickness: number;     // mm
  lockType: 'cylinder' | 'mortise' | 'deadbolt' | 'smart';
  lockHeight: number;        // mm from floor, default 1050
  edgeOffset: number;        // mm from door edge, default 60
  edge: 'left' | 'right';    // Which edge (opening edge)
  handleHeight?: number;     // For coordination with handle
}
```

### 2.2 Lock Position Calculation

```typescript
function calculateLockPosition(input: LockPlacementInput): Vector3 {
  
  // X-coordinate: Distance from left edge
  let xPos: number;
  
  if (input.edge === 'left') {
    xPos = input.edgeOffset;
  } else {
    xPos = input.doorWidth - input.edgeOffset;
  }
  
  // Y-coordinate: Height from floor
  const yPos = input.lockHeight;
  
  // Z-coordinate: Depth within door leaf
  const zPos = calculateLockDepth(input.lockType, input.leafThickness);
  
  return new Vector3(xPos, yPos, zPos);
}

function calculateLockDepth(
  lockType: string,
  leafThickness: number
): number {
  
  switch (lockType) {
    case 'cylinder':
      // Cylinder extends through door
      // Center of cylinder at mid-thickness
      return -leafThickness / 2;
    
    case 'mortise':
      // Mortise lock body embedded in door edge
      // Typically 40mm deep from edge
      return -Math.min(40, leafThickness * 0.7);
    
    case 'deadbolt':
      // Similar to cylinder
      return -leafThickness / 2;
    
    case 'smart':
      // Smart lock exterior panel flush with surface
      // Interior mechanism extends inward
      return -5;  // Slight inset from surface
    
    default:
      return -leafThickness / 2;
  }
}
```

### 2.3 Lock Rotation

```typescript
function calculateLockRotation(
  edge: 'left' | 'right',
  lockType: string
): THREE.Euler {
  
  // Lock cylinder faces perpendicular to door surface (along Z)
  // Rotation depends on which edge lock is on
  
  let rotationY = 0;
  
  if (edge === 'left') {
    rotationY = Math.PI / 2;   // Face right (toward opening edge)
  } else {
    rotationY = -Math.PI / 2;  // Face left (toward opening edge)
  }
  
  // Mortise locks may need different orientation
  if (lockType === 'mortise') {
    // Mortise body is vertical, latch horizontal
    // Additional rotation may be needed based on model
  }
  
  return new THREE.Euler(0, rotationY, 0, 'XYZ');
}
```

### 2.4 Lock Type-Specific Adjustments

```typescript
interface CylinderLockParams {
  cylinderDiameter: number;   // Typical: 21-23mm
  cylinderLength: number;     // Through-door length
  backsetDistance: number;    // Distance from edge to center
}

function adjustCylinderLockPlacement(
  basePosition: Vector3,
  params: CylinderLockParams
): Vector3 {
  
  // Cylinder center should align with latch mechanism
  // Backset is measured from door edge to cylinder center
  
  return new Vector3(
    params.backsetDistance,
    basePosition.y,
    basePosition.z
  );
}

interface MortiseLockParams {
  bodyWidth: number;      // Typical: 60-85mm
  bodyHeight: number;     // Typical: 150-200mm
  bodyDepth: number;      // Typical: 20-40mm
  backset: number;        // 44mm or 57mm standard
}

function adjustMortiseLockPlacement(
  basePosition: Vector3,
  edge: 'left' | 'right',
  doorWidth: number,
  params: MortiseLockParams
): Vector3 {
  
  // Mortise lock body is recessed into door edge
  // Position is based on standard backset
  
  let xPos: number;
  if (edge === 'left') {
    xPos = params.backset;
  } else {
    xPos = doorWidth - params.backset;
  }
  
  return new Vector3(xPos, basePosition.y, basePosition.z);
}
```

### 2.5 Validation Rules

```typescript
function validateLockPlacement(
  input: LockPlacementInput,
  hingePlacements: HingePlacement[]
): ValidationResult {
  
  // Rule 1: Lock height within acceptable range
  if (input.lockHeight < 800 || input.lockHeight > 1200) {
    return {
      valid: false,
      error: 'Lock height must be between 800-1200mm'
    };
  }
  
  // Rule 2: Lock not too close to hinges
  const minDistanceFromHinge = 150;  // mm
  
  for (const hinge of hingePlacements) {
    const distanceY = Math.abs(hinge.position.y - input.lockHeight);
    if (distanceY < minDistanceFromHinge) {
      return {
        valid: false,
        error: `Lock conflicts with hinge at ${hinge.position.y}mm`
      };
    }
  }
  
  // Rule 3: Edge offset must accommodate lock body
  if (input.edgeOffset < 50 || input.edgeOffset > 90) {
    return {
      valid: false,
      error: 'Lock edge offset must be between 50-90mm'
    };
  }
  
  // Rule 4: Door thickness sufficient for lock type
  const minThickness = getMinimumThicknessForLock(input.lockType);
  if (input.leafThickness < minThickness) {
    return {
      valid: false,
      error: `Door thickness ${input.leafThickness}mm insufficient for ${input.lockType} lock (minimum ${minThickness}mm)`
    };
  }
  
  return { valid: true };
}

function getMinimumThicknessForLock(lockType: string): number {
  const requirements = {
    'cylinder': 35,
    'mortise': 40,
    'deadbolt': 38,
    'smart': 40
  };
  return requirements[lockType] || 35;
}
```

## 3. HANDLE PLACEMENT ALGORITHM

### 3.1 Input Parameters

```typescript
interface HandlePlacementInput {
  doorHeight: number;         // mm
  doorWidth: number;          // mm
  leafThickness: number;      // mm
  handleType: 'lever' | 'knob' | 'pull' | 'bar';
  handleStyle: 'modern' | 'traditional' | 'industrial' | 'minimal';
  handleHeight: number;       // mm from floor, default 1050
  side: 'both' | 'exterior' | 'interior';
  lockHeight?: number;        // For coordination
  edge: 'left' | 'right';     // Opening edge
}
```

### 3.2 Handle Position Calculation

```typescript
function calculateHandlePosition(
  input: HandlePlacementInput,
  side: 'exterior' | 'interior'
): Vector3 {
  
  // X-coordinate: Typically same as lock (if present)
  // If no lock, standard offset from edge
  const edgeOffset = input.lockHeight ? 60 : 70;
  
  let xPos: number;
  if (input.edge === 'left') {
    xPos = edgeOffset;
  } else {
    xPos = input.doorWidth - edgeOffset;
  }
  
  // Y-coordinate: Handle height (usually matches lock)
  const yPos = input.handleHeight;
  
  // Z-coordinate: Surface-mounted vs through-door
  const zPos = calculateHandleDepth(
    input.handleType,
    input.leafThickness,
    side
  );
  
  return new Vector3(xPos, yPos, zPos);
}

function calculateHandleDepth(
  handleType: string,
  leafThickness: number,
  side: 'exterior' | 'interior'
): number {
  
  switch (handleType) {
    case 'lever':
    case 'knob':
      // Lever/knob protrudes from surface
      // Mounting plate flush with surface
      if (side === 'exterior') {
        return 0;  // Exterior surface (Z=0)
      } else {
        return -leafThickness;  // Interior surface
      }
    
    case 'pull':
      // Pull handle has standoffs from surface
      const standoffDistance = 40;  // mm
      if (side === 'exterior') {
        return standoffDistance;
      } else {
        return -(leafThickness + standoffDistance);
      }
    
    case 'bar':
      // Bar handle similar to pull
      const barStandoff = 50;  // mm
      if (side === 'exterior') {
        return barStandoff;
      } else {
        return -(leafThickness + barStandoff);
      }
    
    default:
      return side === 'exterior' ? 0 : -leafThickness;
  }
}
```

### 3.3 Handle Rotation

```typescript
function calculateHandleRotation(
  edge: 'left' | 'right',
  handleType: string,
  side: 'exterior' | 'interior'
): THREE.Euler {
  
  let rotationY = 0;
  
  // Lever/knob faces perpendicular to surface
  if (handleType === 'lever' || handleType === 'knob') {
    
    // Lever points toward opening direction
    if (edge === 'left') {
      rotationY = side === 'exterior' ? Math.PI / 2 : -Math.PI / 2;
    } else {
      rotationY = side === 'exterior' ? -Math.PI / 2 : Math.PI / 2;
    }
    
  } else if (handleType === 'pull' || handleType === 'bar') {
    
    // Pull/bar is vertical, orientation depends on mount side
    rotationY = side === 'exterior' ? 0 : Math.PI;
    
  }
  
  return new THREE.Euler(0, rotationY, 0, 'XYZ');
}
```

### 3.4 Handle-Lock Coordination

```typescript
function coordinateHandleWithLock(
  handleInput: HandlePlacementInput,
  lockPlacement: LockPlacement
): HandlePlacementInput {
  
  // Ensure handle height matches lock height
  // Unless explicitly overridden by user
  
  if (!handleInput.lockHeight) {
    // No explicit lock height provided
    // Keep handle at specified height
    return handleInput;
  }
  
  // Lock exists, coordinate heights
  const coordinated = { ...handleInput };
  coordinated.handleHeight = lockPlacement.position.y;
  
  // Ensure handle X position aligns with lock
  // (Already handled in calculateHandlePosition)
  
  return coordinated;
}
```

### 3.5 Handle Type-Specific Parameters

```typescript
interface LeverHandleParams {
  leverLength: number;        // Typical: 120-150mm
  rosetteDiameter: number;    // Typical: 50-60mm
  leverAngle: number;         // Rest angle, typically 0° (horizontal)
}

interface KnobHandleParams {
  knobDiameter: number;       // Typical: 50-70mm
  knobDepth: number;          // Protrusion from rosette
  rosetteDiameter: number;
}

interface PullHandleParams {
  length: number;             // Vertical length
  diameter: number;           // Bar diameter
  standoffDistance: number;   // Distance from door surface
  mountPoints: number;        // 2 or 3 mounting points
}

interface BarHandleParams {
  length: number;             // Horizontal or vertical
  diameter: number;
  standoffDistance: number;
  shape: 'straight' | 'curved' | 'offset';
}
```

## 4. INACTIVE LEAF BOLT ALGORITHM

### 4.1 Input Parameters

```typescript
interface BoltPlacementInput {
  doorHeight: number;         // mm
  doorWidth: number;          // mm (of inactive leaf)
  leafThickness: number;      // mm
  boltType: 'flush' | 'surface' | 'automatic';
  positions: ('top' | 'bottom')[];  // Where to place bolts
  topOffset: number;          // mm from top, default 200
  bottomOffset: number;       // mm from bottom, default 200
  meetingEdge: 'left' | 'right';  // Which edge meets active leaf
}
```

### 4.2 Bolt Position Calculation

```typescript
function calculateBoltPositions(
  input: BoltPlacementInput
): BoltPlacement[] {
  
  const placements: BoltPlacement[] = [];
  
  for (const position of input.positions) {
    
    // Y-coordinate
    let yPos: number;
    if (position === 'top') {
      yPos = input.doorHeight - input.topOffset;
    } else {
      yPos = input.bottomOffset;
    }
    
    // X-coordinate: Center of meeting edge
    let xPos: number;
    if (input.meetingEdge === 'left') {
      xPos = 40;  // Inset from edge
    } else {
      xPos = input.doorWidth - 40;
    }
    
    // Z-coordinate: Depends on bolt type
    const zPos = calculateBoltDepth(input.boltType, input.leafThickness);
    
    placements.push({
      id: `bolt_${position}`,
      position: new Vector3(xPos, yPos, zPos),
      rotation: calculateBoltRotation(position, input.boltType),
      metadata: {
        position: position,
        type: input.boltType
      }
    });
  }
  
  return placements;
}

function calculateBoltDepth(
  boltType: string,
  leafThickness: number
): number {
  
  switch (boltType) {
    case 'flush':
      // Flush bolt recesses into door edge
      return -leafThickness / 2;
    
    case 'surface':
      // Surface bolt mounts on face of door
      return 0;  // Exterior surface
    
    case 'automatic':
      // Automatic bolt similar to flush
      return -leafThickness / 2;
    
    default:
      return 0;
  }
}
```

### 4.3 Bolt Rotation

```typescript
function calculateBoltRotation(
  position: 'top' | 'bottom',
  boltType: string
): THREE.Euler {
  
  // Bolt extends vertically (Y-axis)
  // Top bolt extends upward, bottom bolt extends downward
  
  let rotationZ = 0;
  
  if (boltType === 'flush' || boltType === 'automatic') {
    // Flush bolts embed in edge, extend into frame
    rotationZ = position === 'top' ? 0 : Math.PI;
  } else if (boltType === 'surface') {
    // Surface bolts visible on door face
    rotationZ = 0;
  }
  
  return new THREE.Euler(0, 0, rotationZ, 'XYZ');
}
```

### 4.4 Bolt Type-Specific Parameters

```typescript
interface FlushBoltParams {
  boltDiameter: number;       // Typical: 12-16mm
  boltExtension: number;      // Extended length into frame
  housingLength: number;      // Length of bolt housing
}

interface SurfaceBoltParams {
  plateLength: number;        // Mounting plate length
  plateWidth: number;
  boltDiameter: number;
  boltExtension: number;
}

interface AutomaticBoltParams {
  actuationMethod: 'mechanical' | 'electronic';
  boltDiameter: number;
  extensionDistance: number;
  housingDepth: number;
}
```

### 4.5 Validation Rules

```typescript
function validateBoltPlacement(
  input: BoltPlacementInput
): ValidationResult {
  
  // Rule 1: Offsets within acceptable range
  if (input.topOffset < 150 || input.topOffset > 300) {
    return {
      valid: false,
      error: 'Top bolt offset must be between 150-300mm'
    };
  }
  if (input.bottomOffset < 150 || input.bottomOffset > 300) {
    return {
      valid: false,
      error: 'Bottom bolt offset must be between 150-300mm'
    };
  }
  
  // Rule 2: At least one bolt position specified
  if (input.positions.length === 0) {
    return {
      valid: false,
      error: 'At least one bolt position required'
    };
  }
  
  // Rule 3: Door thickness sufficient for flush/automatic bolts
  if ((input.boltType === 'flush' || input.boltType === 'automatic') &&
      input.leafThickness < 40) {
    return {
      valid: false,
      error: 'Flush/automatic bolts require minimum 40mm door thickness'
    };
  }
  
  return { valid: true };
}
```

## 5. HARDWARE CONFLICT DETECTION

### 5.1 Global Conflict Check

```typescript
interface HardwareConflict {
  type: 'overlap' | 'proximity';
  items: [string, string];  // IDs of conflicting items
  distance: number;
  severity: 'error' | 'warning';
}

function detectHardwareConflicts(
  hinges: HingePlacement[],
  lock?: LockPlacement,
  handles?: HandlePlacement[],
  bolts?: BoltPlacement[]
): HardwareConflict[] {
  
  const conflicts: HardwareConflict[] = [];
  const allHardware: any[] = [
    ...hinges,
    ...(lock ? [lock] : []),
    ...(handles || []),
    ...(bolts || [])
  ];
  
  // Minimum clearance distances (mm)
  const minClearance = {
    'hinge-lock': 150,
    'hinge-handle': 100,
    'hinge-bolt': 200,
    'lock-handle': 50,   // Can be close (integrated)
    'lock-bolt': 300,
    'handle-bolt': 200
  };
  
  // Check all pairs
  for (let i = 0; i < allHardware.length; i++) {
    for (let j = i + 1; j < allHardware.length; j++) {
      
      const item1 = allHardware[i];
      const item2 = allHardware[j];
      
      const distance = item1.position.distanceTo(item2.position);
      const types = [item1.metadata.type, item2.metadata.type].sort();
      const key = `${types[0]}-${types[1]}`;
      const required = minClearance[key] || 100;
      
      if (distance < required) {
        conflicts.push({
          type: distance < required * 0.5 ? 'overlap' : 'proximity',
          items: [item1.id, item2.id],
          distance,
          severity: distance < required * 0.5 ? 'error' : 'warning'
        });
      }
    }
  }
  
  return conflicts;
}
```

## 6. DOUBLE DOOR SPECIAL CASES

### 6.1 Active/Inactive Leaf Differentiation

```typescript
function placeHardwareForDoubleDoors(
  activeLeaf: LeafConfig,
  inactiveLeaf: LeafConfig,
  dimensions: DoorDimensions
): { active: HardwarePlacement[], inactive: HardwarePlacement[] } {
  
  // Active leaf: Full hardware (hinges, lock, handle)
  const activeHardware = [
    ...placeHinges({ ...activeLeaf, ...dimensions }),
    placeLock({ ...activeLeaf, ...dimensions }),
    placeHandle({ ...activeLeaf, ...dimensions, side: 'both' })
  ];
  
  // Inactive leaf: Hinges + bolts only (no lock/handle)
  const inactiveHardware = [
    ...placeHinges({ ...inactiveLeaf, ...dimensions }),
    ...placeBolts({
      ...inactiveLeaf,
      ...dimensions,
      positions: ['top', 'bottom']
    })
  ];
  
  return { active: activeHardware, inactive: inactiveHardware };
}
```

### 6.2 Meeting Edge Coordination

```typescript
function calculateMeetingEdgeGap(
  leftLeafWidth: number,
  rightLeafWidth: number,
  astragalType: 'none' | 'surface' | 'overlap'
): number {
  
  // Gap between leafs at center when closed
  
  switch (astragalType) {
    case 'none':
      return 3;  // Small gap
    
    case 'surface':
      return 0;  // Astragal covers gap
    
    case 'overlap':
      return -10;  // Overlap by 10mm
    
    default:
      return 3;
  }
}
```

## 7. PERFORMANCE OPTIMIZATION

### 7.1 Hardware Instancing

```typescript
interface InstancedHardware {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  instances: {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
  }[];
}

function createInstancedHardware(
  placements: HardwarePlacement[],
  geometryCache: Map<string, THREE.BufferGeometry>
): InstancedHardware[] {
  
  // Group by hardware type
  const grouped = new Map<string, HardwarePlacement[]>();
  
  for (const placement of placements) {
    const type = placement.metadata.type;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(placement);
  }
  
  // Create instanced mesh data for each type
  const instanced: InstancedHardware[] = [];
  
  for (const [type, items] of grouped) {
    const geometry = geometryCache.get(type);
    if (!geometry) continue;
    
    instanced.push({
      geometry,
      material: getHardwareMaterial(type),
      instances: items.map(item => ({
        position: item.position,
        rotation: item.rotation,
        scale: new Vector3(1, 1, 1)
      }))
    });
  }
  
  return instanced;
}
```

## 8. TESTING REQUIREMENTS

**Unit Tests:**
1. Lock placement: cylinder, all edges, various heights
2. Handle placement: all types, coordinated with lock
3. Bolt placement: top/bottom/both, all types
4. Conflict detection: hinge-lock proximity
5. Validation: invalid heights, insufficient thickness
6. Double door: active/inactive coordination

**Integration Tests:**
1. Complete hardware set placement
2. Parameter changes triggering repositioning
3. Hardware type changes

**Visual Tests:**
1. Render all hardware combinations
2. Verify alignment with door edges
3. Verify no visible intersections