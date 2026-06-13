// --- 1. CORE CLIPQON ENGINE ---
class CLIPQON {
    constructor() {
        this.POINT_WIDTH = 10;
        this.TOTAL_POINTS = 300;  
        this.MIN_LAYER_POINTS = 1; 

        this.trackHeight = 40; 
        this.currentRenderRatio = null;
        this.scrollInterval = null; 
        this.lastFrameTime = 0;
        this.playAnimFrame = null;
        this.scrollTicking = false;

        this.CLIPQON_mediaRecorder = null;
        this.CLIPQON_audioChunks = [];
        this.audioCtx = null;
        this.state = {
            ratio: 'original', quality: 720,      
            playing: false, mediaWidth: 1280, mediaHeight: 720,
            currentFps: 30, selectedLayerIndex: null
        };
        this.mediaLayers = [];
        
        // Undo-Redo માટે સ્ટેક 
        this.historyStack = [];
        this.redoStack = [];
        
        this.CLIPQON_init(); 
        this.CLIPQON_events();
    }        

    CLIPQON_init() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.box = document.getElementById('canvas-box');
        this.view = document.getElementById('viewport');
        this.rulerCanvas = document.getElementById('ruler-canvas');
        this.rulerCtx = this.rulerCanvas.getContext('2d');
        this.scrollArea = document.getElementById('timeline-scroll');
        this.gifOverlay = document.getElementById('gif-canvas-overlay');
        this.layersArea = document.getElementById('layers-area');
        
        this.CLIPQON_updateTimelineBounds();
        this.CLIPQON_refresh(); 
        this.CLIPQON_drawRuler(); 
    }

    // સ્ટેટ સેવિંગ ફંક્શન્સ (Undo/Redo માટે)
    CLIPQON_saveState() {
        const snapshot = JSON.stringify(this.mediaLayers.map(l => ({
            id: l.id, startPoint: l.startPoint, endPoint: l.endPoint, 
            track: l.track, visible: l.visible, speed: l.speed, volume: l.volume, filter: l.filter
        })));
        this.historyStack.push(snapshot);
        this.redoStack = []; 
    }

    CLIPQON_undo() {
        if (this.historyStack.length > 0) {
            this.redoStack.push(JSON.stringify(this.mediaLayers.map(l => ({ 
                id: l.id, startPoint: l.startPoint, endPoint: l.endPoint, track: l.track, visible: l.visible, speed: l.speed, volume: l.volume, filter: l.filter 
            }))));
            const prevState = JSON.parse(this.historyStack.pop());
            this.mediaLayers.forEach(l => {
                const savedLayer = prevState.find(ps => ps.id === l.id);
                if (savedLayer) Object.assign(l, savedLayer);
            });
            this.CLIPQON_updateTimelineBounds();
            this.CLIPQON_render();
            this.CLIPQON_showNotification("↩ Undo Applied");
        } else {
            this.CLIPQON_showNotification("Nothing to Undo");
        }
    }

    CLIPQON_redo() {
        if (this.redoStack.length > 0) {
            this.historyStack.push(JSON.stringify(this.mediaLayers.map(l => ({ 
                id: l.id, startPoint: l.startPoint, endPoint: l.endPoint, track: l.track, visible: l.visible, speed: l.speed, volume: l.volume, filter: l.filter 
            }))));
            const nextState = JSON.parse(this.redoStack.pop());
            this.mediaLayers.forEach(l => {
                const savedLayer = nextState.find(ps => ps.id === l.id);
                if (savedLayer) Object.assign(l, savedLayer);
            });
            this.CLIPQON_updateTimelineBounds();
            this.CLIPQON_render();
            this.CLIPQON_showNotification("↪ Redo Applied");
        } else {
            this.CLIPQON_showNotification("Nothing to Redo");
        }
    }

    CLIPQON_getCurrentPoint() { return Math.round(this.scrollArea.scrollLeft / this.POINT_WIDTH); }
    CLIPQON_secondsToPoints(seconds) { return Math.round(seconds * this.state.currentFps); }
    CLIPQON_pointsToSeconds(points) { return points / this.state.currentFps; }

    CLIPQON_events() {
        document.getElementById('ratio-toggle').addEventListener('click', (e) => { e.stopPropagation(); this.CLIPQON_closeMenus(); document.getElementById('ratio-menu').style.display = 'block'; });
        document.getElementById('res-toggle').addEventListener('click', (e) => { e.stopPropagation(); this.CLIPQON_closeMenus(); document.getElementById('res-menu').style.display = 'block'; });
        document.getElementById('fps-toggle').addEventListener('click', (e) => { e.stopPropagation(); this.CLIPQON_closeMenus(); document.getElementById('fps-menu').style.display = 'block'; });
        window.addEventListener('click', () => this.CLIPQON_closeMenus());
        
        document.querySelectorAll('.res-item').forEach(item => { item.addEventListener('click', () => { this.state.quality = parseInt(item.dataset.res); document.getElementById('cur-res').innerText = item.dataset.res + "p"; this.CLIPQON_refresh(); this.CLIPQON_closeMenus(); }); });
        document.querySelectorAll('.fps-item').forEach(item => { 
            item.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                const newFps = parseInt(item.dataset.fps);
                const oldFps = this.state.currentFps;
                if (newFps !== oldFps) {
                    const ratio = newFps / oldFps;
                    this.mediaLayers.forEach(l => {
                        l.startPoint = Math.round(l.startPoint * ratio);
                        l.endPoint = Math.round(l.endPoint * ratio);
                        if (l.audioOffsetPoints) l.audioOffsetPoints = Math.round(l.audioOffsetPoints * ratio);
                        if (l.fadeInPoints) l.fadeInPoints = Math.round(l.fadeInPoints * ratio);
                        if (l.fadeOutPoints) l.fadeOutPoints = Math.round(l.fadeOutPoints * ratio);
                    });
                    this.state.currentFps = newFps;
                    this.scrollArea.scrollLeft = this.scrollArea.scrollLeft * ratio;
                }
                document.getElementById('cur-fps').innerText = newFps;
                document.querySelectorAll('.fps-item').forEach(b => b.classList.remove('active'));
                item.classList.add('active'); 
                this.CLIPQON_closeMenus(); 
                this.CLIPQON_updateTimelineBounds();
                this.CLIPQON_drawRuler(); 
                this.CLIPQON_render();
            }); 
        });
        document.querySelectorAll('.r-btn[data-ratio]').forEach(btn => { 
            btn.addEventListener('click', () => { 
                let r = btn.dataset.ratio; 
                document.querySelectorAll('.r-btn[data-ratio]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (r === "original") { this.state.ratio = "original"; this.CLIPQON_applyOriginalRatio(); } 
                else { this.state.ratio = parseFloat(r); document.getElementById('cur-label').innerText = btn.dataset.label; this.CLIPQON_refresh(); }
                this.CLIPQON_closeMenus(); 
            }); 
        });
        this.scrollArea.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                this.POINT_WIDTH = Math.max(2, Math.min(this.POINT_WIDTH * zoomFactor, 50));
                this.CLIPQON_updateTimelineBounds();
                this.CLIPQON_drawRuler();
                this.CLIPQON_render();
            }
        }, { passive: false });
        this.view.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoom = e.deltaY > 0 ? 0.95 : 1.05;
            const l = this.mediaLayers[this.state.selectedLayerIndex];
            if(l) { l.scale = Math.max(0.05, Math.min((l.scale || 1) * zoom, 15)); this.CLIPQON_render(); }
        }, { passive: false });
        this.box.addEventListener('mousedown', (e) => this.CLIPQON_handleCanvasInteraction(e));
        this.box.addEventListener('touchstart', (e) => this.CLIPQON_handleCanvasInteraction(e));

        const importTrigger = document.getElementById('import-trigger');
        const fileInp = document.getElementById('file-inp');
        if(importTrigger && fileInp) {
            importTrigger.addEventListener('click', () => fileInp.click());
            fileInp.addEventListener('change', (e) => this.CLIPQON_loadFile(e, 'main'));
        }

        const overlayInp = document.getElementById('overlay-inp');
        if (overlayInp) {
            document.querySelectorAll('#btn-overlay-add').forEach(el => el.addEventListener('click', () => overlayInp.click()));
            overlayInp.addEventListener('change', (e) => this.CLIPQON_loadFile(e, 'overlay'));
        }

        const audioInp = document.getElementById('audio-inp');
        if (audioInp) {
            document.querySelectorAll('#btn-audio-add').forEach(el => el.addEventListener('click', () => audioInp.click()));
            audioInp.addEventListener('change', (e) => this.CLIPQON_loadAudio(e));
        }
        
        const bindClick = (id, action) => { const el = document.getElementById(id); if(el) el.addEventListener('click', action); };
        
        bindClick('btn-play', () => this.CLIPQON_togglePlay());
        bindClick('btn-undo', () => this.CLIPQON_undo());
        bindClick('btn-redo', () => this.CLIPQON_redo());
        
        document.querySelectorAll('#btn-split, #btn-split-shortcut').forEach(el => el.addEventListener('click', () => this.CLIPQON_splitLayer()));
        document.querySelectorAll('#btn-delete, #btn-delete-shortcut').forEach(el => el.addEventListener('click', () => this.CLIPQON_deleteLayer()));
        document.querySelectorAll('#btn-copy, #btn-copy-shortcut').forEach(el => el.addEventListener('click', () => this.CLIPQON_duplicateLayer()));
        document.querySelectorAll('#btn-speed, #btn-speed-shortcut').forEach(el => el.addEventListener('click', () => this.CLIPQON_adjustSpeed()));
        
        bindClick('btn-fit', () => this.CLIPQON_toggleOrientation());
        bindClick('btn-front', () => this.CLIPQON_bringToFront());
        bindClick('btn-fade', () => this.CLIPQON_adjustFade());
        bindClick('btn-hsl-shortcut', () => openHSL());
        bindClick('btn-expand', () => this.CLIPQON_aiExpand());
        bindClick('btn-minimize', () => this.CLIPQON_toggleMinimize());

        document.querySelectorAll('#btn-record-add').forEach(el => el.addEventListener('click', () => this.CLIPQON_startRecord()));
        document.querySelectorAll('#btn-text-add').forEach(el => el.addEventListener('click', () => this.CLIPQON_addTextLayer()));
        document.querySelectorAll('#btn-fx-add').forEach(el => el.addEventListener('click', () => this.CLIPQON_applyFX()));
        
        this.scrollArea.addEventListener('scroll', () => {
            if (!this.scrollTicking) {
                window.requestAnimationFrame(() => {
                    if (!this.state.playing) this.CLIPQON_updatePlayheadPosition();
                    this.CLIPQON_drawRuler();
                    if (!this.state.playing) this.CLIPQON_render(); 
                    this.scrollTicking = false; 
                });
                this.scrollTicking = true; 
            }
        });
        window.addEventListener('resize', () => this.CLIPQON_refresh());
        this.CLIPQON_initTimelineBlankScroll();
        this.CLIPQON_applyTeleportLogic('main-toolbar-container', 'main-track-left', 'main-track-right');
    }

    CLIPQON_applyTeleportLogic(containerId, leftTrackId, rightTrackId) {
        const container = document.getElementById(containerId);
        const trackLeft = document.getElementById(leftTrackId);
        const trackRight = document.getElementById(rightTrackId);

        if (!container || !trackLeft || !trackRight) return;

        let isDragging = false;
        let startX = 0;
        let currentTranslate = 0;
        let snapAnimId = null;
        
        const processTeleport = (deltaX) => {
            currentTranslate += deltaX;
            let rightFirst = trackRight.firstElementChild;
            while (rightFirst && currentTranslate <= -rightFirst.offsetWidth) {
                const shift = rightFirst.offsetWidth;
                trackLeft.appendChild(rightFirst);
                trackRight.appendChild(trackLeft.firstElementChild);
                currentTranslate += shift; 
                rightFirst = trackRight.firstElementChild;
            }

            let leftLast = trackLeft.lastElementChild;
            while (leftLast && currentTranslate >= leftLast.offsetWidth) {
                const shift = leftLast.offsetWidth;
                trackRight.insertBefore(leftLast, trackRight.firstElementChild);
                trackLeft.insertBefore(trackRight.lastElementChild, trackLeft.firstElementChild);
                currentTranslate -= shift; 
                leftLast = trackLeft.lastElementChild;
            }

            trackLeft.style.transform = `translateX(${currentTranslate}px)`;
            trackRight.style.transform = `translateX(${currentTranslate}px)`;
        };
        
        container.addEventListener('touchstart', (e) => {
            cancelAnimationFrame(snapAnimId);
            isDragging = true;
            startX = e.touches[0].clientX;
        }, { passive: true });
        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault(); 
            const currentX = e.touches[0].clientX;
            processTeleport(currentX - startX);
            startX = currentX; 
        }, { passive: false });
        
        const snapToGrid = () => {
            if (!isDragging) return;
            isDragging = false;

            let rightFirst = trackRight.firstElementChild;
            let leftLast = trackLeft.lastElementChild;
            if (rightFirst && currentTranslate < -rightFirst.offsetWidth / 2) {
                const shift = rightFirst.offsetWidth;
                trackLeft.appendChild(rightFirst);
                trackRight.appendChild(trackLeft.firstElementChild);
                currentTranslate += shift; 
            } else if (leftLast && currentTranslate > leftLast.offsetWidth / 2) {
                const shift = leftLast.offsetWidth;
                trackRight.insertBefore(leftLast, trackRight.firstElementChild);
                trackLeft.insertBefore(trackRight.lastElementChild, trackLeft.firstElementChild);
                currentTranslate -= shift; 
            }

            const animateSnap = () => {
                if (isDragging) return;
                if (Math.abs(currentTranslate) < 0.5) {
                    currentTranslate = 0;
                    trackLeft.style.transform = `translateX(0px)`;
                    trackRight.style.transform = `translateX(0px)`;
                    return;
                }
                currentTranslate += (0 - currentTranslate) * 0.15;
                trackLeft.style.transform = `translateX(${currentTranslate}px)`;
                trackRight.style.transform = `translateX(${currentTranslate}px)`;
                snapAnimId = requestAnimationFrame(animateSnap);
            };
            snapAnimId = requestAnimationFrame(animateSnap);
        };

        container.addEventListener('touchend', snapToGrid);
        container.addEventListener('mouseleave', () => { if(isDragging) snapToGrid(); });

        let scrollTimeout;
        container.addEventListener('wheel', (e) => {
            cancelAnimationFrame(snapAnimId);
            e.preventDefault();
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            processTeleport(-delta * 0.5);
            clearTimeout(scrollTimeout);
            isDragging = true;
            scrollTimeout = setTimeout(snapToGrid, 150);
        }, { passive: false });
    }

    CLIPQON_applyOriginalRatio() {
        if (this.currentRenderRatio) { document.getElementById('cur-label').innerText = `Orig (${this.currentRenderRatio.toFixed(2)})`; } 
        else { document.getElementById('cur-label').innerText = "Original"; }
        this.CLIPQON_refresh();
    }

    CLIPQON_refresh() {
        const gap = 20;
        const vw = this.view.clientWidth - gap;
        let vh = this.view.clientHeight - gap;
        let r = this.state.ratio === 'original' ? (this.currentRenderRatio || 16/9) : this.state.ratio;
        
        let dw, dh; 
        if (vw / r <= vh) { dw = vw; dh = vw / r; } else { dh = vh; dw = vh * r; }
        this.box.style.width = dw + "px";
        this.box.style.height = dh + "px";
        const baseRes = this.state.quality;
        if (r >= 1) { this.canvas.width = baseRes * r; this.canvas.height = baseRes; } 
        else { this.canvas.width = baseRes; this.canvas.height = baseRes / r; }
        
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.CLIPQON_updateTimelineBounds();
    }

    CLIPQON_handleCanvasInteraction(e) {
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        if (!l || !l.hasVisual) return;
        const isTouch = !!e.touches;
        let initialDist = 0, initialAngle = 0, initialScale = l.scale || 1, initialRotation = l.rotation || 0;
        const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const getAngle = (t1, t2) => Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
        
        if (isTouch && e.touches.length === 2) { 
            initialDist = getDist(e.touches[0], e.touches[1]);
            initialAngle = getAngle(e.touches[0], e.touches[1]); 
        }
        let sx = (isTouch ? e.touches[0] : e).clientX, sy = (isTouch ? e.touches[0] : e).clientY;
        
        const move = (me) => {
            me.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const scaleModifier = this.canvas.width / rect.width;
            if (isTouch && me.touches.length === 2) {
                l.scale = Math.max(0.05, initialScale * (getDist(me.touches[0], me.touches[1]) / initialDist));
                l.rotation = initialRotation + (getAngle(me.touches[0], me.touches[1]) - initialAngle);
            } else {
                const mp = isTouch ? me.touches[0] : me;
                l.x = (l.x || 0) + (mp.clientX - sx) * scaleModifier;
                l.y = (l.y || 0) + (mp.clientY - sy) * scaleModifier;
                
                if (Math.abs(l.x) < 20) { l.x = 0; document.getElementById('vg').style.display='block'; } else { document.getElementById('vg').style.display='none'; }
                if (Math.abs(l.y) < 20) { l.y = 0; document.getElementById('hg').style.display='block'; } else { document.getElementById('hg').style.display='none'; }
                
                sx = mp.clientX;
                sy = mp.clientY;
            }
            this.CLIPQON_render();
        };
        const end = () => { 
            try {
                document.getElementById('vg').style.display='none';
                document.getElementById('hg').style.display='none';
            } finally {
                window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', move);
                window.removeEventListener(isTouch ? 'touchend' : 'mouseup', end); 
            }
        };
        window.addEventListener(isTouch ? 'touchmove' : 'mousemove', move, { passive: false });
        window.addEventListener(isTouch ? 'touchend' : 'mouseup', end);
    }
    
    CLIPQON_updatePlayheadPosition() {
        const currentPoint = this.CLIPQON_getCurrentPoint();
        const timeInSeconds = this.CLIPQON_pointsToSeconds(currentPoint);
        this.state.currentTime = timeInSeconds;

        this.mediaLayers.forEach(l => {
            if(l.element && l.type === 'Video' && !this.state.playing && !l.element.seeking && currentPoint >= l.startPoint && currentPoint <= l.endPoint) {
                let targetTime = this.CLIPQON_pointsToSeconds(currentPoint - l.startPoint) * (l.speed || 1.0);
                if (Math.abs(l.element.currentTime - targetTime) > 0.08) {
                    l.element.currentTime = targetTime;
                }
            }
            if (l.type === 'Audio' && !this.state.playing && l.cachedPeaks) {
                if (currentPoint >= l.startPoint && currentPoint <= l.endPoint) {
                    if(l.element && !l.element.seeking) {
                        let targetTime = (this.CLIPQON_pointsToSeconds(currentPoint - l.startPoint) * (l.speed || 1.0)) + this.CLIPQON_pointsToSeconds(l.audioOffsetPoints || 0);
                        if (Math.abs(l.element.currentTime - targetTime) > 0.08) {
                            l.element.currentTime = targetTime;
                        }
                    }
                }
            }
            
            // રિયલ-ટાઇમ વોલ્યુમ કી-ફ્રેમ અપડેટ
            if (l.audioKeyframes && l.audioKeyframes.length > 0 && l.element) {
                const activeKf = l.audioKeyframes.slice().reverse().find(kf => kf.time <= timeInSeconds) || l.audioKeyframes[0];
                if (activeKf) {
                    let newVol = Math.max(0, Math.min(1.0, activeKf.value / 100));
                    if(Math.abs(l.element.volume - newVol) > 0.05) {
                        l.element.volume = newVol;
                    }
                }
            }
        });
        
        const hrs = Math.floor(timeInSeconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((timeInSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
        const ms = Math.floor((timeInSeconds % 1) * 100).toString().padStart(2, '0'); 
        
        document.getElementById('time-display').innerText = `${hrs}:${mins}:${secs}:${ms}`;
    }

    CLIPQON_drawRuler(tempStartPoint = null, tempEndPoint = null) {
        const ctx = this.rulerCtx;
        const vw = this.scrollArea.clientWidth; 
        const sx = this.scrollArea.scrollLeft; 
        const off = vw / 2; 

        this.rulerCanvas.width = vw; 
        this.rulerCanvas.height = 45;
        ctx.clearRect(0, 0, vw, 45);
        
        const activePointIndex = this.CLIPQON_getCurrentPoint();
        
        ctx.save(); 
        ctx.translate(-sx + off, 0); 

        ctx.beginPath();
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1;
        ctx.moveTo(0, 44); 
        ctx.lineTo(this.TOTAL_POINTS * this.POINT_WIDTH, 44);
        ctx.stroke();

        let startP = Math.max(0, Math.floor((sx - off) / this.POINT_WIDTH));
        let endP = Math.min(this.TOTAL_POINTS, Math.ceil((sx + vw - off) / this.POINT_WIDTH));
        for (let i = startP; i <= endP; i++) {
            let x = i * this.POINT_WIDTH;
            let isMainTick = (i % this.state.currentFps === 0); 
            let isHalfTick = (i % Math.round(this.state.currentFps / 2) === 0); 
            
            ctx.beginPath();
            if (i === activePointIndex) { ctx.strokeStyle = "#ff3b30"; ctx.lineWidth = 2; ctx.moveTo(x, 22); ctx.lineTo(x, 45); } 
            else if (isMainTick) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.moveTo(x, 26); ctx.lineTo(x, 45); } 
            else if (isHalfTick) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.moveTo(x, 32); ctx.lineTo(x, 45); }
            else { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.moveTo(x, 38); ctx.lineTo(x, 45); }
            ctx.stroke();
            
            if (isMainTick && i !== activePointIndex) {
                ctx.fillStyle = "#eeeeee";
                ctx.font = "bold 10px -apple-system, sans-serif"; ctx.textAlign = "center";
                ctx.fillText((i / this.state.currentFps).toString() + "s", x, 18);
            }
        }
        
        if(tempStartPoint !== null) {
            ctx.fillStyle = "rgba(0, 210, 255, 0.12)";
            ctx.fillRect(tempStartPoint * this.POINT_WIDTH, 0, (tempEndPoint - tempStartPoint) * this.POINT_WIDTH, 45);
            ctx.fillStyle = "rgba(0, 210, 255, 0.8)";
            ctx.fillRect(tempStartPoint * this.POINT_WIDTH, 0, 1.5, 45);
            ctx.fillRect(tempEndPoint * this.POINT_WIDTH, 0, 1.5, 45);
        }
        ctx.restore();
    }

    CLIPQON_closeMenus() { 
        document.getElementById('ratio-menu').style.display = 'none';
        document.getElementById('res-menu').style.display = 'none'; 
        document.getElementById('fps-menu').style.display = 'none'; 
    }
    
    CLIPQON_loadFile(e, mode) {
        const f = e.target.files[0];
        if (!f) return;
        this.CLIPQON_saveState(); // સેવ સ્ટેટ 
        
        const url = URL.createObjectURL(f);
        const type = f.type;
        const isVid = type.startsWith('video');
        const isGif = type.includes('gif');
        const setup = (w, h, durInSeconds) => {
            let durPoints = this.CLIPQON_secondsToPoints(durInSeconds || 5);
            let startPoint = this.CLIPQON_getCurrentPoint();
            let track = this.CLIPQON_findFreeTrack(startPoint, startPoint + durPoints, mode === 'main' ? 0 : 1);
            if (mode === 'main' && this.mediaLayers.filter(l => l.track === 0).length === 0) {
                this.state.mediaWidth = w;
                this.state.mediaHeight = h; this.currentRenderRatio = w / h; 
            }
            
            const l = { 
                id: Date.now() + Math.random(), name: f.name, startPoint: startPoint, endPoint: startPoint + durPoints, 
                track: track, url: url, 
                type: isVid ? 'Video' : (isGif ? 'GIF' : 'Image'), 
                visible: true, hasVisual: true, x: 0, y: 0, scale: 1, rotation: 0, volume: 1.0, speed: 1.0, uiVolume: 100,
                origW: w, origH: h, element: isVid ? document.createElement('video') : new Image(),
                audioKeyframes: [] 
            };
            if (isVid) { 
                l.element.src = url;
                l.element.muted = true; l.element.setAttribute('playsinline', ''); l.element.preload = 'auto';
                l.element.onloadedmetadata = () => { if (mode === 'main' && this.state.ratio === 'original') this.CLIPQON_applyOriginalRatio();
                this.CLIPQON_updateTimelineBounds(); this.CLIPQON_refresh(); };
            } else {
                l.element.src = url;
                l.element.onload = () => { if (mode === 'main' && this.state.ratio === 'original') this.CLIPQON_applyOriginalRatio(); this.CLIPQON_updateTimelineBounds(); this.CLIPQON_refresh(); };
            }
            
            this.mediaLayers.push(l);
            this.state.selectedLayerIndex = this.mediaLayers.length - 1;
            this.CLIPQON_updateTimelineBounds(); this.CLIPQON_refresh(); 
        };

        if (isVid) {
            const v = document.createElement('video');
            v.src = url; v.preload = 'auto';
            v.onloadedmetadata = () => setup(v.videoWidth || 1280, v.videoHeight || 720, v.duration || 5);
            v.onerror = () => setup(1280, 720, 5);
        } else {
            const img = new Image();
            img.src = url;
            img.onload = () => setup(img.naturalWidth || img.width, img.naturalHeight || img.height, 4);
            img.onerror = () => setup(1280, 720, 4);
        }
        e.target.value = '';
    }

    async CLIPQON_extractAudioPeaks(audioFile) {
        const TARGET_POINTS = 5000;
        const cacheKey = `clipqon_peaks_${audioFile.name}_${audioFile.size}`;

        const cachedPeaks = localStorage.getItem(cacheKey);
        if (cachedPeaks) {
            return { peaks: JSON.parse(cachedPeaks), duration: parseFloat(localStorage.getItem(cacheKey + '_dur') || 5) };
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
                    
                    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                    const duration = audioBuffer.duration;
                    const rawData = audioBuffer.getChannelData(0); 
                    const totalSamples = rawData.length;
                    
                    const step = Math.floor(totalSamples / TARGET_POINTS);
                    const peaks = new Float32Array(TARGET_POINTS);
                    
                    for (let i = 0; i < TARGET_POINTS; i++) {
                        let start = i * step;
                        let end = start + step;
                        let max = 0;
                        for (let j = start; j < end; j++) { if (rawData[j] > max) max = rawData[j]; }
                        peaks[i] = parseFloat(max.toFixed(4));
                    }

                    const peaksArray = Array.from(peaks);
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(peaksArray));
                        localStorage.setItem(cacheKey + '_dur', duration);
                    } catch (cacheError) { console.warn("⚠️ LocalStorage is full."); }
                    resolve({ peaks: peaksArray, duration: duration });
                } catch (error) { reject("Error decoding audio: " + error); }
            };
            reader.onerror = (err) => reject("File read error: " + err);
            reader.readAsArrayBuffer(audioFile);
        });
    }

    CLIPQON_loadAudio(e) {
        const f = e.target.files[0];
        if (!f) return;
        this.CLIPQON_saveState(); 
        this.CLIPQON_showNotification("Extracting Audio Peaks...");
        
        this.CLIPQON_extractAudioPeaks(f).then((result) => {
            const startPoint = this.CLIPQON_getCurrentPoint();
            const durPoints = this.CLIPQON_secondsToPoints(result.duration || 5);
            const track = this.CLIPQON_findFreeTrack(startPoint, startPoint + durPoints, 2); 
            
            const url = URL.createObjectURL(f); 
            const a = new Audio(url);
            a.preload = 'auto';

            this.mediaLayers.push({ 
                id: Date.now() + Math.random(), name: f.name, url: url, type: 'Audio', startPoint: startPoint, endPoint: startPoint + durPoints, 
                track: track, visible: true, hasVisual: false, volume: 1.0, uiVolume: 100, speed: 1.0, fadeInPoints: 0, fadeOutPoints: 0, element: a,
                audioDuration: result.duration, cachedPeaks: result.peaks, audioOffsetPoints: 0, audioKeyframes: [] 
            });
            this.CLIPQON_updateTimelineBounds(); 
            this.CLIPQON_refresh();
            this.CLIPQON_showNotification("Audio Loaded!");
        }).catch(() => this.CLIPQON_showNotification("Error processing audio"));
        e.target.value = '';
    }

    CLIPQON_adjustSpeed() {
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        if (!l || (l.type !== 'Video' && l.type !== 'Audio')) { this.CLIPQON_showNotification("Select Media layer"); return; }
        
        let userSpeed = prompt("Set Speed (0.5x to 3.0x):", l.speed || "1.0");
        if (userSpeed !== null && !isNaN(userSpeed)) {
            this.CLIPQON_saveState();
            let speed = Math.max(0.5, Math.min(3.0, parseFloat(userSpeed)));
            let originalDurationPoints = (l.endPoint - l.startPoint) * (l.speed || 1.0);
            
            l.speed = speed;
            l.endPoint = l.startPoint + Math.round(originalDurationPoints / speed);
            if(l.element) { l.element.playbackRate = speed; }
            
            this.CLIPQON_updateTimelineBounds();
            this.CLIPQON_refresh();
            this.CLIPQON_showNotification(`Speed set to ${speed}x`);
        }
    }

    CLIPQON_adjustFade() {
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        if (!l || l.type !== 'Audio') { this.CLIPQON_showNotification("Select Audio layer"); return; }
        
        let fi = prompt("Fade In Duration (Seconds):", this.CLIPQON_pointsToSeconds(l.fadeInPoints || 0));
        let fo = prompt("Fade Out Duration (Seconds):", this.CLIPQON_pointsToSeconds(l.fadeOutPoints || 0));
        
        if (fi !== null && !isNaN(fi)) { this.CLIPQON_saveState(); l.fadeInPoints = this.CLIPQON_secondsToPoints(parseFloat(fi)); }
        if (fo !== null && !isNaN(fo)) { this.CLIPQON_saveState(); l.fadeOutPoints = this.CLIPQON_secondsToPoints(parseFloat(fo)); }
        
        this.CLIPQON_RenderLayers();
        this.CLIPQON_showNotification("Fade parameters updated!");
    }

    CLIPQON_startRecord() {
        if (!window.MediaRecorder || !navigator.mediaDevices) { this.CLIPQON_showNotification("Microphone access not supported."); return; }
        if (this.CLIPQON_mediaRecorder && this.CLIPQON_mediaRecorder.state === "recording") { this.CLIPQON_mediaRecorder.stop(); this.CLIPQON_showNotification("Recording stopped."); return; }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            this.CLIPQON_saveState();
            this.CLIPQON_mediaRecorder = new MediaRecorder(stream);
            this.CLIPQON_audioChunks = [];
            this.CLIPQON_mediaRecorder.ondataavailable = e => this.CLIPQON_audioChunks.push(e.data);
            this.CLIPQON_mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const audioBlob = new Blob(this.CLIPQON_audioChunks, { type: 'audio/wav' });
                const file = new File([audioBlob], "Voice_Record.wav", { type: "audio/wav" });
                
                this.CLIPQON_extractAudioPeaks(file).then((result) => {
                    const startPoint = this.CLIPQON_getCurrentPoint();
                    const durPoints = this.CLIPQON_secondsToPoints(result.duration);
                    const track = this.CLIPQON_findFreeTrack(startPoint, startPoint + durPoints, 2);
                    const url = URL.createObjectURL(file);
                    this.mediaLayers.push({
                        id: Date.now(), name: "Voice Record", url: url, type: 'Audio', startPoint: startPoint, endPoint: startPoint + durPoints, track: track,
                        visible: true, hasVisual: false, volume: 1.0, uiVolume: 100, speed: 1.0, fadeInPoints: 0, fadeOutPoints: 0, element: new Audio(url),
                        audioDuration: result.duration, cachedPeaks: result.peaks, audioOffsetPoints: 0, audioKeyframes: []
                    });
                    this.CLIPQON_updateTimelineBounds();
                    this.CLIPQON_refresh();
                });
            };
            this.CLIPQON_mediaRecorder.start();
            this.CLIPQON_showNotification("🎙️ Recording... Tap Record again to Stop.");
        }).catch(() => this.CLIPQON_showNotification("Microphone access denied."));
    }

    CLIPQON_addTextLayer() {
        let userText = prompt("Enter text:", "CLIPQON");
        if (!userText) return;
        
        this.CLIPQON_saveState();
        const startPoint = this.CLIPQON_getCurrentPoint();
        const durPoints = this.CLIPQON_secondsToPoints(3); 
        const track = this.CLIPQON_findFreeTrack(startPoint, startPoint + durPoints, 1);
        this.mediaLayers.push({
            id: Date.now(), name: `Text: ${userText}`, type: 'Text', textValue: userText, startPoint: startPoint, endPoint: startPoint + durPoints, track: track,
            visible: true, hasVisual: true, x: 0, y: 0, scale: 2.5, rotation: 0, color: '#ffffff'
        });
        this.state.selectedLayerIndex = this.mediaLayers.length - 1;
        this.CLIPQON_updateTimelineBounds(); this.CLIPQON_refresh();
        this.CLIPQON_showNotification("Text Added");
    }

    CLIPQON_applyFX() {
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        if (!l || !l.hasVisual) { this.CLIPQON_showNotification("Select a layer first"); return; }
        this.CLIPQON_saveState();
        l.filter = l.filter === 'grayscale(100%)' ? 'none' : 'grayscale(100%)';
        this.CLIPQON_render();
        this.CLIPQON_showNotification(l.filter === 'none' ? "FX Removed" : "B&W Applied");
    }

    CLIPQON_aiExpand() {
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        if (!l || !l.hasVisual) { this.CLIPQON_showNotification("Select asset to expand"); return; }
        this.CLIPQON_showNotification("Connecting to CLIPQON AI Outpainting...");
    }

    CLIPQON_updateTimelineBounds() {
        let maxEndPoint = this.state.currentFps * 0;
        if (this.mediaLayers.length > 0) { maxEndPoint = Math.max(...this.mediaLayers.map(l => l.endPoint)); }
        this.TOTAL_POINTS = Math.max(300, maxEndPoint);
        const halfScreen = this.scrollArea.clientWidth / 2;
        const contentWidth = this.TOTAL_POINTS * this.POINT_WIDTH; 
        const area = document.getElementById('layers-area');
        if (area) { 
            area.style.paddingLeft = `${halfScreen}px`;
            area.style.paddingRight = `${halfScreen}px`;
            area.style.width = `${contentWidth + (halfScreen * 2)}px`;
        }
        this.CLIPQON_RenderLayers();
    }

    CLIPQON_render() {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.gifOverlay) this.gifOverlay.style.display = 'none';
        
        const nowPoint = this.CLIPQON_getCurrentPoint();
        const sortedLayers = [...this.mediaLayers].sort((a, b) => a.track - b.track);
        sortedLayers.forEach((l) => {
            const originalIndex = this.mediaLayers.indexOf(l);
            if (!l.visible || !l.hasVisual || nowPoint < l.startPoint || nowPoint > l.endPoint) return;
            
            this.ctx.save();
            if (l.filter) this.ctx.filter = l.filter; 

            const w = l.origW || this.state.mediaWidth; 
            const h = l.origH || this.state.mediaHeight;
            const scaleX = this.canvas.width / w, scaleY = this.canvas.height / h;
            const autoFit = Math.min(scaleX, scaleY);
            
            const vw = w * autoFit * (l.scale || 1), vh = h * autoFit * (l.scale || 1);
            const tx = this.canvas.width / 2 + (l.x || 0), ty = this.canvas.height / 2 + (l.y || 0);
            
            if (l.type === 'Text') {
                this.ctx.translate(tx, ty); this.ctx.rotate((l.rotation || 0) * Math.PI / 180);
                this.ctx.font = `bold ${30 * (l.scale || 1)}px -apple-system, sans-serif`;
                this.ctx.fillStyle = l.color || "#fff";
                this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
                this.ctx.fillText(l.textValue, 0, 0);
                if (this.state.selectedLayerIndex === originalIndex) { 
                    let metrics = this.ctx.measureText(l.textValue);
                    let textW = metrics.width + 20, textH = (30 * (l.scale || 1)) + 20;
                    this.ctx.strokeStyle = "rgba(0, 210, 255, 0.8)"; this.ctx.lineWidth = 2; 
                    this.ctx.strokeRect(-textW/2, -textH/2, textW, textH);
                }
            } 
            else if (l.type === 'GIF') { 
                this.gifOverlay.src = l.url;
                this.gifOverlay.style.display = 'block';
                const rect = this.canvas.getBoundingClientRect(), boxRect = this.box.getBoundingClientRect();
                const sX = rect.width / this.canvas.width, sY = rect.height / this.canvas.height;
                this.gifOverlay.style.cssText = `display: block; position: absolute; pointer-events: none;
                width: ${vw * sX}px; height: ${vh * sY}px; left: ${(tx * sX) + (rect.left - boxRect.left)}px;
                top: ${(ty * sY) + (rect.top - boxRect.top)}px; transform: translate(-50%, -50%) rotate(${l.rotation || 0}deg); z-index: 5;`;
            } else if (l.element) { 
                this.ctx.translate(tx, ty);
                this.ctx.rotate((l.rotation || 0) * Math.PI / 180);
                
                if (l.type === 'Video' && !this.state.playing && !l.element.seeking) { 
                    const mediaTime = (nowPoint - l.startPoint) / this.state.currentFps;
                    let targetTime = mediaTime * l.speed;
                    if(Math.abs(l.element.currentTime - targetTime) > 0.08){ l.element.currentTime = targetTime; }
                }
                try { this.ctx.drawImage(l.element, -vw/2, -vh/2, vw, vh); } catch(e){}
                
                if (this.state.selectedLayerIndex === originalIndex) { 
                    this.ctx.strokeStyle = "rgba(0, 210, 255, 0.8)";
                    this.ctx.lineWidth = 3; 
                    this.ctx.strokeRect(-vw/2, -vh/2, vw, vh); 
                }
            }
            this.ctx.restore();
        });
    }

       CLIPQON_RenderLayers() {
        const area = document.getElementById('layers-area');
        const leftPanel = document.getElementById('fixed-left-panel');
        if (!area || !leftPanel) return; 
        
        const corner = leftPanel.querySelector('.ruler-corner-block');
        const leftFrag = document.createDocumentFragment();
        if(corner) leftFrag.appendChild(corner);
        const rightFrag = document.createDocumentFragment();
        let maxTrack = this.mediaLayers.length > 0 ? Math.max(2, ...this.mediaLayers.map(l => l.track)) : 2;
        for(let t = 0; t <= maxTrack; t++) {
            const trackLayers = this.mediaLayers.filter(l => l.track === t);
            const isVisible = trackLayers.length > 0 ? trackLayers[0].visible : true;
            
            const controlRow = document.createElement('div'); controlRow.className = 'track-control-row';
            const eyeRow = document.createElement('div'); eyeRow.className = 'track-eye-panel-row';
            eyeRow.innerHTML = isVisible ? '👁️' : '🕶️';
            eyeRow.addEventListener('click', (e) => {
                e.stopPropagation(); 
                if (!trackLayers.length) return;
                const newState = !(trackLayers[0]?.visible ?? true);
                this.mediaLayers.forEach(l => { if(l.track === t) l.visible = newState; });
                eyeRow.innerHTML = newState ? '👁️' : '🕶️'; 
                this.CLIPQON_render();
            });
            controlRow.appendChild(eyeRow); leftFrag.appendChild(controlRow);

            const row = document.createElement('div'); row.className = 'track-row-container';
            const wrap = document.createElement('div'); wrap.className = 'clips-wrapper';
            trackLayers.forEach((l) => {
                const originalIndex = this.mediaLayers.indexOf(l);
                const isSel = (this.state.selectedLayerIndex === originalIndex);
                
                let clipClass = 'overlay-clip';
                if (t === 0) clipClass = 'main-clip';
                if (l.type === 'Text') clipClass = 'text-clip';
                if (l.type === 'Audio') clipClass = 'audio-clip';

                const clip = document.createElement('div'); 
                clip.className = `track-clip ${clipClass} ${isSel ? 'selected' : ''}`;
                
                const pointDuration = l.endPoint - l.startPoint;
                const clipWidth = Math.max(pointDuration * this.POINT_WIDTH, this.POINT_WIDTH * this.MIN_LAYER_POINTS);
                clip.style.left = `${l.startPoint * this.POINT_WIDTH}px`; 
                clip.style.width = `${clipWidth}px`;

                let thumbEmoji = l.type === 'Audio' ? '🎵' : (l.type === 'Video' ? '🎬' : (l.type === 'Text' ? 'T' : '🖼️'));
                let innerStyle = clipWidth < 45 ? 'style="display:none;"' : '';
                const waveformId = `waveform-${l.id.toString().replace('.','')}`;
                const durationInSeconds = (pointDuration / this.state.currentFps).toFixed(1);
                
                clip.innerHTML = `
                    <div class="trim-handle left-handle"></div>
                    ${l.type === 'Audio' ? `<div id="${waveformId}" class="waveform-container"></div>` : ''}
                    <div class="clip-thumb" ${innerStyle}>${thumbEmoji}</div>
                    <div class="clip-info" ${innerStyle}>
                        <span class="clip-name">${l.name ? l.name.split('.')[0] : 'Layer'}</span>
                        <span class="clip-duration">${durationInSeconds}s</span>
                    </div>
                    <div class="trim-handle right-handle"></div>
                `;
                const lh = clip.querySelector('.left-handle'); const rh = clip.querySelector('.right-handle');
                lh.addEventListener('mousedown', (e) => this.CLIPQON_initResize(e, originalIndex, 'left'));
                lh.addEventListener('touchstart', (e) => this.CLIPQON_initResize(e, originalIndex, 'left'));
                rh.addEventListener('mousedown', (e) => this.CLIPQON_initResize(e, originalIndex, 'right'));
                rh.addEventListener('touchstart', (e) => this.CLIPQON_initResize(e, originalIndex, 'right'));
                
                let startX = 0, startY = 0;
                let hasMovedFar = false;
                const handlePointerDown = (e) => {
                    if (e.target.classList.contains('trim-handle')) return;
                    const pointer = e.type.includes('touch') ? e.touches[0] : e;
                    startX = pointer.clientX; startY = pointer.clientY;
                    if (this.state.selectedLayerIndex === originalIndex) { this.CLIPQON_initLayerDrag(e, originalIndex, clip); }
                };
                const handlePointerMove = (e) => {
                    if (this.state.selectedLayerIndex === originalIndex) return;
                    if (startX === 0 && startY === 0) return;
                    const pointer = e.type.includes('touch') ? e.touches[0] : e;
                    if (Math.abs(pointer.clientX - startX) > 8 || Math.abs(pointer.clientY - startY) > 8) { hasMovedFar = true; }
                };
                const handlePointerUp = (e) => {
                    if (e.target.classList.contains('trim-handle')) return;
                    if (this.state.selectedLayerIndex !== originalIndex && !hasMovedFar) {
                        this.state.selectedLayerIndex = originalIndex;
                        document.querySelectorAll('.track-clip').forEach(c => c.classList.remove('selected'));
                        clip.classList.add('selected'); this.CLIPQON_render();
                    }
                    startX = 0;
                    startY = 0;
                };

                clip.addEventListener('mousedown', handlePointerDown); clip.addEventListener('touchstart', handlePointerDown);
                clip.addEventListener('mousemove', handlePointerMove); clip.addEventListener('touchmove', handlePointerMove);
                clip.addEventListener('mouseup', handlePointerUp); clip.addEventListener('touchend', handlePointerUp);

                wrap.appendChild(clip);
                if (l.type === 'Audio' && l.cachedPeaks) {
                    setTimeout(() => {
                        const container = document.getElementById(waveformId);
                        if (!container) return;
                        container.innerHTML = ''; 
                        const cvs = document.createElement('canvas');
                        cvs.width = clipWidth; cvs.height = 32;
                        container.appendChild(cvs);
                        const cctx = cvs.getContext('2d');
                        const peaks = l.cachedPeaks;
                        const speed = l.speed || 1.0;
                        const actualDuration = l.audioDuration || 5;
                        const totalAudioPoints = this.CLIPQON_secondsToPoints(actualDuration);
                        const safeTotalPoints = totalAudioPoints || 1;
                        const startSample = Math.floor(((l.audioOffsetPoints || 0) / safeTotalPoints) * peaks.length);
                        const currentClipDurationInPoints = pointDuration * speed;
                        const endSample = Math.floor((((l.audioOffsetPoints || 0) + currentClipDurationInPoints) / safeTotalPoints) * peaks.length);
                        const step = Math.max(1, Math.ceil((endSample - startSample) / clipWidth));
                        
                        setTimeout(() => {
                            const container = document.getElementById(waveformId);
                            if (!container) return;
                            const cvs = document.createElement('canvas');
                            cvs.width = clipWidth;
                            cvs.height = 24; 
                            container.innerHTML = ''; 
                            container.appendChild(cvs);
                            
                            const cctx = cvs.getContext('2d');
                            const centerY = 12; 
                            const padding = 2;  
                            const maxWaveHeight = 24 - (padding * 2); 
                            const scale = maxWaveHeight / 2; 

                            const peaks = l.cachedPeaks;
                            const step = Math.max(1, Math.ceil(peaks.length / clipWidth));
                            
                            const gradient = cctx.createLinearGradient(0, 0, 0, 24);
                            gradient.addColorStop(0, '#00d2ff');
                            gradient.addColorStop(1, '#0070f3');

                            cctx.strokeStyle = gradient;
                            cctx.fillStyle = gradient;
                            cctx.lineWidth = 1;
                            cctx.lineJoin = 'round';
                            cctx.globalAlpha = 0.8;

                            const topPoints = [];
                            const bottomPoints = [];
                            for (let x = 0; x < clipWidth; x++) {
                                let min = 1.0;
                                let max = -1.0;
                                for (let j = 0; j < step; j++) {
                                    const idx = (x * step) + j;
                                    if (idx >= peaks.length) break;
                                    if (peaks[idx] < min) min = peaks[idx];
                                    if (peaks[idx] > max) max = peaks[idx];
                                }
                                let amplitude = (max - min) * (l.volume || 1);
                                if (amplitude < 0.05) amplitude = 0.05;
                                topPoints.push({ x: x, y: centerY - (amplitude * scale) });
                                bottomPoints.push({ x: x, y: centerY + (amplitude * scale) });
                            }

                            cctx.beginPath();
                            cctx.moveTo(topPoints[0].x, topPoints[0].y);
                            for (let i = 1; i < topPoints.length; i++) cctx.lineTo(topPoints[i].x, topPoints[i].y);
                            for (let i = bottomPoints.length - 1; i >= 0; i--) cctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
                            cctx.closePath();
                            
                            cctx.fill();
                            cctx.stroke();
                        }, 0);
                    }, 0);
                }
            });
            row.appendChild(wrap); rightFrag.appendChild(row);
        }
        leftPanel.innerHTML = ''; leftPanel.appendChild(leftFrag);
        area.innerHTML = ''; area.appendChild(rightFrag);
    }
    
    CLIPQON_isSpaceFree(track, startP, endP, excludeIndex = -1) {
        for (let i = 0; i < this.mediaLayers.length; i++) {
            if (i === excludeIndex) continue;
            let l = this.mediaLayers[i];
            if (l.track === track) { if (startP < l.endPoint && endP > l.startPoint) return false; }
        }
        return true;
    }

    CLIPQON_findFreeTrack(startP, endP, preferredTrack = 0, excludeIndex = -1) {
        let track = preferredTrack;
        while (true) { if (this.CLIPQON_isSpaceFree(track, startP, endP, excludeIndex)) return track; track++; }
    }

    CLIPQON_initLayerDrag(e, index, clipElement) {
        e.stopPropagation();
        if (this.state.selectedLayerIndex !== index) return; 
        const isTouch = e.type.includes('touch');
        const pointer = isTouch ? e.touches[0] : e;
        const layer = this.mediaLayers[index];
        const scrollContainer = this.scrollArea;
        const layersArea = document.getElementById('layers-area'); 
        
        clipElement.classList.add('dragging');
        let magLine = document.querySelector('.magnetic-line') || document.createElement('div');
        magLine.className = 'magnetic-line'; layersArea.appendChild(magLine);

        const durationPoints = layer.endPoint - layer.startPoint;
        const originalTrack = layer.track;
        const containerRect = scrollContainer.getBoundingClientRect();
        const halfScreen = scrollContainer.clientWidth / 2; 

        let currentPointerX = pointer.clientX; let currentPointerY = pointer.clientY;
        let initialPointerX = pointer.clientX;
        let initialPointerY = pointer.clientY;
        let initialScrollLeft = scrollContainer.scrollLeft;
        let tempStartPoint = layer.startPoint; let autoScrollAnimId = null;
        
        const updateDragPosition = () => {
            let totalDeltaX = (currentPointerX - initialPointerX) + (scrollContainer.scrollLeft - initialScrollLeft);
            let deltaPoint = Math.round(totalDeltaX / this.POINT_WIDTH);
            let trackShift = Math.round((currentPointerY - initialPointerY) / 40);

            tempStartPoint = Math.max(0, layer.startPoint + deltaPoint);
            let tempTrack = Math.max(0, originalTrack + trackShift);

            clipElement.style.left = `${tempStartPoint * this.POINT_WIDTH}px`;
            clipElement.style.transform = `translate(0px, ${trackShift * 40}px)`;
            let canFit = this.CLIPQON_isSpaceFree(tempTrack, tempStartPoint, tempStartPoint + durationPoints, index);
            magLine.style.display = 'block'; magLine.style.left = `${(tempStartPoint * this.POINT_WIDTH) + halfScreen}px`;
            magLine.style.background = canFit ? "#00d2ff" : "#ff3b30";
            this.CLIPQON_drawRuler(tempStartPoint, tempStartPoint + durationPoints);
        };
        const checkAndAutoScroll = () => {
            let amt = 0;
            if (currentPointerX > containerRect.right - 50) amt = 8;
            else if (currentPointerX < containerRect.left + 50) amt = -8;
            if (amt !== 0) { scrollContainer.scrollLeft += amt; updateDragPosition(); }
            autoScrollAnimId = requestAnimationFrame(checkAndAutoScroll);
        };
        autoScrollAnimId = requestAnimationFrame(checkAndAutoScroll);
        
        const onMove = (me) => { const p = isTouch ? me.touches[0] : me;
        currentPointerX = p.clientX; currentPointerY = p.clientY; updateDragPosition(); };
        const onEnd = () => {
            try {
                this.CLIPQON_saveState(); // Move કરતા પહેલા સેવ
                cancelAnimationFrame(autoScrollAnimId);
                clipElement.classList.remove('dragging'); clipElement.style.transform = ''; magLine.style.display = 'none';
                let totalDeltaX = (currentPointerX - initialPointerX) + (scrollContainer.scrollLeft - initialScrollLeft);
                let targetStart = Math.max(0, layer.startPoint + Math.round(totalDeltaX / this.POINT_WIDTH));
                let targetTrack = Math.max(0, originalTrack + Math.round((currentPointerY - initialPointerY) / 40));
                if (!this.CLIPQON_isSpaceFree(targetTrack, targetStart, targetStart + durationPoints, index)) { 
                    targetTrack = this.CLIPQON_findFreeTrack(targetStart, targetStart + durationPoints, targetTrack, index);
                }
                layer.startPoint = targetStart;
                layer.endPoint = targetStart + durationPoints; layer.track = targetTrack;
                this.CLIPQON_updateTimelineBounds(); this.CLIPQON_render(); this.CLIPQON_drawRuler();
            } finally {
                window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
                window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
            }
        };
        window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: false }); window.addEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
    }

    CLIPQON_initTimelineBlankScroll() {
        const scrollContainer = this.scrollArea;
        let isDown = false; let startX; let scrollLeft;

        const startScroll = (e) => {
            if (e.target.closest('.ruler-corner-block') || e.target.closest('.track-control-row') || e.target.closest('.track-clip')) return;
            isDown = true; const pointer = e.type.includes('touch') ? e.touches[0] : e;
            startX = pointer.clientX; scrollLeft = scrollContainer.scrollLeft;
        };
        const moveScroll = (e) => {
            if (!isDown) return;
            const pointer = e.type.includes('touch') ? e.touches[0] : e;
            scrollContainer.scrollLeft = scrollLeft - (pointer.clientX - startX);
        };
        scrollContainer.addEventListener('mousedown', startScroll); scrollContainer.addEventListener('mousemove', moveScroll);
        window.addEventListener('mouseup', () => isDown = false);
        scrollContainer.addEventListener('touchstart', startScroll, { passive: true }); scrollContainer.addEventListener('touchmove', moveScroll, { passive: false });
        window.addEventListener('touchend', () => isDown = false);
    }

    CLIPQON_initResize(e, index, side) {
        e.stopPropagation();
        this.CLIPQON_saveState();
        const isTouch = e.type.includes('touch');
        const pointer = isTouch ? e.touches[0] : e;
        const layer = this.mediaLayers[index]; const el = document.querySelectorAll('.track-clip')[index];
        const startX = pointer.clientX; const initialStartPoint = layer.startPoint; const initialEndPoint = layer.endPoint;
        const layersOnSameTrack = this.mediaLayers.filter((l, i) => i !== index && l.track === layer.track);
        const prevLimit = layersOnSameTrack.filter(l => l.endPoint <= layer.startPoint).sort((a, b) => b.endPoint - a.endPoint)[0]?.endPoint || 0;
        const nextLimit = layersOnSameTrack.filter(l => l.startPoint >= layer.endPoint).sort((a, b) => a.startPoint - b.startPoint)[0]?.startPoint || Infinity;

        el.classList.add('resizing-active');
        const onMove = (me) => {
            const mPointer = isTouch ? me.touches[0] : me;
            let deltaPoint = Math.round((mPointer.clientX - startX) / this.POINT_WIDTH);
            if (side === 'right') {
                let ep = Math.max(layer.startPoint + this.MIN_LAYER_POINTS, Math.min(initialEndPoint + deltaPoint, nextLimit));
                el.style.width = ((ep - layer.startPoint) * this.POINT_WIDTH) + 'px'; layer.endPoint = ep;
            } else {
                let sp = Math.max(prevLimit, Math.min(initialStartPoint + deltaPoint, layer.endPoint - this.MIN_LAYER_POINTS));
                el.style.left = (sp * this.POINT_WIDTH) + 'px'; el.style.width = ((layer.endPoint - sp) * this.POINT_WIDTH) + 'px'; layer.startPoint = sp;
            }
            this.CLIPQON_drawRuler(layer.startPoint, layer.endPoint); this.CLIPQON_render();
        };
        const onEnd = () => {
            try { el.classList.remove('resizing-active');
            this.CLIPQON_updateTimelineBounds(); } finally {
                window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
                window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
            }
        };
        window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: false }); window.addEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
    }

    CLIPQON_toggleMinimize() {
        const footer = document.getElementById('editor-footer');
        if(footer) footer.classList.toggle('minimized');
        setTimeout(() => { this.CLIPQON_drawRuler(); }, 360); 
    }

    CLIPQON_togglePlay() {
        if(this.mediaLayers.length === 0) return;
        this.state.playing = !this.state.playing;
        let playBtn = document.getElementById('btn-play');
        
        if(this.state.playing) { 
            if(playBtn) playBtn.innerHTML = '<span style="color:var(--red);">⏸</span>Pause';
            const currentPoint = this.CLIPQON_getCurrentPoint();
            this.playStartTime = performance.now() - (this.CLIPQON_pointsToSeconds(currentPoint) * 1000);
            this.mediaLayers.forEach(l => { 
                if(l.element && l.element.play) {
                    if (currentPoint >= l.startPoint && currentPoint <= l.endPoint) {
                        l.element.currentTime = (this.CLIPQON_pointsToSeconds(currentPoint - l.startPoint) * l.speed) + this.CLIPQON_pointsToSeconds(l.audioOffsetPoints || 0);
                        l.element.play().catch(()=>{});
                    }
                }
            });
            this.playAnimFrame = requestAnimationFrame(() => this.CLIPQON_playLoop()); 
        } else { 
            cancelAnimationFrame(this.playAnimFrame);
            if(playBtn) playBtn.innerHTML = '<span>▶</span>Play';
            this.mediaLayers.forEach(l => { if(l.element && l.element.pause) l.element.pause(); });
        }
    }
    
    CLIPQON_playLoop() {
        if(!this.state.playing) return;
        let now = performance.now(); 
        let elapsedSeconds = (now - this.playStartTime) / 1000;
        let targetPoint = this.CLIPQON_secondsToPoints(elapsedSeconds);
        this.scrollArea.scrollLeft = targetPoint * this.POINT_WIDTH;

        if(this.CLIPQON_getCurrentPoint() >= this.TOTAL_POINTS) { 
            this.scrollArea.scrollLeft = 0;
            this.playStartTime = performance.now();
        }
        
        this.CLIPQON_updatePlayheadPosition();
        this.CLIPQON_render(); 
        this.playAnimFrame = requestAnimationFrame(() => this.CLIPQON_playLoop());
    }
    
    CLIPQON_deleteLayer() { 
        if (this.state.selectedLayerIndex !== null) { 
            this.CLIPQON_saveState(); // ડિલીટ પહેલા સેવ
            this.mediaLayers.splice(this.state.selectedLayerIndex, 1);
            this.state.selectedLayerIndex = null; 
            this.CLIPQON_updateTimelineBounds(); this.CLIPQON_showNotification("Layer Deleted");
        } else {
            this.CLIPQON_showNotification("Select a layer to delete");
        }
    }
    
    CLIPQON_duplicateLayer() {
        if(this.state.selectedLayerIndex === null) {
            this.CLIPQON_showNotification("Select a layer to copy");
            return;
        }
        this.CLIPQON_saveState();
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        const newTrack = this.CLIPQON_findFreeTrack(l.startPoint, l.endPoint, l.track + 1);
        let dup = { ...l, id: Date.now() + Math.random(), track: newTrack, audioKeyframes: l.audioKeyframes ? [...l.audioKeyframes] : [] };
        if (l.type === 'Video' || l.type === 'Audio' || l.type === 'Image') {
            dup.element = l.type === 'Video' ? document.createElement('video') : (l.type === 'Audio' ? new Audio() : new Image());
            dup.element.src = l.url; if(l.type === 'Video') dup.element.muted = true;
        }
        this.mediaLayers.push(dup); this.CLIPQON_updateTimelineBounds(); this.CLIPQON_showNotification("Layer Copied");
    }

    CLIPQON_splitLayer() {
        const l = this.mediaLayers[this.state.selectedLayerIndex];
        const cp = this.CLIPQON_getCurrentPoint(); 
        if (l && cp > l.startPoint && cp < l.endPoint) {
            this.CLIPQON_saveState();
            const oep = l.endPoint;
            l.endPoint = cp; 
            const s = { ...l, id: Date.now() + Math.random(), startPoint: cp, endPoint: oep, audioKeyframes: l.audioKeyframes ? [...l.audioKeyframes] : [] };
            if (l.type === 'Audio') { s.audioOffsetPoints = (l.audioOffsetPoints || 0) + ((cp - l.startPoint) * l.speed); }
            if (l.type === 'Video' || l.type === 'Audio' || l.type === 'Image') {
                s.element = l.type === 'Video' ? document.createElement('video') : (l.type === 'Audio' ? new Audio() : new Image());
                s.element.src = l.url; if(l.type === 'Video') s.element.muted = true;
            }
            this.mediaLayers.push(s);
            this.state.selectedLayerIndex = this.mediaLayers.length - 1; 
            this.CLIPQON_updateTimelineBounds();
            this.CLIPQON_showNotification("Layer Split");
        } else {
             this.CLIPQON_showNotification("Select a layer and place playhead over it");
        }
    }
    
    CLIPQON_toggleOrientation() { const l = this.mediaLayers[this.state.selectedLayerIndex];
        if(l) { l.scale = 1; l.x = 0; l.y = 0; l.rotation = 0; this.CLIPQON_render(); } 
    }
    CLIPQON_bringToFront() { const l = this.mediaLayers[this.state.selectedLayerIndex]; if(l) { l.track = this.CLIPQON_findFreeTrack(l.startPoint, l.endPoint, Math.max(...this.mediaLayers.map(m=>m.track)) + 1);
        this.CLIPQON_updateTimelineBounds(); } 
    }
    CLIPQON_showNotification(m) { let t = document.createElement('div'); t.className = 'toast-notification show'; t.innerText = m; document.body.appendChild(t);
        setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 1500); 
    }
}
