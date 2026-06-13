// --- VOLUME POPUP LOGIC WITH CANVAS TICKS, SLIDER FILL, KEYFRAMES & WAVE MOTION ---

function updateSliderFill(val) {
    const slider = document.getElementById('vol-slider');
    if (!slider) return;
    const percentage = (val / 2); 
    slider.style.background = `linear-gradient(to right, #00d2ff 0%, #00d2ff ${percentage}%, #1a1a1a ${percentage}%, #1a1a1a 100%)`;
}

function drawVolumeTicksCanvas(val) {
    const container = document.getElementById('vol-ticks-container');
    if (!container) return;

    let canvas = document.getElementById('vol-ticks-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'vol-ticks-canvas';
        canvas.width = 120;
        canvas.height = 75;  
        container.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 8; 
    const radius = 45;
    const startAngle = Math.PI * 1.0;  
    const endAngle = Math.PI * 2.0;    
    const totalTicks = 200;
    
    for (let i = 0; i <= totalTicks; i++) {
        const angle = startAngle + (i / totalTicks) * (endAngle - startAngle);
        let tickLength = (i === 100) ? 10 : 4;
        let lineWidth = (i === 100) ? 1.5 : 1;
        const xStart = centerX + Math.cos(angle) * radius;
        const yStart = centerY + Math.sin(angle) * radius;
        const xEnd = centerX + Math.cos(angle) * (radius + tickLength);
        const yEnd = centerY + Math.sin(angle) * (radius + tickLength);
        
        ctx.strokeStyle = (i <= val) ? '#00d2ff' : '#222224';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
    }
}

function openVolume() {
    if(!window.editor || window.editor.state.selectedLayerIndex === null) {
        if(window.editor) window.editor.CLIPQON_showNotification("Select Audio/Video layer first");
        return;
    }
    
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    if(l.type !== 'Video' && l.type !== 'Audio') {
        window.editor.CLIPQON_showNotification("Selected layer doesn't have Volume");
        return;
    }
    
    let currentVol = l.uiVolume !== undefined ? l.uiVolume : (l.volume * 100);
    let sliderPos = 100;
    if(currentVol <= 100) {
        sliderPos = currentVol;
    } else {
        sliderPos = 100 + (currentVol - 100) / 9;
    }
    
    document.getElementById('vol-slider').value = sliderPos;
    document.getElementById('vol-display').innerText = Math.round(currentVol);
    
    document.getElementById('volume-panel').classList.add('active');
    
    drawVolumeTicksCanvas(sliderPos);
    updateSliderFill(sliderPos);
    
    const currentTime = window.editor.state.currentTime || 0;
    const hasKf = l.audioKeyframes && l.audioKeyframes.some(kf => Math.abs(kf.time - currentTime) < 0.1);
    document.getElementById('vol-kf-btn').innerText = hasKf ? "- Remove Keyframe" : "+ Add Keyframe";
    
    checkWaveButtonState();
}

function closeVolume() {
    document.getElementById('volume-panel').classList.remove('active');
}

function updateVolume(sliderVal) {
    let val = parseInt(sliderVal);
    let displayVal = 0;
    if (val <= 100) {
        displayVal = val;
    } else {
        displayVal = 100 + (val - 100) * 9;
    }
    
    document.getElementById('vol-display').innerText = Math.round(displayVal);
    
    drawVolumeTicksCanvas(val);
    updateSliderFill(val);

    if(!window.editor) return;
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    if(l) {
        l.uiVolume = displayVal;
        l.volume = Math.max(0, Math.min(1.0, displayVal / 100));
        if(l.element) {
            l.element.volume = l.volume;
            if (l.volume > 0) {
                l.element.muted = false;
            } else {
                l.element.muted = true;
            }
        }

        const currentTime = window.editor.state.currentTime || 0;
        if(l.audioKeyframes) {
            const currentKf = l.audioKeyframes.find(kf => Math.abs(kf.time - currentTime) < 0.1);
            if(currentKf) {
                currentKf.value = val;
            }
        }
    }
}

function toggleVolumeKeyframe() {
    if(!window.editor || window.editor.state.selectedLayerIndex === null) return;
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    const currentTime = window.editor.state.currentTime || 0; 
    const currentSliderVal = document.getElementById('vol-slider').value;

    if (!l.audioKeyframes) l.audioKeyframes = [];
    const existingIndex = l.audioKeyframes.findIndex(kf => Math.abs(kf.time - currentTime) < 0.1);
    const kfBtn = document.getElementById('vol-kf-btn');
    
    if (existingIndex > -1) {
        l.audioKeyframes.splice(existingIndex, 1);
        kfBtn.innerText = "+ Add Keyframe";
        kfBtn.style.borderColor = "#444";
    } else {
        l.audioKeyframes.push({
            time: currentTime,
            value: parseInt(currentSliderVal),
            motion: 'linear'
        });
        l.audioKeyframes.sort((a, b) => a.time - b.time);
        kfBtn.innerText = "- Remove Keyframe";
        kfBtn.style.borderColor = "#00d2ff";
    }
    checkWaveButtonState();
}

function checkWaveButtonState() {
    if(!window.editor || window.editor.state.selectedLayerIndex === null) return;
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    const waveBtn = document.getElementById('vol-wave-btn');
    if (l && l.audioKeyframes && l.audioKeyframes.length >= 2) {
        waveBtn.disabled = false;
        waveBtn.style.opacity = "1";
        waveBtn.style.color = "#00d2ff";
        waveBtn.style.borderColor = "#00d2ff";
    } else {
        waveBtn.disabled = true;
        waveBtn.style.opacity = "0.5";
        waveBtn.style.color = "#555";
        waveBtn.style.borderColor = "#444";
        document.getElementById('vol-wave-box').style.display = "none";
    }
}

function toggleWaveBox() {
    const waveBox = document.getElementById('vol-wave-box');
    if (waveBox.style.display === "none") {
        waveBox.style.display = "block";
        if(!window.editor || window.editor.state.selectedLayerIndex === null) return;
        const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
        const currentTime = window.editor.state.currentTime || 0;
        const currentKf = l.audioKeyframes.find(kf => kf.time <= currentTime) || l.audioKeyframes[0];
        if (currentKf && currentKf.motion) {
            const radio = document.querySelector(`input[name="wave-motion"][value="${currentKf.motion}"]`);
            if(radio) radio.checked = true;
        }
    } else {
        waveBox.style.display = "none";
    }
}

function changeVolumeMotion(motionType) {
    if(!window.editor || window.editor.state.selectedLayerIndex === null) return;
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    const currentTime = window.editor.state.currentTime || 0;

    if (l.audioKeyframes && l.audioKeyframes.length >= 2) {
        for (let i = 0; i < l.audioKeyframes.length - 1; i++) {
            if (currentTime >= l.audioKeyframes[i].time && currentTime <= l.audioKeyframes[i+1].time) {
                l.audioKeyframes[i].motion = motionType;
                break;
            }
        }
        if(window.editor.CLIPQON_showNotification) {
            window.editor.CLIPQON_showNotification(`Motion set to ${motionType}`);
        }
    }
}

// Reset Function
function resetVolume() {
    if(!window.editor || window.editor.state.selectedLayerIndex === null) return;
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    if(l) {
        l.audioKeyframes = []; 
        l.uiVolume = 100;
        l.volume = 1.0;
        if(l.element) l.element.volume = 1.0;
        
        document.getElementById('vol-slider').value = 100;
        updateVolume(100);
        checkWaveButtonState();
        document.getElementById('vol-wave-box').style.display = "none";
        
        window.editor.CLIPQON_showNotification("Volume Reset to 100%");
    }
}

// Move (Drag) Logic
document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('volume-panel');
    const handle = document.getElementById('vol-move-handle');
    let isDragging = false, startX, startY, initialX, initialY;

    if(handle && popup) {
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX; 
            startY = e.clientY;
            const rect = popup.getBoundingClientRect();
            initialX = rect.left; 
            initialY = rect.top;
            
            popup.style.bottom = 'auto'; 
            popup.style.right = 'auto';
        });
        
        document.addEventListener('mousemove', (e) => {
            if(!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            popup.style.left = (initialX + dx) + 'px';
            popup.style.top = (initialY + dy) + 'px';
        });
        
        document.addEventListener('mouseup', () => { isDragging = false; });
    }
});
