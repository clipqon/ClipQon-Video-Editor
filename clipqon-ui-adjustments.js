// --- 3. BOTTOM MENU UI & ADJUSTMENTS LOGIC ---
let currentTool = 'brightness';
let adjustSettings = { brightness: 0, contrast: 0, saturation: 0, brilliance: 0, sharpen: 0, clarity: 0, highlight: 0, shadow: 0, whites: 0, blacks: 0, temp: 0, hue: 0, fade: 0, grain: 0, volume: 100 };
let currentHSLColor = 'red';
let hslData = {
    red: {h:0, s:0, l:0}, orange: {h:0, s:0, l:0}, skin: {h:0, s:0, l:0}, yellow: {h:0, s:0, l:0}, lime: {h:0, s:0, l:0}, green: {h:0, s:0, l:0},
    teal: {h:0, s:0, l:0}, cyan: {h:0, s:0, l:0}, blue: {h:0, s:0, l:0}, indigo: {h:0, s:0, l:0}, purple: {h:0, s:0, l:0}, magenta: {h:0, s:0, l:0}
};
let currentChannel = 'white';

function openMenu(menuId) {
    document.querySelectorAll('.menu-action-bar').forEach(bar => bar.style.display = 'none');
    const target = document.getElementById(menuId);
    if(target) target.style.display = 'flex';
}

function openSliderPopup(name, min, max, defaultVal) {
    let val = prompt(`Enter ${name} (${min} to ${max}):`, defaultVal);
    if(val !== null && window.editor) window.editor.CLIPQON_showNotification(`${name} set to ${val}`);
}

function openAdjustMaster() {
    const popup = document.getElementById('adjust-master-popup');
    if(popup) popup.classList.add('active');
    selectAdjTool('Brightness', -50, 50, 'brightness');
}

function closeAdjustPopup() { 
    const popup = document.getElementById('adjust-master-popup');
    if(popup) popup.classList.remove('active'); 
}

function handleSmartTool(tool) {
    if(window.editor) window.editor.CLIPQON_showNotification(tool + " Applied");
}

function selectAdjTool(label, min, max, key) {
    currentTool = key;
    document.getElementById('master-title').innerText = label.toUpperCase();
    
    const slider = document.getElementById('master-slider');
    slider.min = min; slider.max = max; slider.value = adjustSettings[key];
    
    updateSliderDisplay(adjustSettings[key]);
    document.querySelectorAll('.adj-item').forEach(item => {
        item.classList.remove('active');
        if(item.getAttribute('data-tool') === key) { item.classList.add('active'); }
    });
}

function resetAdjustMaster() {
    if(confirm("सभी एडजस्टमेंट रीसेट करें?")) {
        Object.keys(adjustSettings).forEach(key => { adjustSettings[key] = (key === 'volume') ? 100 : 0; });
        document.getElementById('master-slider').value = 0;
        updateSliderDisplay(0);
        applyFiltersToCanvas();
    }
}

function updateAdjustValue(val) {
    adjustSettings[currentTool] = val;
    updateSliderDisplay(val);
    applyFiltersToCanvas();
}

function updateSliderDisplay(val) {
    const display = document.getElementById('master-val-display');
    display.innerText = (val > 0 ? '+' : '') + val;
}

function applyFiltersToCanvas() {
    if(!window.editor) return;
    const l = window.editor.mediaLayers[window.editor.state.selectedLayerIndex];
    if(!l || !l.hasVisual) {
        window.editor.CLIPQON_showNotification("Select a layer first to apply filter");
        return;
    }

    const b = 100 + parseInt(adjustSettings.brightness);
    const c = 100 + parseInt(adjustSettings.contrast);
    const s = 100 + parseInt(adjustSettings.saturation);
    const h = adjustSettings.hue;
    const blur = parseInt(adjustSettings.fade) / 10;
    
    l.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) blur(${blur}px)`;
    window.editor.CLIPQON_render();
}

function openHSL() { document.getElementById('hsl-panel').classList.add('active'); }
function closeHSL() { document.getElementById('hsl-panel').classList.remove('active'); }

function selectHSLColor(color, el) {
    currentHSLColor = color;
    document.querySelectorAll('.hsl-dot').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
    const data = hslData[color];
    const sliders = document.querySelectorAll('#hsl-panel .hsl-slider');
    sliders[0].value = data.h; sliders[1].value = data.s; sliders[2].value = data.l;
    
    document.getElementById('h-val').innerText = data.h;
    document.getElementById('s-val').innerText = data.s;
    document.getElementById('l-val').innerText = data.l;
}

function updateHSL(type, val) {
    hslData[currentHSLColor][type] = val;
    document.getElementById(type + '-val').innerText = (val > 0 ? '+' : '') + val;
}

function resetHSL() {
    if(confirm("क्या आप सभी 12 रंगों की सेटिंग्स रीसेट करना चाहते हैं?")) {
        Object.keys(hslData).forEach(color => { hslData[color] = {h:0, s:0, l:0}; });
        const sliders = document.querySelectorAll('#hsl-panel .hsl-slider');
        sliders.forEach(s => s.value = 0);
        
        document.getElementById('h-val').innerText = '0';
        document.getElementById('s-val').innerText = '0';
        document.getElementById('l-val').innerText = '0';
    }
}

function openGraphs() { document.getElementById('graphs-panel').classList.add('active'); initGraph(); }
function closeGraphs() { document.getElementById('graphs-panel').classList.remove('active'); }

function selectGraphChannel(channel, el) {
    currentChannel = channel;
    document.querySelectorAll('.graph-dot').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
    drawGraph(); 
}

function initGraph() {
    const gCanvas = document.getElementById('curve-canvas');
    if(gCanvas) { gCanvas.width = 250; gCanvas.height = 250; drawGraph(); }
}

function drawGraph() {
    const gCanvas = document.getElementById('curve-canvas');
    if(!gCanvas) return;
    const gCtx = gCanvas.getContext('2d');
    gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);
    let color = '#fff';
    if(currentChannel === 'red') color = '#ff0000';
    if(currentChannel === 'green') color = '#00ff00';
    if(currentChannel === 'blue') color = '#0000ff';

    gCtx.strokeStyle = color; gCtx.lineWidth = 3; gCtx.beginPath();
    gCtx.moveTo(0, gCanvas.height); gCtx.lineTo(gCanvas.width, 0); gCtx.stroke();
    gCtx.fillStyle = color; gCtx.beginPath();
    gCtx.arc(0, gCanvas.height, 5, 0, Math.PI * 2); gCtx.arc(gCanvas.width, 0, 5, 0, Math.PI * 2); gCtx.fill();
}

function resetGraph() { if(confirm("सभी चैनल्स के ग्राफ रीसेट करें?")) initGraph(); }
