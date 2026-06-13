// ==========================================
// CLIPQON VIDEO EDITOR - MAIN CONTROLLER (app.js)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // --- 1. સ્ટેટ મેનેજમેન્ટ (State Management) ---
    let isPlaying = false;
    let currentRatio = "original";
    let currentFPS = 30;
    let currentResolution = "720";
    let selectedClip = null;

    // --- 2. એલિમેન્ટ્સ સિલેક્ટર્સ (DOM Elements) ---
    const ratioToggle = document.getElementById("ratio-toggle");
    const fpsToggle = document.getElementById("fps-toggle");
    const resToggle = document.getElementById("res-toggle");
  
    const ratioMenu = document.getElementById("ratio-menu");
    const fpsMenu = document.getElementById("fps-menu");
    const resMenu = document.getElementById("res-menu");
    
    const curLabel = document.getElementById("cur-label");
    const curFPS = document.getElementById("cur-fps");
    const curRes = document.getElementById("cur-res");

    const btnPlay = document.getElementById("btn-play");
    const btnMinimize = document.getElementById("btn-minimize");
    const editorFooter = document.getElementById("editor-footer");

    const mainCanvas = document.getElementById("mainCanvas");
    const volPopup = document.querySelector(".vol-mini-popup");
    const volSlider = document.getElementById("vol-slider");
    const volDisplay = document.getElementById("vol-display");

    // --- 3. ડ્રોપડાઉન મેનુ ટોગલ લોજિક (Dropdown Menus Logic) ---
    function closeAllMenus() {
        ratioMenu.style.display = "none";
        fpsMenu.style.display = "none";
        resMenu.style.display = "none";
    }

    ratioToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const show = ratioMenu.style.display === "block";
        closeAllMenus();
        ratioMenu.style.display = show ? "none" : "block";
    });

    fpsToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const show = fpsMenu.style.display === "block";
        closeAllMenus();
        fpsMenu.style.display = show ? "none" : "block";
    });

    resToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const show = resMenu.style.display === "block";
        closeAllMenus();
        resMenu.style.display = show ? "none" : "block";
    });

    document.addEventListener("click", () => {
        closeAllMenus();
    });

    // મેનુ આઇટમ્સ સિલેક્શન લોજિક
    document.querySelectorAll("#ratio-menu .r-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll("#ratio-menu .r-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentRatio = this.dataset.ratio;
            curLabel.textContent = this.dataset.label;
            adjustCanvasRatio(currentRatio);
        });
    });

    document.querySelectorAll(".fps-item").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".fps-item").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFPS = parseInt(this.dataset.fps);
            curFPS.textContent = currentFPS;
        });
    });

    document.querySelectorAll(".res-item").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".res-item").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentResolution = this.dataset.res;
            curRes.textContent = currentResolution === "2160" ? "4K" : currentResolution + "p";
        });
    });

    // --- 4. કેનવાસ રેશિયો એડજસ્ટમેન્ટ (Canvas Ratio Aspect) ---
    function adjustCanvasRatio(ratio) {
        const canvasBox = document.getElementById("canvas-box");
        if (!canvasBox) return;

        if (ratio === "original") {
            canvasBox.style.width = "100%";
            canvasBox.style.height = "100%";
        } else {
            const numericRatio = parseFloat(ratio);
            if (numericRatio > 1) { 
                canvasBox.style.width = "90%";
                canvasBox.style.height = (90 / numericRatio) + "%";
            } else { 
                canvasBox.style.height = "95%";
                canvasBox.style.width = (95 * numericRatio) + "%";
            }
        }
        showToast(`Aspect Ratio Changed: ${curLabel.textContent}`);
    }

    // --- 5. પ્લે / પોઝ લોજિક (Play / Pause Logic) ---
    btnPlay.addEventListener("click", () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            btnPlay.innerHTML = "<span>⏸</span>Pause";
            btnPlay.style.color = "var(--resize-blue)";
            showToast("Playing Timeline...");
        } else {
            btnPlay.innerHTML = "<span>▶</span>Play";
            btnPlay.style.color = "#888";
            showToast("Paused");
        }
    });

    // --- 6. ટાઇમલાઇન મિનિમાઇઝ (Timeline Minimize Panel) ---
    btnMinimize.addEventListener("click", () => {
        editorFooter.classList.toggle("minimized");
        if(editorFooter.classList.contains("minimized")) {
            btnMinimize.textContent = "⭾"; 
        } else {
            btnMinimize.textContent = "⭾";
        }
    });

    // --- 7. ક્લિપ સિલેક્શન લોજિક ---
    document.querySelectorAll(".track-clip").forEach(clip => {
        clip.addEventListener("click", function(e) {
            e.stopPropagation();
            document.querySelectorAll(".track-clip").forEach(c => c.classList.remove("selected"));
            this.classList.add("selected");
            selectedClip = this;
            showToast(`Selected: ${this.querySelector(".clip-name").textContent}`);
        });
    });

    document.getElementById("layers-area")?.addEventListener("click", () => {
        if(selectedClip) {
            selectedClip.classList.remove("selected");
            selectedClip = null;
        }
    });

    // --- 8. ટોસ્ટ નોટિફિકેશન સિસ્ટમ (Toast Notification) ---
    function showToast(message) {
        let toast = document.querySelector(".toast-notification");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast-notification";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 2000);
    }

    window.showToast = showToast;
});
