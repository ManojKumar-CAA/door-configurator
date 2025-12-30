# Hinge Placement Algorithm

## 1. OVERVIEW

This algorithm calculates exact 3D positions and orientations for door hinges based on:
- Door dimensions (width, height, thickness)
- Hinge count (2-5)
- Hinge type (butt, concealed, piano)
- Opening direction (left/right)
- User-defined placement rules (optional overrides)

**Output:** Array of Transform3D objects (position, rotation) in door local coordinate system

## 2. COORDINATE SYSTEM

**Door Local Space:**
```
Origin: Bottom-left corner of door frame (viewed from exterior)
X-axis: Horizontal (left → right)
Y-axis: Vertical (bottom → top)
Z-axis: Depth (exterior → interior, door surface at Z=0)
```

**Hinge Mounting Surface:**
- Left-opening door: X = 0 (left edge)
- Right-opening door: X = doorWidth (right edge)

## 3. INPUT PARAMETERS

```typescript
interface HingePlacementInput {
  doorHeight: number;           // mm
  doorWidth: number;            // mm
  leafThickness: number;        // mm
  hingeCount: number;           // 2-5
  hingeType: 'butt' | 'concealed' | 'piano';
  hingeSide: 'left' | 'right';  // Which edge hinges mount to
  placementRules?: {
    topOffset?: number;         // mm from top, default 150
    bottomOffset?: number;      // mm from bottom, default 150
    distributionMode?: 'even' | 'weighted';  // default 'even'
  };
}
```

## 4. MAIN ALGORITHM

### 4.1 Determine Hinge Side Position

```typescript
function getHingeXPosition(
  hingeSide: 'left' | 'right',
  doorWidth: number
): number {
  if (hingeSide === 'left') {
    return 0;  // Left edge
  } else {
    return doorWidth;  // Right edge
  }
}
```

### 4.2 Calculate Hinge Y Positions (Vertical Distribution)

```typescript
function calculateHingeYPositions(
  hingeCount: number,
  doorHeight: number,
  topOffset: number = 150,      // mm
  bottomOffset: number = 150,   // mm
  distributionMode: 'even' | 'weighted' = 'even'
): number[] {
  
  if (hingeCount < 2) {
    throw new Error('Minimum 2 hinges required');
  }
  
  const positions: number[] = [];
  
  // First hinge (bottom)
  positions.push(bottomOffset);
  
  // Last hinge (top)
  positions.push(doorHeight - topOffset);
  
  if (hingeCount === 2) {
    return positions;
  }
  
  // Calculate middle hinge positions
  const middleCount = hingeCount - 2;
  const availableHeight = (doorHeight - topOffset) - bottomOffset;
  
  if (distributionMode === 'even') {
    // Evenly distribute middle hinges
    const spacing = availableHeight / (hingeCount - 1);
    
    for (let i = 1; i <= middleCount; i++) {
      positions.splice(i, 0, bottomOffset + (spacing * i));
    }
    
  } else if (distributionMode === 'weighted') {
    // Weighted distribution (more hinges toward top for heavy doors)
    // Uses quadratic distribution: more density at top
    
    for (let i = 1; i <= middleCount; i++) {
      const t = i / (hingeCount - 1);  // 0 to 1
      const weightedT = Math.pow(t, 0.8);  // Slight bias toward linear
      const yPos = bottomOffset + (availableHeight * weightedT);
      positions.splice(i, 0, yPos);
    }
  }
  
  return positions.sort((a, b) => a - b);
}
```

### 4.3 Calculate Hinge Z Position (Depth)

```typescript
function getHingeZPosition(
  hingeType: 'butt' | 'concealed' | 'piano',
  leafThickness: number
): number {
  
  switch (hingeType) {
    case 'butt':
      // Butt hinges sit on the edge surface
      return 0;
    
    case 'concealed':
      // Concealed hinges embed into leaf thickness
      // Typical: 10mm from back surface
      return -(leafThickness - 10);
    
    case 'piano':
      // Piano hinge runs full height on edge
      return 0;
    
    default:
      return 0;
  }
}
```

### 4.4 Calculate Hinge Rotation

```typescript
function getHingeRotation(
  hingeSide: 'left' | 'right',
  hingeType: string
): THREE.Euler {
  
  // Base rotation: hinge barrel axis is Y (vertical)
  let rotationY = 0;
  
  if (hingeSide === 'left') {
    // Hinges on left edge: face right (positive X)
    rotationY = Math.PI / 2;  // 90 degrees
  } else {
    // Hinges on right edge: face left (negative X)
    rotationY = -Math.PI / 2;  // -90 degrees
  }
  
  // Piano hinges may need adjustment
  if (hingeType === 'piano') {
    // Piano hinge is continuous, full height
    // May need different rotation based on implementation
  }
  
  return new THREE.Euler(0, rotationY, 0, 'XYZ');
}
```

## 5. HINGE TYPE-SPECIFIC ADJUSTMENTS

### 5.1 Butt Hinge

```typescript
interface ButtHingeParams {
  plateWidth: number;   // Typical: 40-50mm
  plateHeight: number;  // Typical: 75-100mm
  barrelDiameter: number;  // Typical: 10-15mm
}

function adjustButtHingePlacement(
  basePosition: Vector3,
  hingeSide: 'left' | 'right',
  params: ButtHingeParams
): Vector3 {
  
  // Butt hinges center on the barrel
  // Offset to align barrel with door edge
  
  const offset = params.barrelDiameter / 2;
  
  if (hingeSide === 'left') {
    return basePosition.add(new Vector3(-offset, 0, 0));
  } else {
    return basePosition.add(new Vector3(offset, 0, 0));
  }
}
```

### 5.2 Concealed Hinge

```typescript
interface ConcealedHingeParams {
  cupDiameter: number;    // Typical: 35mm
  cupDepth: number;       // Typical: 12mm
  armLength: number;      // Typical: 95-110mm
}

function adjustConcealedHingePlacement(
  basePosition: Vector3,
  leafThickness: number,
  params: ConcealedHingeParams
): Vector3 {
  
  // Concealed hinge cup drills into door leaf
  // Position center of cup
  
  const cupCenterZ = -(params.cupDepth / 2);
  const edgeInset = 5;  // Small inset from edge
  
  return new Vector3(
    basePosition.x + (basePosition.x === 0 ? edgeInset : -edgeInset),
    basePosition.y,
    cupCenterZ
  );
}
```

### 5.3 Piano Hinge

```typescript
interface PianoHingeParams {
  width: number;          // Typical: 25-40mm
  fullHeight: boolean;    // True = runs full door height
}

function calculatePianoHingePlacement(
  doorHeight: number,
  doorWidth: number,
  hingeSide: 'left' | 'right',
  params: PianoHingeParams
): HingePlacement {
  
  // Piano hinge is one continuous piece
  // Returns single placement with length parameter
  
  const xPos = hingeSide === 'left' ? 0 : doorWidth;
  const yPos = doorHeight / 2;  // Center vertically
  
  return {
    position: new Vector3(xPos, yPos, 0),
    rotation: getHingeRotation(hingeSide, 'piano'),
    metadata: {
      length: doorHeight,  // Full height
      isPiano: true
    }
  };
}
```

## 6. VALIDATION RULES

### 6.1 Minimum Hinge Count

```typescript
function validateHingeCount(
  doorHeight: number,
  doorWeight: number,  // kg (estimated)
  hingeCount: number
): ValidationResult {
  
  let minRequired = 2;
  
  // Rule 1: Height-based
  if (doorHeight > 2100) {
    minRequired = 3;
  }
  
  // Rule 2: Weight-based (if known)
  if (doorWeight > 50) {
    minRequired = Math.max(minRequired, 3);
  }
  if (doorWeight > 80) {
    minRequired = Math.max(minRequired, 4);
  }
  
  if (hingeCount < minRequired) {
    return {
      valid: false,
      error: `Door requires minimum ${minRequired} hinges (height: ${doorHeight}mm, weight: ${doorWeight}kg)`
    };
  }
  
  return { valid: true };
}
```

### 6.2 Offset Constraints

```typescript
function validateOffsets(
  doorHeight: number,
  topOffset: number,
  bottomOffset: number,
  hingeCount: number
): ValidationResult {
  
  // Minimum offsets
  if (topOffset < 100) {
    return {
      valid: false,
      error: 'Top offset must be >= 100mm'
    };
  }
  if (bottomOffset < 100) {
    return {
      valid: false,
      error: 'Bottom offset must be >= 100mm'
    };
  }
  
  // Check sufficient space for all hinges
  const availableSpace = doorHeight - topOffset - bottomOffset;
  const minSpacingPerHinge = 150;  // mm
  const requiredSpace = (hingeCount - 2) * minSpacingPerHinge;
  
  if (availableSpace < requiredSpace) {
    return {
      valid: false,
      error: `Insufficient space for ${hingeCount} hinges with current offsets`
    };
  }
  
  return { valid: true };
}
```

## 7. FINAL OUTPUT STRUCTURE

```typescript
interface HingePlacement {
  id: string;                    // e.g., "hinge_0", "hinge_1"
  position: Vector3;             // World or local coordinates
  rotation: Euler;               // Orientation
  metadata: {
    index: number;               // 0-based hinge index
    type: string;                // hinge type
    side: 'left' | 'right';
    yPosition: number;           // Height from floor
    isPiano?: boolean;           // True for piano hinge
    length?: number;             // For piano hinge
  };
}
```

## 8. COMPLETE ALGORITHM IMPLEMENTATION

```typescript
function placeHinges(input: HingePlacementInput): HingePlacement[] {
  
  // Step 1: Validate inputs
  const validation = validateHingeCount(
    input.doorHeight,
    estimateDoorWeight(input),  // Helper function
    input.hingeCount
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Step 2: Handle piano hinge special case
  if (input.hingeType === 'piano') {
    return [calculatePianoHingePlacement(
      input.doorHeight,
      input.doorWidth,
      input.hingeSide,
      { width: 30, fullHeight: true }
    )];
  }
  
  // Step 3: Calculate Y positions
  const yPositions = calculateHingeYPositions(
    input.hingeCount,
    input.doorHeight,
    input.placementRules?.topOffset || 150,
    input.placementRules?.bottomOffset || 150,
    input.placementRules?.distributionMode || 'even'
  );
  
  // Step 4: Get X position (hinge side)
  const xPos = getHingeXPosition(input.hingeSide, input.doorWidth);
  
  // Step 5: Get Z position (depth)
  const zPos = getHingeZPosition(input.hingeType, input.leafThickness);
  
  // Step 6: Get rotation
  const rotation = getHingeRotation(input.hingeSide, input.hingeType);
  
  // Step 7: Build placement array
  const placements: HingePlacement[] = [];
  
  for (let i = 0; i < yPositions.length; i++) {
    let position = new Vector3(xPos, yPositions[i], zPos);
    
    // Apply type-specific adjustments
    if (input.hingeType === 'butt') {
      position = adjustButtHingePlacement(
        position,
        input.hingeSide,
        { plateWidth: 45, plateHeight: 75, barrelDiameter: 12 }
      );
    } else if (input.hingeType === 'concealed') {
      position = adjustConcealedHingePlacement(
        position,
        input.leafThickness,
        { cupDiameter: 35, cupDepth: 12, armLength: 95 }
      );
    }
    
    placements.push({
      id: `hinge_${i}`,
      position,
      rotation,
      metadata: {
        index: i,
        type: input.hingeType,
        side: input.hingeSide,
        yPosition: yPositions[i]
      }
    });
  }
  
  return placements;
}
```

## 9. EDGE CASES

### 9.1 Very Tall Doors (> 2500mm)
- Force minimum 4 hinges
- Use weighted distribution
- Reduce top offset to 120mm to accommodate more hinges

### 9.2 Very Short Doors (< 1900mm)
- Allow 2 hinges
- Increase offsets proportionally (maintain 150mm minimum)

### 9.3 Custom Offset Collision
- If user offsets leave insufficient space, auto-adjust offsets proportionally
- Warn user of adjustment

### 9.4 Double Doors
- Run algorithm independently for each leaf
- Ensure symmetry if both leafs are same size
- Mirror hinge side for opposing leafs

## 10. PERFORMANCE CONSIDERATIONS

- **Cache Results:** Hinge positions only change on dimension/count change
- **Reuse Geometry:** Instantiate hinge geometry, don't recreate
- **Lazy Calculation:** Only recalculate on parameter change, not every frame

## 11. TESTING REQUIREMENTS

**Unit Test Cases:**
1. 2 hinges, 2000mm door, left side
2. 3 hinges, 2400mm door, right side, weighted distribution
3. 4 hinges, 2100mm door, custom offsets (200mm top, 180mm bottom)
4. Piano hinge, 2200mm door, right side
5. Concealed hinge, 2000mm door, 40mm thickness
6. Validation failure: 1 hinge attempt
7. Validation failure: offsets too large for hinge count
8. Edge case: 3000mm door (very tall)
9. Edge case: 1800mm door (short)

**Visual Test:**
- Render each test case
- Verify hinge alignment with door edge
- Verify spacing consistency
- Verify rotation matches opening direction