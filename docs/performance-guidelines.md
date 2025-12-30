# Performance Optimization Guidelines

## 1. PERFORMANCE TARGETS

### 1.1 Frame Rate Targets

```typescript
const PERFORMANCE_TARGETS = {
  targetFPS: 60,                    // 16.67ms per frame
  criticalFPS: 30,                  // 33.33ms per frame (acceptable fallback)
  frameTimeBudget: 16,              // ms
  
  loadTime: {
    initialScene: 2000,             // ms - scene ready to interact
    textureLoading: 3000,           // ms - all textures loaded
    fullConfiguration: 500          // ms - parameter change to render
  },
  
  memory: {
    maxGeometryCache: 50 * 1024 * 1024,    // 50MB
    maxTextureMemory: 100 * 1024 * 1024,   // 100MB
    maxTotalMemory: 200 * 1024 * 1024      // 200MB
  }
};
```

### 1.2 Complexity Budgets

```typescript
const COMPLEXITY_BUDGETS = {
  maxTriangles: {
    LOD0: 50000,    // High detail
    LOD1: 20000,    // Medium detail
    LOD2: 5000      // Low detail
  },
  
  maxDrawCalls: {
    desktop: 200,
    mobile: 100
  },
  
  maxMaterials: 20,
  maxTextures: 30,
  maxLights: 4
};
```

## 2. LEVEL OF DETAIL (LOD) SYSTEM

### 2.1 LOD Distance Thresholds

```typescript
interface LODConfiguration {
  levels: LODLevel[];
}

interface LODLevel {
  distance: number;           // Camera distance in meters
  triangleBudget: number;     // Max triangles for this level
  textureResolution: number;  // Max texture size (e.g., 2048)
  simplifications: string[];  // Applied optimizations
}

const DOOR_LOD_CONFIG: LODConfiguration = {
  levels: [
    {
      distance: 0,              // 0-5m
      triangleBudget: 50000,
      textureResolution: 2048,
      simplifications: []
    },
    {
      distance: 5,              // 5-15m
      triangleBudget: 20000,
      textureResolution: 1024,
      simplifications: [
        'simplify_embossing',
        'remove_small_hardware',
        'reduce_glass_subdivisions'
      ]
    },
    {
      distance: 15,             // 15m+
      triangleBudget: 5000,
      textureResolution: 512,
      simplifications: [
        'remove_embossing',
        'remove_hardware_details',
        'box_glass_geometry',
        'merge_meshes'
      ]
    }
  ]
};
```

### 2.2 LOD Switching Algorithm

```typescript
function calculateRequiredLOD(
  cameraPosition: Vector3,
  doorPosition: Vector3,
  lodConfig: LODConfiguration
): number {
  
  const distance = cameraPosition.distanceTo(doorPosition);
  
  // Find appropriate LOD level
  for (let i = lodConfig.levels.length - 1; i >= 0; i--) {
    if (distance >= lodConfig.levels[i].distance) {
      return i;
    }
  }
  
  return 0;  // Highest detail by default
}

function shouldSwitchLOD(
  currentLOD: number,
  newLOD: number,
  hysteresis: number = 0.1
): boolean {
  
  // Add hysteresis to prevent rapid LOD flickering
  if (newLOD === currentLOD) return false;
  
  const threshold = DOOR_LOD_CONFIG.levels[currentLOD].distance;
  const hystMargin = threshold * hysteresis;
  
  // Require movement beyond hysteresis margin before switching
  return Math.abs(newLOD - currentLOD) > 0;
}
```

### 2.3 LOD-Specific Geometry Generation

```typescript
interface GeometryLODSpec {
  frameDetail: 'high' | 'medium' | 'low';
  embossingEnabled: boolean;
  hardwareDetail: 'full' | 'simplified' | 'none';
  glassSubdivisions: number;
  hingeDetail: 'full' | 'simple' | 'none';
}

function getGeometrySpecForLOD(lodLevel: number): GeometryLODSpec {
  
  const specs: GeometryLODSpec[] = [
    // LOD 0: High detail
    {
      frameDetail: 'high',
      embossingEnabled: true,
      hardwareDetail: 'full',
      glassSubdivisions: 4,
      hingeDetail: 'full'
    },
    
    // LOD 1: Medium detail
    {
      frameDetail: 'medium',
      embossingEnabled: true,
      hardwareDetail: 'simplified',
      glassSubdivisions: 2,
      hingeDetail: 'simple'
    },
    
    // LOD 2: Low detail
    {
      frameDetail: 'low',
      embossingEnabled: false,
      hardwareDetail: 'none',
      glassSubdivisions: 1,
      hingeDetail: 'none'
    }
  ];
  
  return specs[lodLevel] || specs[0];
}
```

## 3. GEOMETRY INSTANCING

### 3.1 Instancing Strategy

```typescript
interface InstancedComponent {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  instanceCount: number;
  transforms: {
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
  }[];
}

class HardwareInstancePool {
  
  private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
  
  createInstancedHardware(
    hardwareType: string,
    placements: HardwarePlacement[],
    geometry: THREE.BufferGeometry,
    material: THREE.Material
  ): THREE.InstancedMesh {
    
    const count = placements.length;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    
    // Set transforms for each instance
    const matrix = new THREE.Matrix4();
    
    for (let i = 0; i < count; i++) {
      const placement = placements[i];
      
      matrix.compose(
        placement.position,
        new THREE.Quaternion().setFromEuler(placement.rotation),
        new THREE.Vector3(1, 1, 1)
      );
      
      instancedMesh.setMatrixAt(i, matrix);
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    
    this.instancedMeshes.set(hardwareType, instancedMesh);
    return instancedMesh;
  }
  
  updateInstance(
    hardwareType: string,
    index: number,
    transform: { position: Vector3; rotation: Euler; scale: Vector3 }
  ): void {
    
    const mesh = this.instancedMeshes.get(hardwareType);
    if (!mesh) return;
    
    const matrix = new THREE.Matrix4();
    matrix.compose(
      transform.position,
      new THREE.Quaternion().setFromEuler(transform.rotation),
      transform.scale
    );
    
    mesh.setMatrixAt(index, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
}
```

### 3.2 Instancing Rules

**Always Instance:**
- Hinges (2-5 identical instances per door)
- Screws/fasteners (many small identical objects)
- Glass panels (if multiple doors with same glass config)

**Sometimes Instance:**
- Handles (if multiple doors with same handle type)
- Locks (if multiple identical doors)

**Never Instance:**
- Door frames (unique per configuration)
- Door leafs (unique geometry with embossing)
- Custom hardware

## 4. GEOMETRY CACHING

### 4.1 Cache Strategy

```typescript
interface GeometryCacheKey {
  type: 'frame' | 'leaf' | 'hardware';
  dimensions: string;        // Stringified dimension hash
  parameters: string;        // Stringified parameter hash
  lod: number;
}

class GeometryCache {
  
  private cache: Map<string, THREE.BufferGeometry> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private memoryUsed: number = 0;
  
  getCacheKey(key: GeometryCacheKey): string {
    return `${key.type}_${key.dimensions}_${key.parameters}_${key.lod}`;
  }
  
  get(key: GeometryCacheKey): THREE.BufferGeometry | null {
    const cacheKey = this.getCacheKey(key);
    const geometry = this.cache.get(cacheKey);
    
    if (geometry) {
      this.cacheHits++;
      return geometry;
    }
    
    this.cacheMisses++;
    return null;
  }
  
  set(
    key: GeometryCacheKey,
    geometry: THREE.BufferGeometry
  ): void {
    
    const cacheKey = this.getCacheKey(key);
    const geometrySize = this.estimateGeometrySize(geometry);
    
    // Check memory budget
    if (this.memoryUsed + geometrySize > PERFORMANCE_TARGETS.memory.maxGeometryCache) {
      this.evictLRU(geometrySize);
    }
    
    this.cache.set(cacheKey, geometry);
    this.memoryUsed += geometrySize;
  }
  
  private estimateGeometrySize(geometry: THREE.BufferGeometry): number {
    let size = 0;
    
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      size += attribute.array.byteLength;
    }
    
    if (geometry.index) {
      size += geometry.index.array.byteLength;
    }
    
    return size;
  }
  
  private evictLRU(neededSize: number): void {
    // Implement LRU eviction
    // Remove least recently used geometries until space available
  }
  
  getCacheStats(): { hits: number; misses: number; hitRate: number; memoryUsed: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      memoryUsed: this.memoryUsed
    };
  }
}
```

### 4.2 Cache Invalidation

```typescript
enum InvalidationStrategy {
  IMMEDIATE,     // Clear immediately on parameter change
  DEFERRED,      // Clear on next garbage collection
  LAZY           // Clear only when memory pressure detected
}

function shouldInvalidateCache(
  oldConfig: DoorConfiguration,
  newConfig: DoorConfiguration
): boolean {
  
  // Only invalidate if geometry-affecting parameters changed
  
  const geometryKeys = [
    'doorType',
    'dimensions',
    'leafs.configuration',
    'frame.profile',
    'embossing'
  ];
  
  for (const key of geometryKeys) {
    if (getNestedProperty(oldConfig, key) !== getNestedProperty(newConfig, key)) {
      return true;
    }
  }
  
  return false;
}
```

## 5. TEXTURE OPTIMIZATION

### 5.1 Texture Loading Strategy

```typescript
class TextureLoader {
  
  private loadQueue: TextureLoadRequest[] = [];
  private loadedTextures: Map<string, THREE.Texture> = new Map();
  private maxConcurrentLoads: number = 4;
  
  async loadTexture(
    url: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<THREE.Texture> {
    
    // Check cache first
    const cached = this.loadedTextures.get(url);
    if (cached) return cached;
    
    // Add to queue
    return new Promise((resolve, reject) => {
      this.loadQueue.push({
        url,
        priority,
        resolve,
        reject
      });
      
      this.loadQueue.sort((a, b) => {
        const priorities = { high: 0, medium: 1, low: 2 };
        return priorities[a.priority] - priorities[b.priority];
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    // Process queue respecting concurrency limit
    // Use placeholder textures while loading
  }
  
  private createPlaceholderTexture(type: 'wood' | 'metal' | 'glass'): THREE.Texture {
    // Create simple colored texture as placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    const colors = {
      wood: '#8B7355',
      metal: '#C0C0C0',
      glass: '#E0F0FF'
    };
    
    ctx.fillStyle = colors[type];
    ctx.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
  }
}
```

### 5.2 Texture Compression

```typescript
interface TextureCompressionConfig {
  format: 'DXT' | 'ASTC' | 'ETC2' | 'none';
  quality: 'high' | 'medium' | 'low';
  mipmaps: boolean;
}

function getOptimalTextureConfig(
  deviceCapabilities: WebGLCapabilities
): TextureCompressionConfig {
  
  // Check for compression support
  const supportsDXT = deviceCapabilities.extensions.has('WEBGL_compressed_texture_s3tc');
  const supportsASTC = deviceCapabilities.extensions.has('WEBGL_compressed_texture_astc');
  const supportsETC2 = deviceCapabilities.extensions.has('WEBGL_compressed_texture_etc');
  
  if (supportsASTC) {
    return { format: 'ASTC', quality: 'high', mipmaps: true };
  } else if (supportsDXT) {
    return { format: 'DXT', quality: 'high', mipmaps: true };
  } else if (supportsETC2) {
    return { format: 'ETC2', quality: 'medium', mipmaps: true };
  } else {
    return { format: 'none', quality: 'medium', mipmaps: true };
  }
}
```

### 5.3 Texture Atlas

```typescript
interface TextureAtlasConfig {
  size: number;              // Atlas size (e.g., 2048x2048)
  padding: number;           // Padding between textures (px)
  textures: AtlasTexture[];
}

interface AtlasTexture {
  id: string;
  uv: { min: Vector2; max: Vector2 };  // UV coordinates in atlas
}

class TextureAtlas {
  
  createAtlas(
    textures: Map<string, HTMLImageElement>,
    atlasSize: number = 2048
  ): { atlas: THREE.Texture; uvMap: Map<string, UVBounds> } {
    
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d')!;
    
    // Pack textures using bin packing algorithm
    const packer = new BinPacker(atlasSize, atlasSize);
    const uvMap = new Map<string, UVBounds>();
    
    for (const [id, image] of textures) {
      const rect = packer.pack(image.width, image.height);
      if (!rect) {
        console.warn(`Texture ${id} doesn't fit in atlas`);
        continue;
      }
      
      // Draw texture to atlas
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      
      // Store UV coordinates
      uvMap.set(id, {
        min: new Vector2(rect.x / atlasSize, rect.y / atlasSize),
        max: new Vector2(
          (rect.x + rect.width) / atlasSize,
          (rect.y + rect.height) / atlasSize
        )
      });
    }
    
    const atlas = new THREE.CanvasTexture(canvas);
    return { atlas, uvMap };
  }
}
```

## 6. RENDER OPTIMIZATION

### 6.1 Frustum Culling

```typescript
function enableFrustumCulling(object: THREE.Object3D): void {
  object.frustumCulled = true;
  object.traverse(child => {
    child.frustumCulled = true;
  });
}

function updateBoundingSpheres(scene: THREE.Scene): void {
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.computeBoundingSphere();
    }
  });
}
```

### 6.2 Batch Rendering

```typescript
class BatchRenderer {
  
  groupMeshesByMaterial(
    meshes: THREE.Mesh[]
  ): Map<THREE.Material, THREE.Mesh[]> {
    
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    
    for (const mesh of meshes) {
      const material = mesh.material as THREE.Material;
      if (!groups.has(material)) {
        groups.set(material, []);
      }
      groups.get(material)!.push(mesh);
    }
    
    return groups;
  }
  
  mergeGeometries(meshes: THREE.Mesh[]): THREE.BufferGeometry {
    const geometries = meshes.map(mesh => {
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      return geo;
    });
    
    return BufferGeometryUtils.mergeBufferGeometries(geometries);
  }
}
```

### 6.3 Shadow Optimization

```typescript
interface ShadowConfig {
  enabled: boolean;
  mapSize: number;
  bias: number;
  radius: number;
  castShadows: string[];     // Objects that cast shadows
  receiveShadows: string[];  // Objects that receive shadows
}

const SHADOW_CONFIG: ShadowConfig = {
  enabled: true,
  mapSize: 2048,
  bias: -0.0001,
  radius: 2,
  castShadows: ['doorLeaf', 'doorFrame', 'hardware'],
  receiveShadows: ['groundPlane', 'walls']
};

function optimizeShadows(light: THREE.DirectionalLight, config: ShadowConfig): void {
  
  light.castShadow = config.enabled;
  light.shadow.mapSize.width = config.mapSize;
  light.shadow.mapSize.height = config.mapSize;
  light.shadow.bias = config.bias;
  light.shadow.radius = config.radius;
  
  // Optimize shadow camera frustum
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 20;
  light.shadow.camera.left = -5;
  light.shadow.camera.right = 5;
  light.shadow.camera.top = 5;
  light.shadow.camera.bottom = -5;
  light.shadow.camera.updateProjectionMatrix();
}
```

## 7. UPDATE STRATEGY

### 7.1 Incremental Updates

```typescript
enum UpdateCategory {
  FULL_REBUILD,       // Complete geometry regeneration
  HARDWARE_REPOSITION,// Only hardware positions change
  MATERIAL_UPDATE,    // Only material properties change
  ANIMATION_UPDATE    // Only transform updates
}

function categorizeUpdate(
  oldConfig: DoorConfiguration,
  newConfig: DoorConfiguration
): UpdateCategory {
  
  // Check what changed
  const dimensionsChanged = !deepEqual(oldConfig.dimensions, newConfig.dimensions);
  const geometryChanged = !deepEqual(oldConfig.leafs, newConfig.leafs);
  const hardwareCountChanged = oldConfig.hardware.hinges.count !== newConfig.hardware.hinges.count;
  const materialChanged = !deepEqual(oldConfig.materials, newConfig.materials);
  
  if (dimensionsChanged || geometryChanged) {
    return UpdateCategory.FULL_REBUILD;
  }
  
  if (hardwareCountChanged) {
    return UpdateCategory.HARDWARE_REPOSITION;
  }
  
  if (materialChanged) {
    return UpdateCategory.MATERIAL_UPDATE;
  }
  
  return UpdateCategory.ANIMATION_UPDATE;
}

function executeUpdate(
  category: UpdateCategory,
  config: DoorConfiguration
): void {
  
  switch (category) {
    case UpdateCategory.FULL_REBUILD:
      rebuildDoorGeometry(config);
      break;
    
    case UpdateCategory.HARDWARE_REPOSITION:
      repositionHardware(config);
      break;
    
    case UpdateCategory.MATERIAL_UPDATE:
      updateMaterials(config);
      break;
    
    case UpdateCategory.ANIMATION_UPDATE:
      // No geometry update needed
      break;
  }
}
```

### 7.2 Debouncing

```typescript
class ParameterUpdateDebouncer {
  
  private pendingUpdate: DoorConfiguration | null = null;
  private debounceTimer: number | null = null;
  private debounceDelay: number = 300;  // ms
  
  scheduleUpdate(config: DoorConfiguration): void {
    
    this.pendingUpdate = config;
    
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = window.setTimeout(() => {
      if (this.pendingUpdate) {
        this.executeUpdate(this.pendingUpdate);
        this.pendingUpdate = null;
      }
      this.debounceTimer = null;
    }, this.debounceDelay);
  }
  
  private executeUpdate(config: DoorConfiguration): void {
    // Perform actual geometry/scene update
  }
  
  flush(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      if (this.pendingUpdate) {
        this.executeUpdate(this.pendingUpdate);
      }
      this.pendingUpdate = null;
      this.debounceTimer = null;
    }
  }
}
```

## 8. MEMORY MANAGEMENT

### 8.1 Resource Disposal

```typescript
class ResourceManager {
  
  private disposalQueue: THREE.Object3D[] = [];
  
  dispose(object: THREE.Object3D): void {
    
    object.traverse(child => {
      
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      
      // Dispose textures
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
      }
    });
    
    // Remove from scene
    if (object.parent) {
      object.parent.remove(object);
    }
  }
  
  scheduleDisposal(object: THREE.Object3D, delay: number = 0): void {
    setTimeout(() => this.dispose(object), delay);
  }
}
```

### 8.2 Memory Monitoring

```typescript
interface MemoryStats {
  geometries: number;
  textures: number;
  programs: number;
  totalMemoryMB: number;
}

function getMemoryStats(renderer: THREE.WebGLRenderer): MemoryStats {
  
  const info = renderer.info;
  
  return {
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length || 0,
    totalMemoryMB: (
      info.memory.geometries * 10000 +  // Rough estimate
      info.memory.textures * 100000
    ) / (1024 * 1024)
  };
}

function checkMemoryPressure(stats: MemoryStats): boolean {
  return stats.totalMemoryMB > PERFORMANCE_TARGETS.memory.maxTotalMemory / (1024 * 1024);
}
```

## 9. PROFILING AND MONITORING

### 9.1 Performance Metrics

```typescript
class PerformanceMonitor {
  
  private frameTimes: number[] = [];
  private maxSamples: number = 60;
  
  recordFrameTime(time: number): void {
    this.frameTimes.push(time);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }
  
  getMetrics(): {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    percentile95: number;
  } {
    
    const fps = this.frameTimes.map(t => 1000 / t);
    
    return {
      averageFPS: fps.reduce((a, b) => a + b, 0) / fps.length,
      minFPS: Math.min(...fps),
      maxFPS: Math.max(...fps),
      percentile95: this.percentile(fps, 0.95)
    };
  }
  
  private percentile(values: number[], p: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index];
  }
}
```

## 10. PLATFORM-SPECIFIC OPTIMIZATIONS

### 10.1 Mobile Optimizations

```typescript
const MOBILE_OPTIMIZATIONS = {
  pixelRatio: Math.min(window.devicePixelRatio, 2),  // Cap at 2x
  shadowMapSize: 1024,                                // Reduced shadow resolution
  maxTextureSize: 1024,                               // Reduced texture resolution
  antialias: false,                                   // Disable antialiasing
  powerPreference: 'default' as WebGLPowerPreference, // Battery-conscious
  maxLights: 2,
  lodBias: 1                                          // Prefer lower LOD levels
};
```

### 10.2 Desktop Optimizations

```typescript
const DESKTOP_OPTIMIZATIONS = {
  pixelRatio: window.devicePixelRatio,
  shadowMapSize: 2048,
  maxTextureSize: 2048,
  antialias: true,
  powerPreference: 'high-performance' as WebGLPowerPreference,
  maxLights: 4,
  lodBias: 0
};
```

## 11. TESTING AND BENCHMARKING

### 11.1 Performance Test Suite

```typescript
interface PerformanceTest {
  name: string;
  setup: () => void;
  run: () => void;
  teardown: () => void;
  expectedFrameTime: number;  // ms
}

const PERFORMANCE_TESTS: PerformanceTest[] = [
  {
    name: 'Single door with high detail',
    setup: () => {/* Load config */},
    run: () => {/* Render frames */},
    teardown: () => {/* Cleanup */},
    expectedFrameTime: 10
  },
  {
    name: 'Double door with animation',
    setup: () => {},
    run: () => {},
    teardown: () => {},
    expectedFrameTime: 12
  },
  {
    name: 'Multiple rapid parameter changes',
    setup: () => {},
    run: () => {},
    teardown: () => {},
    expectedFrameTime: 15
  }
];
```

This completes the technical architecture documentation. All six documents provide comprehensive, production-ready specifications for your engineering team.