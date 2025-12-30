# Door Animation State Machine

## 1. OVERVIEW

This document defines the complete state machine for door opening/closing animations, including:
- State definitions and transitions
- Timing and sequencing rules
- Double door coordination
- Rotation calculations
- Easing functions

## 2. STATE DEFINITIONS

### 2.1 Primary States

```typescript
enum DoorState {
  CLOSED = 'CLOSED',           // Door fully closed, at 0° rotation
  OPENING = 'OPENING',         // Door actively rotating open
  OPEN = 'OPEN',               // Door fully open, at target angle
  CLOSING = 'CLOSING',         // Door actively rotating closed
  PAUSED = 'PAUSED'            // Animation paused mid-transition
}
```

### 2.2 State Data Structure

```typescript
interface DoorAnimationState {
  currentState: DoorState;
  targetState: DoorState;
  progress: number;              // 0.0 to 1.0
  currentAngle: number;          // Current rotation in radians
  targetAngle: number;           // Target rotation in radians
  startTime: number;             // Timestamp when transition started
  duration: number;              // Total duration in ms
  easingFunction: EasingFunction;
  metadata: {
    doorId: string;              // 'left', 'right', 'primary', 'secondary'
    isActive: boolean;           // Active vs inactive leaf
    sequenceOrder?: number;      // For double door coordination
  };
}
```

## 3. STATE TRANSITION DIAGRAM

```
         ┌─────────┐
    ┌───→│ CLOSED  │←───┐
    │    └────┬────┘    │
    │         │         │
    │      [open]    [close]
    │         │         │
    │    ┌────▼────┐    │
    │    │ OPENING │    │
    │    └────┬────┘    │
    │         │         │
[close]  [complete] [pause/resume]
    │         │         │
    │    ┌────▼────┐    │
    │    │  OPEN   │    │
    │    └────┬────┘    │
    │         │         │
    │      [close]      │
    │         │         │
    │    ┌────▼────┐    │
    │    │ CLOSING │────┘
    │    └─────────┘
    │         │
    └─────[pause]
```

## 4. TRANSITION RULES

### 4.1 Valid Transitions

```typescript
const VALID_TRANSITIONS: Map<DoorState, DoorState[]> = new Map([
  [DoorState.CLOSED, [DoorState.OPENING]],
  [DoorState.OPENING, [DoorState.OPEN, DoorState.CLOSING, DoorState.PAUSED]],
  [DoorState.OPEN, [DoorState.CLOSING]],
  [DoorState.CLOSING, [DoorState.CLOSED, DoorState.OPENING, DoorState.PAUSED]],
  [DoorState.PAUSED, [DoorState.OPENING, DoorState.CLOSING]]
]);

function isValidTransition(
  from: DoorState,
  to: DoorState
): boolean {
  const allowedStates = VALID_TRANSITIONS.get(from);
  return allowedStates ? allowedStates.includes(to) : false;
}
```

### 4.2 Transition Actions

```typescript
interface StateTransition {
  from: DoorState;
  to: DoorState;
  action: (state: DoorAnimationState) => DoorAnimationState;
}

const TRANSITIONS: StateTransition[] = [
  
  // CLOSED → OPENING
  {
    from: DoorState.CLOSED,
    to: DoorState.OPENING,
    action: (state) => ({
      ...state,
      currentState: DoorState.OPENING,
      targetState: DoorState.OPEN,
      progress: 0,
      currentAngle: 0,
      targetAngle: state.targetAngle,  // From config (e.g., 90°)
      startTime: performance.now()
    })
  },
  
  // OPENING → OPEN
  {
    from: DoorState.OPENING,
    to: DoorState.OPEN,
    action: (state) => ({
      ...state,
      currentState: DoorState.OPEN,
      targetState: DoorState.OPEN,
      progress: 1.0,
      currentAngle: state.targetAngle
    })
  },
  
  // OPEN → CLOSING
  {
    from: DoorState.OPEN,
    to: DoorState.CLOSING,
    action: (state) => ({
      ...state,
      currentState: DoorState.CLOSING,
      targetState: DoorState.CLOSED,
      progress: 0,
      targetAngle: 0,
      startTime: performance.now()
    })
  },
  
  // CLOSING → CLOSED
  {
    from: DoorState.CLOSING,
    to: DoorState.CLOSED,
    action: (state) => ({
      ...state,
      currentState: DoorState.CLOSED,
      targetState: DoorState.CLOSED,
      progress: 1.0,
      currentAngle: 0
    })
  }
];
```

## 5. ANIMATION UPDATE LOOP

### 5.1 Per-Frame Update Function

```typescript
function updateDoorAnimation(
  state: DoorAnimationState,
  currentTime: number
): DoorAnimationState {
  
  // No update needed if not animating
  if (state.currentState === DoorState.CLOSED ||
      state.currentState === DoorState.OPEN ||
      state.currentState === DoorState.PAUSED) {
    return state;
  }
  
  // Calculate elapsed time
  const elapsed = currentTime - state.startTime;
  const rawProgress = Math.min(elapsed / state.duration, 1.0);
  
  // Apply easing function
  const easedProgress = state.easingFunction(rawProgress);
  
  // Calculate current angle
  const startAngle = state.currentState === DoorState.OPENING ? 0 : state.targetAngle;
  const endAngle = state.currentState === DoorState.OPENING ? state.targetAngle : 0;
  const currentAngle = lerp(startAngle, endAngle, easedProgress);
  
  // Update state
  const updated = {
    ...state,
    progress: rawProgress,
    currentAngle
  };
  
  // Check if animation complete
  if (rawProgress >= 1.0) {
    const nextState = state.currentState === DoorState.OPENING ?
      DoorState.OPEN : DoorState.CLOSED;
    
    return executeTransition(updated, nextState);
  }
  
  return updated;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
```

### 5.2 State Transition Executor

```typescript
function executeTransition(
  state: DoorAnimationState,
  to: DoorState
): DoorAnimationState {
  
  // Validate transition
  if (!isValidTransition(state.currentState, to)) {
    console.error(`Invalid transition: ${state.currentState} → ${to}`);
    return state;
  }
  
  // Find and execute transition action
  const transition = TRANSITIONS.find(
    t => t.from === state.currentState && t.to === to
  );
  
  if (!transition) {
    console.error(`No transition defined: ${state.currentState} → ${to}`);
    return state;
  }
  
  return transition.action(state);
}
```

## 6. EASING FUNCTIONS

### 6.1 Standard Easing Functions

```typescript
type EasingFunction = (t: number) => number;

const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  
  linear: (t: number) => t,
  
  easeInOut: (t: number) => {
    // Cubic ease in-out
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  
  easeIn: (t: number) => {
    // Cubic ease in
    return t * t * t;
  },
  
  easeOut: (t: number) => {
    // Cubic ease out
    return 1 - Math.pow(1 - t, 3);
  },
  
  easeInOutQuad: (t: number) => {
    // Quadratic ease in-out (softer)
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
  
  easeOutElastic: (t: number) => {
    // Elastic bounce at end
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0
      : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};
```

### 6.2 Custom Door-Specific Easing

```typescript
function doorOpenEasing(t: number): number {
  // Realistic door opening: slow start, fast middle, slow end
  // Simulates inertia and damping
  
  if (t < 0.1) {
    // Initial acceleration (overcoming static friction)
    return 3 * t * t;
  } else if (t > 0.9) {
    // Final deceleration (damping)
    const t2 = (t - 0.9) / 0.1;
    return 0.27 + 0.73 * (1 - Math.pow(1 - t2, 2));
  } else {
    // Middle section (constant velocity)
    const t2 = (t - 0.1) / 0.8;
    return 0.03 + 0.24 + 0.73 * t2;
  }
}

function doorCloseEasing(t: number): number {
  // Realistic door closing: gravity-assisted with soft close
  
  if (t < 0.7) {
    // Faster initial closing (gravity)
    return 1.2 * t * t;
  } else {
    // Soft close mechanism engages
    const t2 = (t - 0.7) / 0.3;
    return 0.588 + 0.412 * doorSoftClose(t2);
  }
}

function doorSoftClose(t: number): number {
  // Exponential decay for soft close
  return 1 - Math.exp(-5 * t);
}
```

## 7. ROTATION CALCULATION

### 7.1 Door Pivot Point

```typescript
interface DoorPivot {
  point: Vector3;     // Pivot point in world space
  axis: Vector3;      // Rotation axis (typically Y-axis)
}

function calculateDoorPivot(
  doorConfig: DoorConfiguration,
  leafId: string
): DoorPivot {
  
  const leaf = doorConfig.leafs.configuration.find(l => l.id === leafId);
  if (!leaf) throw new Error(`Leaf ${leafId} not found`);
  
  // Determine pivot based on hinge side
  let pivotX: number;
  
  if (leaf.hingeSide === 'left') {
    pivotX = 0;  // Left edge
  } else {
    pivotX = doorConfig.dimensions.width;  // Right edge
  }
  
  return {
    point: new Vector3(pivotX, 0, 0),
    axis: new Vector3(0, 1, 0)  // Vertical axis
  };
}
```

### 7.2 Apply Rotation to Door Mesh

```typescript
function applyDoorRotation(
  doorMesh: THREE.Object3D,
  pivot: DoorPivot,
  angle: number,
  openingDirection: 'inward' | 'outward'
): void {
  
  // Reset to origin
  doorMesh.position.set(0, 0, 0);
  doorMesh.rotation.set(0, 0, 0);
  
  // Adjust angle based on opening direction
  const directedAngle = openingDirection === 'inward' ? angle : -angle;
  
  // Create rotation quaternion
  const quaternion = new THREE.Quaternion();
  quaternion.setFromAxisAngle(pivot.axis, directedAngle);
  
  // Apply rotation around pivot point
  // 1. Translate to pivot
  doorMesh.position.sub(pivot.point);
  
  // 2. Rotate
  doorMesh.quaternion.copy(quaternion);
  
  // 3. Translate back
  const rotatedPivot = pivot.point.clone().applyQuaternion(quaternion);
  doorMesh.position.add(rotatedPivot);
}
```

### 7.3 Opening Angle Constraints

```typescript
function constrainOpeningAngle(
  angle: number,
  minAngle: number = 0,
  maxAngle: number = Math.PI / 2  // 90 degrees
): number {
  return Math.max(minAngle, Math.min(angle, maxAngle));
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
```

## 8. DOUBLE DOOR COORDINATION

### 8.1 Sequence Modes

```typescript
enum DoubleDoorsSequence {
  SIMULTANEOUS = 'simultaneous',      // Both doors open at same time
  PRIMARY_FIRST = 'primary_first',    // Primary (active) opens first
  SECONDARY_FIRST = 'secondary_first' // Secondary opens first (rare)
}

interface DoubleDoorsConfig {
  sequence: DoubleDoorsSequence;
  sequenceDelay: number;              // Delay in ms between doors
  primaryDoor: string;                // ID of primary door
  secondaryDoor: string;              // ID of secondary door
}
```

### 8.2 Sequencing Logic

```typescript
function calculateDoubleDoorsStartTimes(
  config: DoubleDoorsConfig,
  triggerTime: number
): { primary: number; secondary: number } {
  
  switch (config.sequence) {
    
    case DoubleDoorsSequence.SIMULTANEOUS:
      return {
        primary: triggerTime,
        secondary: triggerTime
      };
    
    case DoubleDoorsSequence.PRIMARY_FIRST:
      return {
        primary: triggerTime,
        secondary: triggerTime + config.sequenceDelay
      };
    
    case DoubleDoorsSequence.SECONDARY_FIRST:
      return {
        primary: triggerTime + config.sequenceDelay,
        secondary: triggerTime
      };
    
    default:
      return {
        primary: triggerTime,
        secondary: triggerTime
      };
  }
}
```

### 8.3 Inactive Leaf Bolt Sequence

```typescript
function animateInactiveLeafBolts(
  boltState: 'engaged' | 'disengaged',
  duration: number = 300  // ms
): Animation {
  
  // Bolts must disengage before inactive leaf can open
  // Bolts engage after inactive leaf closes
  
  if (boltState === 'disengaged') {
    // Animate bolts retracting
    return {
      property: 'boltExtension',
      from: 1.0,
      to: 0.0,
      duration,
      easing: EASING_FUNCTIONS.easeOut
    };
  } else {
    // Animate bolts extending
    return {
      property: 'boltExtension',
      from: 0.0,
      to: 1.0,
      duration,
      easing: EASING_FUNCTIONS.easeIn
    };
  }
}

function coordinateInactiveLeafOpening(
  inactiveLeafId: string,
  activeLeafState: DoorAnimationState
): DoorAnimationState | null {
  
  // Inactive leaf can only open after active leaf has opened
  // Check if active leaf is fully open
  
  if (activeLeafState.currentState !== DoorState.OPEN) {
    return null;  // Cannot open yet
  }
  
  // Active leaf is open, now open inactive leaf
  return {
    currentState: DoorState.OPENING,
    targetState: DoorState.OPEN,
    progress: 0,
    currentAngle: 0,
    targetAngle: degreesToRadians(90),
    startTime: performance.now(),
    duration: 1500,
    easingFunction: EASING_FUNCTIONS.easeInOut,
    metadata: {
      doorId: inactiveLeafId,
      isActive: false
    }
  };
}
```

## 9. ANIMATION CONTROLLER API

### 9.1 Public Interface

```typescript
interface AnimationController {
  
  // Start animation
  play(doorId: string, action: 'open' | 'close'): void;
  
  // Pause/resume
  pause(doorId: string): void;
  resume(doorId: string): void;
  
  // Stop and reset
  stop(doorId: string, resetTo?: DoorState): void;
  
  // Query state
  getState(doorId: string): DoorAnimationState;
  isAnimating(doorId: string): boolean;
  
  // Configuration
  setDuration(doorId: string, duration: number): void;
  setEasing(doorId: string, easing: string): void;
  
  // Double doors
  playDoubleDoors(action: 'open' | 'close'): void;
  setDoubleDoorsSequence(config: DoubleDoorsConfig): void;
}
```

### 9.2 Event Emission

```typescript
interface AnimationEvent {
  type: 'started' | 'progress' | 'completed' | 'paused' | 'resumed';
  doorId: string;
  state: DoorAnimationState;
  timestamp: number;
}

class AnimationController {
  
  private eventBus: EventBus;
  
  private emitEvent(event: AnimationEvent): void {
    this.eventBus.emit('animation', event);
  }
  
  play(doorId: string, action: 'open' | 'close'): void {
    // ... state transition logic ...
    
    this.emitEvent({
      type: 'started',
      doorId,
      state: newState,
      timestamp: performance.now()
    });
  }
  
  update(currentTime: number): void {
    for (const [doorId, state] of this.states) {
      
      const updated = updateDoorAnimation(state, currentTime);
      
      // Emit progress events (throttled)
      if (updated.progress !== state.progress) {
        this.emitEvent({
          type: 'progress',
          doorId,
          state: updated,
          timestamp: currentTime
        });
      }
      
      // Emit completion events
      if (updated.currentState !== state.currentState) {
        this.emitEvent({
          type: 'completed',
          doorId,
          state: updated,
          timestamp: currentTime
        });
      }
      
      this.states.set(doorId, updated);
    }
  }
}
```

## 10. PERFORMANCE OPTIMIZATIONS

### 10.1 Animation Batching

```typescript
class AnimationBatch {
  
  private pendingAnimations: Map<string, () => void> = new Map();
  
  schedule(doorId: string, animationFn: () => void): void {
    this.pendingAnimations.set(doorId, animationFn);
  }
  
  execute(): void {
    // Execute all scheduled animations in single frame
    for (const [doorId, fn] of this.pendingAnimations) {
      fn();
    }
    this.pendingAnimations.clear();
  }
}
```

### 10.2 Throttled Updates

```typescript
function shouldUpdateThisFrame(
  lastUpdateTime: number,
  currentTime: number,
  targetFPS: number = 60
): boolean {
  const minFrameTime = 1000 / targetFPS;
  return (currentTime - lastUpdateTime) >= minFrameTime;
}
```

### 10.3 Early Exit Conditions

```typescript
function updateDoorAnimationOptimized(
  state: DoorAnimationState,
  currentTime: number
): DoorAnimationState {
  
  // Early exit: not animating
  if (!isAnimating(state)) {
    return state;
  }
  
  // Early exit: angle change negligible
  const newAngle = calculateCurrentAngle(state, currentTime);
  if (Math.abs(newAngle - state.currentAngle) < 0.001) {
    return state;  // Sub-pixel change, skip update
  }
  
  // Proceed with full update
  return updateDoorAnimation(state, currentTime);
}
```

## 11. TESTING REQUIREMENTS

**Unit Tests:**
1. State transitions: all valid paths
2. Invalid transitions: should reject
3. Easing functions: correct output at t=0, 0.5, 1
4. Rotation calculation: correct pivot points
5. Double door sequencing: correct start times
6. Bolt coordination: inactive leaf dependencies

**Integration Tests:**
1. Complete open/close cycle
2. Double door synchronized opening
3. Pause/resume during animation
4. State machine under rapid commands

**Visual Tests:**
1. Smooth animation playback
2. Correct rotation direction
3. No visual glitches at state boundaries
4. Double doors synchronized correctly

**Performance Tests:**
1. 60fps maintained during animation
2. Multiple doors animating simultaneously
3. Memory usage stable over repeated animations