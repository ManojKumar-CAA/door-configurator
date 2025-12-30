import { PERFORMANCE_TARGETS } from '../constants/performance';

export class PerformanceMonitor {
    private frameCount: number = 0;
    private lastTime: number = 0;
    private fps: number = 0;
    private frameTime: number = 0;
    private fpsElement: HTMLElement | null = null;
    private frameTimeElement: HTMLElement | null = null;
    private memoryElement: HTMLElement | null = null;
    private warningElement: HTMLElement | null = null;

    constructor() {
        this.lastTime = performance.now();
        this.initializeElements();
        this.startMonitoring();
    }

    private initializeElements(): void {
        this.fpsElement = document.getElementById('fps-counter');
        this.frameTimeElement = document.getElementById('frame-time');
        this.memoryElement = document.getElementById('memory-usage');
        this.warningElement = document.getElementById('performance-warning');
    }

    private startMonitoring(): void {
        requestAnimationFrame(() => this.update());
    }

    private update(): void {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        
        this.frameCount++;
        
        // Update FPS every second
        if (deltaTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.frameTime = deltaTime / this.frameCount;
            
            this.updateDisplay();
            this.checkPerformanceThresholds();
            
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        requestAnimationFrame(() => this.update());
    }

    private updateDisplay(): void {
        if (this.fpsElement) {
            this.fpsElement.textContent = this.fps.toString();
            this.fpsElement.className = this.getPerformanceClass(this.fps, 'fps');
        }
        
        if (this.frameTimeElement) {
            this.frameTimeElement.textContent = this.frameTime.toFixed(2);
            this.frameTimeElement.className = this.getPerformanceClass(
                this.frameTime, 
                'frameTime'
            );
        }
        
        // Update memory usage (simulated for now)
        if (this.memoryElement) {
            const memoryUsage = Math.random() * 100; // Simulated
            this.memoryElement.textContent = memoryUsage.toFixed(1);
            this.memoryElement.className = this.getPerformanceClass(
                memoryUsage, 
                'memory'
            );
        }
    }

    private getPerformanceClass(value: number, type: 'fps' | 'frameTime' | 'memory'): string {
        switch (type) {
            case 'fps':
                if (value >= PERFORMANCE_TARGETS.targetFPS) return 'status-value good';
                if (value >= PERFORMANCE_TARGETS.criticalFPS) return 'status-value warning';
                return 'status-value critical';
                
            case 'frameTime':
                if (value <= PERFORMANCE_TARGETS.frameTimeBudget) return 'status-value good';
                if (value <= PERFORMANCE_TARGETS.frameTimeBudget * 2) return 'status-value warning';
                return 'status-value critical';
                
            case 'memory':
                const maxMemory = PERFORMANCE_TARGETS.memory.maxTotalMemory / (1024 * 1024);
                if (value <= maxMemory * 0.7) return 'status-value good';
                if (value <= maxMemory * 0.9) return 'status-value warning';
                return 'status-value critical';
        }
    }

    private checkPerformanceThresholds(): void {
        if (!this.warningElement) return;
        
        if (this.fps < PERFORMANCE_TARGETS.criticalFPS) {
            this.warningElement.classList.remove('hidden');
        } else {
            this.warningElement.classList.add('hidden');
        }
    }

    public getFPS(): number {
        return this.fps;
    }

    public getFrameTime(): number {
        return this.frameTime;
    }

    public log(message: string): void {
        if (PERFORMANCE_TARGETS.targetFPS >= 60) {
            console.log(`[Performance] ${message}`);
        }
    }
}
