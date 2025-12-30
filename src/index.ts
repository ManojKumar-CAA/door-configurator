import * as THREE from 'three';
import { PERFORMANCE_TARGETS } from './constants/performance';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import './style.css';

// ============================================================================
// DOOR CONFIGURATOR - PASS-1 IMPLEMENTATION
// Following /docs/architecture.md specifications
// ============================================================================

class DoorConfigurator {
    // Core Three.js components
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    
    // Lighting system (Key/Fill/Rim from architecture)
    private keyLight: THREE.DirectionalLight;
    private fillLight: THREE.DirectionalLight;
    private rimLight: THREE.DirectionalLight;
    private ambientLight: THREE.AmbientLight;
    
    // Performance monitoring
    private performanceMonitor: PerformanceMonitor;
    private frameId: number = 0;
    private startTime: number = 0;
    
    // Configuration from architecture.md
    private readonly CONFIG = {
        // Camera: 45° isometric from architecture.md
        camera: {
            fov: 45,
            near: 0.1,
            far: 1000,
            position: new THREE.Vector3(10, 10, 10), // 45° isometric
            lookAt: new THREE.Vector3(0, 0, 0)
        },
        
        // Lighting configuration from architecture.md
        lighting: {
            key: {
                color: 0xffffff,
                intensity: 1.0,
                position: new THREE.Vector3(10, 10, 10),
                castShadow: true
            },
            fill: {
                color: 0x4444ff,
                intensity: 0.3,
                position: new THREE.Vector3(-10, 5, -10)
            },
            rim: {
                color: 0xff4444,
                intensity: 0.2,
                position: new THREE.Vector3(0, -10, 10)
            },
            ambient: {
                color: 0x222222,
                intensity: 0.1
            }
        },
        
        // Scene configuration
        scene: {
            background: new THREE.Color(0x111122),
            fog: {
                color: 0x111122,
                near: 1,
                far: 100
            }
        }
    };

    constructor() {
        console.log('🚪 Door Configurator - PASS-1 Initializing...');
        console.log('📚 Referencing architecture from /docs/ folder');
        
        this.performanceMonitor = new PerformanceMonitor();
        this.startTime = performance.now();
        
        this.initialize();
        this.setupEventListeners();
    }

    private initialize(): void {
        // 1. Create Scene (following architecture.md)
        this.createScene();
        
        // 2. Create Camera (45° isometric as specified)
        this.createCamera();
        
        // 3. Create Renderer (with performance considerations)
        this.createRenderer();
        
        // 4. Create Lighting System (Key/Fill/Rim from architecture)
        this.createLighting();
        
        // 5. Add Reference Grid (for visualization only)
        this.addReferenceGrid();
        
        // 6. Start Render Loop
        this.animate();
        
        this.logPerformance('Initialization complete');
    }

    private createScene(): void {
        this.scene = new THREE.Scene();
        
        // Set background color from configuration
        this.scene.background = this.CONFIG.scene.background;
        
        // Add fog for depth perception (from performance guidelines)
        this.scene.fog = new THREE.Fog(
            this.CONFIG.scene.fog.color,
            this.CONFIG.scene.fog.near,
            this.CONFIG.scene.fog.far
        );
        
        console.log('✅ Scene created with background and fog');
    }

    private createCamera(): void {
        const aspect = window.innerWidth / window.innerHeight;
        
        // Create perspective camera with 45° FOV
        this.camera = new THREE.PerspectiveCamera(
            this.CONFIG.camera.fov,
            aspect,
            this.CONFIG.camera.near,
            this.CONFIG.camera.far
        );
        
        // Set 45° isometric position (from architecture.md)
        this.camera.position.copy(this.CONFIG.camera.position);
        this.camera.lookAt(this.CONFIG.camera.lookAt);
        
        console.log(`✅ Camera created: 45° isometric at ${this.camera.position.toArray()}`);
    }

    private createRenderer(): void {
        // Create WebGL renderer with performance optimizations
        this.renderer = new THREE.WebGLRenderer({
            antialias: true, // Smooth edges
            alpha: false,
            powerPreference: 'high-performance',
            precision: 'highp'
        });
        
        // Set renderer size to match window
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Cap pixel ratio for performance
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        
        // Enable shadow maps (for future door geometry)
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Set tone mapping for better visual quality
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Add renderer to DOM
        document.getElementById('app')?.appendChild(this.renderer.domElement);
        
        console.log(`✅ Renderer created: ${window.innerWidth}x${window.innerHeight}`);
        console.log(`   Antialias: true, Shadows: true, Pixel Ratio: ${this.renderer.getPixelRatio()}`);
    }

    private createLighting(): void {
        // KEY LIGHT (Primary directional light)
        this.keyLight = new THREE.DirectionalLight(
            this.CONFIG.lighting.key.color,
            this.CONFIG.lighting.key.intensity
        );
        this.keyLight.position.copy(this.CONFIG.lighting.key.position);
        this.keyLight.castShadow = this.CONFIG.lighting.key.castShadow;
        
        // Configure shadow quality
        if (this.keyLight.castShadow) {
            this.keyLight.shadow.mapSize.width = 2048;
            this.keyLight.shadow.mapSize.height = 2048;
            this.keyLight.shadow.camera.near = 0.5;
            this.keyLight.shadow.camera.far = 50;
            this.keyLight.shadow.bias = -0.001;
        }
        
        // FILL LIGHT (Secondary directional light)
        this.fillLight = new THREE.DirectionalLight(
            this.CONFIG.lighting.fill.color,
            this.CONFIG.lighting.fill.intensity
        );
        this.fillLight.position.copy(this.CONFIG.lighting.fill.position);
        
        // RIM LIGHT (Back light for edge definition)
        this.rimLight = new THREE.DirectionalLight(
            this.CONFIG.lighting.rim.color,
            this.CONFIG.lighting.rim.intensity
        );
        this.rimLight.position.copy(this.CONFIG.lighting.rim.position);
        
        // AMBIENT LIGHT (Global illumination)
        this.ambientLight = new THREE.AmbientLight(
            this.CONFIG.lighting.ambient.color,
            this.CONFIG.lighting.ambient.intensity
        );
        
        // Add all lights to scene
        this.scene.add(this.keyLight);
        this.scene.add(this.fillLight);
        this.scene.add(this.rimLight);
        this.scene.add(this.ambientLight);
        
        // Add light helpers for debugging (optional)
        if (process.env.NODE_ENV === 'development') {
            const keyLightHelper = new THREE.DirectionalLightHelper(this.keyLight, 1);
            const fillLightHelper = new THREE.DirectionalLightHelper(this.fillLight, 1);
            const rimLightHelper = new THREE.DirectionalLightHelper(this.rimLight, 1);
            
            this.scene.add(keyLightHelper);
            this.scene.add(fillLightHelper);
            this.scene.add(rimLightHelper);
        }
        
        console.log('✅ Lighting system created: Key, Fill, Rim, and Ambient lights');
    }

    private addReferenceGrid(): void {
        // Add grid helper for spatial reference (not part of final product)
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        gridHelper.position.y = -0.01; // Slightly below origin
        this.scene.add(gridHelper);
        
        // Add axes helper for orientation
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
        
        console.log('✅ Reference grid and axes added for visualization');
    }

    private animate = (): void => {
        this.frameId = requestAnimationFrame(this.animate);
        this.render();
    }

    private render(): void {
        // PASS-1: Simple render loop without animation
        // Future passes will add door geometry and interactions
        
        this.renderer.render(this.scene, this.camera);
    }

    private setupEventListeners(): void {
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Handle performance warnings
        window.addEventListener('load', () => {
            const loadTime = performance.now() - this.startTime;
            this.logPerformance(`Scene loaded in ${loadTime.toFixed(0)}ms`);
            
            if (loadTime > PERFORMANCE_TARGETS.loadTime.initialScene) {
                console.warn(`⚠️ Load time (${loadTime.toFixed(0)}ms) exceeds target (${PERFORMANCE_TARGETS.loadTime.initialScene}ms)`);
            }
        });
    }

    private onWindowResize(): void {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        this.logPerformance(`Window resized to ${window.innerWidth}x${window.innerHeight}`);
    }

    private logPerformance(message: string): void {
        const timestamp = (performance.now() - this.startTime).toFixed(0);
        console.log(`[${timestamp}ms] ${message}`);
        this.performanceMonitor.log(message);
    }

    // Public API for future passes
    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    public getLights(): {
        key: THREE.DirectionalLight;
        fill: THREE.DirectionalLight;
        rim: THREE.DirectionalLight;
        ambient: THREE.AmbientLight;
    } {
        return {
            key: this.keyLight,
            fill: this.fillLight,
            rim: this.rimLight,
            ambient: this.ambientLight
        };
    }

    public dispose(): void {
        cancelAnimationFrame(this.frameId);
        this.renderer.dispose();
        console.log('🔌 Door Configurator disposed');
    }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new DoorConfigurator();
        
        // Make available globally for debugging
        (window as any).doorConfigurator = app;
        
        console.log('🎉 Door Configurator PASS-1 successfully initialized!');
        console.log('📋 Next steps: Implement door geometry in PASS-2');
        
    } catch (error) {
        console.error('❌ Failed to initialize Door Configurator:', error);
        
        // Show error to user
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div style="color: white; padding: 40px; text-align: center;">
                    <h1 style="color: #f87171;">Initialization Failed</h1>
                    <p>${error}</p>
                    <p>Check console for details</p>
                </div>
            `;
        }
    }
});

// Export for module usage
export default DoorConfigurator;
