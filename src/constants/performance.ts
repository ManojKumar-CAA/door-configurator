// Performance constants from /docs/performance-guidelines.md

export const PERFORMANCE_TARGETS = {
    // Frame Rate Targets
    targetFPS: 60, // 16.67ms per frame
    criticalFPS: 30, // 33.33ms per frame (acceptable fallback)
    frameTimeBudget: 16, // ms

    // Load Time Targets
    loadTime: {
        initialScene: 2000, // ms - scene ready to interact
        textureLoading: 3000, // ms - all textures loaded
        fullConfiguration: 500 // ms - parameter change to render
    },

    // Memory Limits
    memory: {
        maxGeometryCache: 50 * 1024 * 1024, // 50MB
        maxTextureMemory: 100 * 1024 * 1024, // 100MB
        maxTotalMemory: 200 * 1024 * 1024 // 200MB
    }
} as const;

export const RENDER_CONFIG = {
    // Renderer Quality
    antialias: true,
    shadows: true,
    shadowMapType: 'PCFSoft' as const,
    pixelRatio: 1.5, // Cap pixel ratio for performance
    
    // Scene Complexity
    maxLights: 8,
    maxObjects: 1000,
    maxVertices: 1000000
} as const;

export const DEBUG_CONFIG = {
    showStats: true,
    logPerformance: true,
    warnOnThresholds: true
} as const;
