const { computePosition, offset, flip, shift } = window.FloatingUIDOM;


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");
// const resetButton = document.getElementById("resetZoom");

let scale = 1;
let translateX = 0;
let translateY = 0;
let targetScale = 1;
let targetTranslateX = 0;
let targetTranslateY = 0;
let animating = false;
const zoomLimit = 2;

const getExactColor = d3.scaleLinear()
    .domain([-10, -7, -3, 0, 3, 7, 10])
    .range(["rgb(121, 8, 0)", "rgb(205, 10, 1)", "rgb(235, 43, 33)", "rgb(236, 216, 0)",
        "rgb(87, 197, 40)", "rgb(4, 172, 18)", "rgb(4, 102, 4)"])
    .interpolate(d3.interpolateRgb);

let root = null;
let highlightIndustry = null;
const boxes = [];
const industryBoxes = [];
const industryMap = new Map();


/**
 * Draw the canvas to fit the window, taking into account the device pixel
 * ratio. This function is called once on page load and whenever the window
 * is resized.
 *
 * This function does the following:
 * 1. Set the canvas element's width and height to the logical width and
 *    height, times the device pixel ratio.
 * 2. Set the canvas element's CSS width and height to the logical width and
 *    height.
 * 3. Reset the canvas context's transformation matrix.
 * 4. Apply the device pixel ratio scaling to the canvas context.
 */
function drawCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = document.querySelector('.canvas-wrapper').clientWidth;
    const logicalHeight = window.innerHeight - 50;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = logicalWidth + "px";
    canvas.style.height = logicalHeight + "px";

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.scale(dpr, dpr); // Apply DPR scaling
}

// 
// Initial setup
drawCanvas();


/**
 * Draws the treemap onto the canvas element.
 *
 * This function clears the canvas context, applies the current scale and
 * translation, and then draws each node of the treemap recursively. The
 * drawing of each node is decided based on the node's depth in the treemap
 * hierarchy.
 *
 * If the highlightIndustry variable is set, then the industry box specified
 * by it is highlighted on the canvas.
 *
 * @return {void}
 */
function drawTreemap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(translateX, translateY);
    ctx.scale(scale, scale);

    boxes.length = 0;
    industryBoxes.length = 0;

    root.each(d => {
        const x = d.x0, y = d.y0, w = d.x1 - d.x0, h = d.y1 - d.y0;

        if (d.depth === 1) {
            ctx.save();
            ctx.fillStyle = "#000";
            ctx.font = "bold 15px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(d.data.name, x + 4, y + 8);
            ctx.restore();
        } else if (d.depth === 2) {
            ctx.save();
            const labelHeight = 28;
            ctx.fillStyle = d.data.color || "rgb(132, 1, 77)";
            ctx.fillRect(x + 2, y, w - 4, labelHeight);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(d.data.name, x + 6, y + labelHeight / 2);
            ctx.restore();
            industryBoxes.push({ x, y, w, h, name: d.data.name });
        } else if (d.depth === 3) {
            ctx.save();
            drawRoundedRect(ctx, x, y, w, h, 4);
            ctx.fillStyle = getExactColor(d.data.change);
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.stroke();

            const nameText = d.data.name;
            const changeText = d.data.change > 0 ? "+" + d.data.change.toFixed(2) : d.data.change.toFixed(2) + "%";
            const centerX = x + w / 2;
            const centerY = y + h / 2 + 7;

            ctx.textAlign = "center";
            ctx.fillStyle = "#fff";

            const nameFont = "20px sans-serif";
            const changeFont = "15px sans-serif";
            ctx.font = nameFont;
            const nameFits = ctx.measureText(nameText).width < w - 6;

            if (h >= 46 && nameFits) {
                ctx.fillText(nameText, centerX, centerY - 10);
                ctx.font = changeFont;
                ctx.fillText(changeText, centerX, centerY + 10);
            } else if (h >= 20 && nameFits) {
                ctx.fillText(nameText, centerX, centerY);
            }

            ctx.restore();
            industryMap.set(d, d.parent);
            boxes.push({ x, y, w, h, node: d, ...d.data });
        }
    });


    if (highlightIndustry) {
        ctx.save();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeRect(highlightIndustry.x, highlightIndustry.y, highlightIndustry.w, highlightIndustry.h);
        ctx.restore();
    } else {

        ctx.save();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.restore();
    }

    ctx.restore();
}

/**
 * Draws a rounded rectangle with the given dimensions and corner radius.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {number} x - The x-coordinate of the top-left corner of the rectangle.
 * @param {number} y - The y-coordinate of the top-left corner of the rectangle.
 * @param {number} w - The width of the rectangle.
 * @param {number} h - The height of the rectangle.
 * @param {number} r - The corner radius of the rectangle.
 */
function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Calculates the minimum scale needed to fully display the treemap.
 * @returns {number} - The minimum scale value.
 */
function getMinScale() {
    if (!root) return 1;
    return Math.min(canvas.clientWidth / root.x1, canvas.clientHeight / root.y1);
}

/**
 * Clamps the pan (translation) of the treemap to ensure it stays within
 * the bounds of the visible area.
 *
 * This function is called when the user stops panning (e.g. releases the
 * mouse button). It is also called when the user zooms out past a certain
 * scale.
 *
 * @private
 */
function clampPan() {
    const minTranslateX = canvas.clientWidth - root.x1 * scale;
    const minTranslateY = canvas.clientHeight - root.y1 * scale;

    translateX = Math.min(Math.max(translateX, minTranslateX), 0);
    translateY = Math.min(Math.max(translateY, minTranslateY), 0);

    targetTranslateX = translateX;
    targetTranslateY = translateY;
}

function clampPanTouch() {
    const minTranslateX = canvas.clientWidth - root.x1 * targetScale;
    const minTranslateY = canvas.clientHeight - root.y1 * targetScale;

    targetTranslateX = Math.min(Math.max(targetTranslateX, minTranslateX), 0);
    targetTranslateY = Math.min(Math.max(targetTranslateY, minTranslateY), 0);
}

/**
 * Animates the zooming of the treemap from the current scale to a target
 * scale, with a smooth ease-in-out effect. The animation is done by
 * recursively calling requestAnimationFrame() until the target scale is
 * reached within a certain tolerance. The translateX and translateY
 * variables are also adjusted to center the zoom on the target rectangle.
 *
 * This function is called when the user zooms in or out using the mouse
 * wheel, and when the user clicks on a node to zoom to it.
 *
 * @private
 */
function animateZoom() {
    const ease = 0.1;
    const dx = targetTranslateX - translateX;
    const dy = targetTranslateY - translateY;
    const ds = targetScale - scale;

    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(ds) > 0.001) {
        translateX += dx * ease;
        translateY += dy * ease;
        scale += ds * ease;
        drawTreemap();
        requestAnimationFrame(animateZoom);
    } else {
        translateX = targetTranslateX;
        translateY = targetTranslateY;
        scale = targetScale;
        clampPan();
        drawTreemap();
        animating = false;
    }
}

// Zoom event
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const wheel = e.deltaY < 0 ? 1.1 : 0.9;
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    const minScale = getMinScale();
    const newScale = Math.min(Math.max(scale * wheel, minScale), zoomLimit);
    if (newScale === scale) return;

    let newTranslateX, newTranslateY;

    if (wheel > 1) {
        // Zooming in – focus on cursor
        newTranslateX = mouseX - (mouseX - translateX) * (newScale / scale);
        newTranslateY = mouseY - (mouseY - translateY) * (newScale / scale);
    } else {
        // Zooming out – recenter toward center of treemap
        const centerX = root.x1 / 2;
        const centerY = root.y1 / 2;
        newTranslateX = canvas.clientWidth / 2 - centerX * newScale;
        newTranslateY = canvas.clientHeight / 2 - centerY * newScale;
    }

    targetScale = newScale;
    targetTranslateX = newTranslateX;
    targetTranslateY = newTranslateY;

    if (!animating) {
        animating = true;
        animateZoom();
    }
});

// 
// Pan (drag)
let isDragging = false;
let dragStart = { x: 0, y: 0 };

canvas.addEventListener("mousedown", e => {
    if (targetScale > 1) { // Only allow panning when zoomed
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
    }
});

canvas.addEventListener("mousemove", e => {
    if (isDragging) {
        translateX += e.clientX - dragStart.x;
        translateY += e.clientY - dragStart.y;
        dragStart = { x: e.clientX, y: e.clientY };
        targetTranslateX = translateX;
        targetTranslateY = translateY;
        clampPan();
        drawTreemap();
    }
});

canvas.addEventListener("mouseup", () => isDragging = false);
canvas.addEventListener("mouseleave", () => isDragging = false);


/**
 * Calculates the distance between two touch points, typically used for
 * pinch-zoom.
 *
 * @param {TouchList} touches - A TouchList of two touch points.
 * @returns {number} - The distance between the two touch points.
 */
function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// 
// 
// For Touch Zoom and Pan
let isTouchPanning = false;
let lastTouchX = 0;
let lastTouchY = 0;
let lastPinchDist = 0;

canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
        // Start panning
        isTouchPanning = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        // Start pinch-zoom
        e.preventDefault();
        isTouchPanning = false;
        lastPinchDist = getPinchDistance(e.touches);
    }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
    if (e.touches.length === 1 && isTouchPanning) {
        // Handle one-finger pan
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastTouchX;
        const deltaY = touch.clientY - lastTouchY;

        targetTranslateX += deltaX;
        targetTranslateY += deltaY;

        clampPanTouch();

        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;


        if (!animating) {
            animating = true;
            animateZoom();
        }

    } else if (e.touches.length === 2) {
        // Handle pinch-to-zoom
        e.preventDefault();
        const newDist = getPinchDistance(e.touches);
        const delta = newDist - lastPinchDist;

        // Zoom sensitivity
        const zoomFactor = 1 + delta / 200;
        const newScale = Math.min(Math.max(targetScale * zoomFactor, getMinScale()), zoomLimit);

        // Midpoint between fingers
        const touchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const touchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const midX = (touchMidX - translateX) / scale;
        const midY = (touchMidY - translateY) / scale;

        targetTranslateX = touchMidX - midX * newScale;
        targetTranslateY = touchMidY - midY * newScale;
        targetScale = newScale;

        clampPanTouch();

        lastPinchDist = newDist;

        if (!animating) {
            animating = true;
            animateZoom();
        }
    }
}, { passive: false });

canvas.addEventListener("touchend", e => {
    if (e.touches.length < 2) {
        lastPinchDist = 0;
    }
    if (e.touches.length === 0) {
        isTouchPanning = false;
    }
});


/**
 * Zooms to a specific node in the treemap by its name.
 *
 * This function finds the node with the specified name within the treemap,
 * calculates the appropriate scale and translation to center the node on
 * the canvas, and initiates an animated zoom effect. If the node is not
 * found, a warning is logged to the console.
 *
 * @param {string} name - The name of the node to zoom to.
 */
function zoomToNode(name) {
    const target = boxes.find(b => b.name === name);

    if (!target) {
        console.warn("Node not found:", name);
        return;
    }

    const industryName = target.node.parent.data.name;
    const targetIndustryBoxe = industryBoxes.find(ib => ib.name === industryName);
    highlightIndustry = targetIndustryBoxe;

    const padding = 20;
    const availableWidth = canvas.clientWidth - 2 * padding;
    const availableHeight = canvas.clientHeight - 2 * padding;

    const scaleX = availableWidth / targetIndustryBoxe.w;
    const scaleY = availableHeight / targetIndustryBoxe.h;
    const scale = Math.min(scaleX, scaleY, 2);

    const centerX = targetIndustryBoxe.x + targetIndustryBoxe.w / 2;
    const centerY = targetIndustryBoxe.y + targetIndustryBoxe.h / 2;

    targetScale = scale;
    targetTranslateX = canvas.clientWidth / 2 - centerX * scale;
    targetTranslateY = canvas.clientHeight / 2 - centerY * scale;

    animateZoom();
}


// 
// Reset Zoom Button
// resetButton.addEventListener("click", () => {
//     targetScale = 1;
//     targetTranslateX = 0;
//     targetTranslateY = 0;
//     if (!animating) {
//         animating = true;
//         animateZoom();
//     }
// });



/**
 * Returns the mouse position relative to the canvas element in response
 * to a MouseEvent.
 *
 * @param {MouseEvent} event - The mouse event.
 * @returns {Object} - An object with `x` and `y` properties representing
 *   the mouse position relative to the canvas element.
 */
function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}


//
// For Tooltip
// 

/**
 * Hides the tooltip by setting its visibility to "hidden", scaling it
 * down to 85%, and setting its opacity to 0.
 */
function hideTooltip() {
    tooltip.style.visibility = "hidden";
    tooltip.style.transform = "scale(.85)";
    tooltip.style.opacity = "0";
    highlightIndustry = null;

    drawTreemap();
}

canvas.addEventListener("mousemove", async (e) => {
    const { x, y } = getMousePos(e);
    const mouseX = (x - translateX) / scale;
    const mouseY = (y - translateY) / scale;

    highlightIndustry = null;
    for (const ind of industryBoxes) {
        if (
            mouseX >= ind.x &&
            mouseX <= ind.x + ind.w &&
            mouseY >= ind.y &&
            mouseY <= ind.y + ind.h
        ) {
            highlightIndustry = ind;
            break;
        }
    }

    if (highlightIndustry && highlightIndustry.name) {
        const companies = boxes.filter(
            (b) => industryMap.get(b.node).data.name === highlightIndustry.name
        );
        const industryNode = industryMap.get(companies[0]?.node);
        const sectorName = industryNode?.parent?.data?.name;

        let content = `<div class="tooltip-header"><strong>${sectorName} - ${highlightIndustry.name}</strong></div>`;
        let items = "";

        for (const c of companies) {
            const change = c.change > 0 ? "+" + c.change.toFixed(2) : c.change.toFixed(2);
            const colorBox = `<span style="display:inline-block;width:10px;height:10px;background:${getExactColor(
                c.change
            )};margin-right:4px;border-radius:2px;"></span>`;
            items += `<div class="tooltip-item">${colorBox} ${c.name} — ${c.value}, ${change}%</div>`;
        }

        content += `<div class="tooltip-body">${items}</div>`;
        tooltip.innerHTML = content;

        tooltip.style.left = '-9999px';
        tooltip.style.top = '-9999px';
        tooltip.style.visibility = 'hidden';

        const virtualMouse = {
            getBoundingClientRect: () => ({
                x: e.clientX,
                y: e.clientY,
                width: 0,
                height: 0,
                top: e.clientY,
                left: e.clientX,
                bottom: e.clientY,
                right: e.clientX
            }),
            contextElement: canvas
        };

        const { x: tooltipX, y: tooltipY } = await computePosition(virtualMouse, tooltip, {
            middleware: [offset(12), flip(), shift({ padding: 8 })],
            placement: 'top-start',
        });

        Object.assign(tooltip.style, {
            position: 'absolute',
            left: `${tooltipX}px`,
            top: `${tooltipY}px`,
            visibility: 'visible',
            opacity: '1',
            transform: 'scale(1)',
        });

        drawTreemap();
    } else {
        hideTooltip();
    }
});



canvas.addEventListener("mouseleave", () => {
    hideTooltip();
});

canvas.addEventListener("touchmove", () => {
    hideTooltip();
});



// 
// For Url, Double Click on the boxes
canvas.addEventListener("dblclick", (e) => {
    const { x, y } = getMousePos(e);

    for (const box of boxes) {
        if (x >= box.x && x <= box.x + box.w &&
            y >= box.y && y <= box.y + box.h) {
            window.open(box.url, "_blank");
            break;
        }
    }
});


//
// Load data
fetch("data.json")
    .then(res => res.json())
    .then(data => {
        const hierarchy = d3.hierarchy(data).sum(d => d.value);
        root = d3.treemap()
            .size([canvas.clientWidth, canvas.clientHeight])
            .padding(1)
            .paddingInner(1)
            .paddingTop(d => d.depth === 1 ? 26 : d.depth === 2 ? 27 : 0)
            .round(true)(hierarchy);

        drawTreemap();
    });

// 
// Resize
window.addEventListener("resize", () => {
    drawCanvas();
    drawTreemap();
});
