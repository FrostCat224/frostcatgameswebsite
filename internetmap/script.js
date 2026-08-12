const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");

const search = document.getElementById("search");

const siteName = document.getElementById("siteName");
const siteUrl = document.getElementById("siteUrl");
const connectionsText = document.getElementById("connections");

let sites = [];
let siteMap = new Map();

let selectedSite = null;

let camera = {
    x: 0,
    y: 0,
    zoom: 1
};


// =========================
// CANVAS
// =========================

function resize() {
    const dpr = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

window.addEventListener("resize", resize);

resize();


// =========================
// LOAD DATA
// =========================

fetch("data.json")
    .then(response => {

        if (!response.ok) {
            throw new Error(
                `HTTP error ${response.status}`
            );
        }

        return response.json();
    })
    .then(data => {

        if (!data.sites || !Array.isArray(data.sites)) {
            throw new Error(
                "data.json does not contain a sites array"
            );
        }

        sites = data.sites;

        siteMap.clear();

        for (const site of sites) {

            if (!site.id) continue;

            siteMap.set(site.id, site);
        }

        createPositions();

        console.log(
            `Loaded ${sites.length} websites`
        );

        draw();
    })
    .catch(error => {

        console.error(
            "Could not load data.json:",
            error
        );

        siteName.textContent =
            "Could not load data.json";

        siteUrl.textContent =
            "Check that data.json is in the same folder.";
    });


// =========================
// CREATE POSITIONS
// =========================

function createPositions() {

    const radius = Math.max(
        120,
        Math.min(300, sites.length * 20)
    );

    sites.forEach((site, index) => {

        const angle =
            (index / Math.max(sites.length, 1))
            * Math.PI * 2;

        site.x =
            Math.cos(angle) * radius;

        site.y =
            Math.sin(angle) * radius;
    });

    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
}


// =========================
// COORDINATES
// =========================

function worldToScreen(x, y) {

    return {
        x:
            x * camera.zoom
            + window.innerWidth / 2
            + camera.x,

        y:
            y * camera.zoom
            + window.innerHeight / 2
            + camera.y
    };
}


function screenToWorld(x, y) {

    return {
        x:
            (x
            - window.innerWidth / 2
            - camera.x)
            / camera.zoom,

        y:
            (y
            - window.innerHeight / 2
            - camera.y)
            / camera.zoom
    };
}


// =========================
// DRAW LOOP
// =========================

function draw() {

    ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );

    drawConnections();
    drawSites();

    requestAnimationFrame(draw);
}


// =========================
// DRAW CONNECTIONS
// =========================

function drawConnections() {

    ctx.lineWidth = 1;

    for (const site of sites) {

        if (
            !site.connections ||
            !Array.isArray(site.connections)
        ) {
            continue;
        }

        const a =
            worldToScreen(site.x, site.y);

        // Don't process nodes far outside screen
        if (
            a.x < -500 ||
            a.x > window.innerWidth + 500 ||
            a.y < -500 ||
            a.y > window.innerHeight + 500
        ) {
            continue;
        }

        for (const connectionId of site.connections) {

            const target =
                siteMap.get(connectionId);

            if (!target) continue;

            const b =
                worldToScreen(
                    target.x,
                    target.y
                );

            if (
                b.x < -500 ||
                b.x > window.innerWidth + 500 ||
                b.y < -500 ||
                b.y > window.innerHeight + 500
            ) {
                continue;
            }

            ctx.strokeStyle = "#333";

            ctx.beginPath();

            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);

            ctx.stroke();
        }
    }
}


// =========================
// DRAW SITES
// =========================

function drawSites() {

    for (const site of sites) {

        const position =
            worldToScreen(
                site.x,
                site.y
            );

        // Skip invisible nodes
        if (
            position.x < -50 ||
            position.x > window.innerWidth + 50 ||
            position.y < -50 ||
            position.y > window.innerHeight + 50
        ) {
            continue;
        }

        let size =
            site === selectedSite
                ? 9
                : 5;

        // Make nodes easier to tap when zoomed out
        if (camera.zoom < 0.5) {
            size = site === selectedSite
                ? 8
                : 4;
        }

        ctx.beginPath();

        ctx.arc(
            position.x,
            position.y,
            size,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            site === selectedSite
                ? "#ffffff"
                : "#4da6ff";

        ctx.fill();


        // Don't show thousands of labels when zoomed out
        if (
            camera.zoom > 0.7 ||
            site === selectedSite
        ) {

            ctx.fillStyle = "#ffffff";

            ctx.font =
                "12px Arial";

            ctx.fillText(
                site.name || site.id,
                position.x + 9,
                position.y + 4
            );
        }
    }
}


// =========================
// SELECT SITE
// =========================

function selectSite(site) {

    selectedSite = site;

    siteName.textContent =
        site.name || site.id;

    siteUrl.textContent =
        site.url || "";

    siteUrl.href =
        site.url || "#";

    const amount =
        Array.isArray(site.connections)
            ? site.connections.length
            : 0;

    connectionsText.textContent =
        `${amount} connection${amount === 1 ? "" : "s"}`;
}


// =========================
// FIND NODE
// =========================

function findSiteAt(x, y) {

    let closest = null;
    let closestDistance = Infinity;

    for (const site of sites) {

        const position =
            worldToScreen(
                site.x,
                site.y
            );

        const distance =
            Math.hypot(
                x - position.x,
                y - position.y
            );

        // Larger hit area on mobile
        const hitRadius =
            Math.max(
                14,
                18 * Math.min(camera.zoom, 1)
            );

        if (
            distance < hitRadius &&
            distance < closestDistance
        ) {

            closest = site;
            closestDistance = distance;
        }
    }

    return closest;
}


// =========================
// MOUSE DRAGGING
// =========================

let mouseDown = false;

let mouseStart = {
    x: 0,
    y: 0
};

let cameraStart = {
    x: 0,
    y: 0
};

let mouseMoved = false;


canvas.addEventListener(
    "mousedown",
    event => {

        mouseDown = true;
        mouseMoved = false;

        mouseStart.x =
            event.clientX;

        mouseStart.y =
            event.clientY;

        cameraStart.x =
            camera.x;

        cameraStart.y =
            camera.y;
    }
);


window.addEventListener(
    "mousemove",
    event => {

        if (!mouseDown) return;

        const dx =
            event.clientX - mouseStart.x;

        const dy =
            event.clientY - mouseStart.y;

        if (
            Math.abs(dx) > 4 ||
            Math.abs(dy) > 4
        ) {
            mouseMoved = true;
        }

        camera.x =
            cameraStart.x + dx;

        camera.y =
            cameraStart.y + dy;
    }
);


window.addEventListener(
    "mouseup",
    event => {

        if (!mouseDown) return;

        mouseDown = false;

        if (!mouseMoved) {

            const site =
                findSiteAt(
                    event.clientX,
                    event.clientY
                );

            if (site) {
                selectSite(site);
            }
        }
    }
);


// =========================
// MOUSE WHEEL ZOOM
// =========================

canvas.addEventListener(
    "wheel",
    event => {

        event.preventDefault();

        const mouseX =
            event.clientX;

        const mouseY =
            event.clientY;

        const before =
            screenToWorld(
                mouseX,
                mouseY
            );

        const zoomAmount =
            event.deltaY < 0
                ? 1.15
                : 0.87;

        camera.zoom *= zoomAmount;

        camera.zoom =
            Math.max(
                0.05,
                Math.min(20, camera.zoom)
            );

        const after =
            screenToWorld(
                mouseX,
                mouseY
            );

        camera.x +=
            (after.x - before.x)
            * camera.zoom;

        camera.y +=
            (after.y - before.y)
            * camera.zoom;

    },
    { passive: false }
);


// =========================
// MOBILE TOUCH
// =========================

let touches = [];

let lastTouchCenter = null;
let lastTouchDistance = null;

let touchMoved = false;


// Get center of two touches
function getTouchCenter(t1, t2) {

    return {
        x:
            (t1.clientX + t2.clientX) / 2,

        y:
            (t1.clientY + t2.clientY) / 2
    };
}


// Get distance between touches
function getTouchDistance(t1, t2) {

    return Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY
    );
}


// Touch start
canvas.addEventListener(
    "touchstart",
    event => {

        event.preventDefault();

        touches =
            Array.from(event.touches);

        touchMoved = false;

        if (touches.length === 1) {

            lastTouchCenter = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };

            lastTouchDistance = null;

        }

        else if (touches.length >= 2) {

            lastTouchCenter =
                getTouchCenter(
                    touches[0],
                    touches[1]
                );

            lastTouchDistance =
                getTouchDistance(
                    touches[0],
                    touches[1]
                );
        }

    },
    { passive: false }
);


// Touch move
canvas.addEventListener(
    "touchmove",
    event => {

        event.preventDefault();

        touches =
            Array.from(event.touches);

        if (touches.length === 1) {

            const current = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };

            if (!lastTouchCenter) {
                lastTouchCenter = current;
                return;
            }

            const dx =
                current.x -
                lastTouchCenter.x;

            const dy =
                current.y -
                lastTouchCenter.y;

            if (
                Math.abs(dx) > 2 ||
                Math.abs(dy) > 2
            ) {
                touchMoved = true;
            }

            camera.x += dx;
            camera.y += dy;

            lastTouchCenter = current;
        }


        // =====================
        // PINCH ZOOM
        // =====================

        else if (touches.length >= 2) {

            const center =
                getTouchCenter(
                    touches[0],
                    touches[1]
                );

            const distance =
                getTouchDistance(
                    touches[0],
                    touches[1]
                );

            if (
                lastTouchDistance !== null
            ) {

                const zoomFactor =
                    distance /
                    lastTouchDistance;

                const before =
                    screenToWorld(
                        center.x,
                        center.y
                    );

                camera.zoom *=
                    zoomFactor;

                camera.zoom =
                    Math.max(
                        0.05,
                        Math.min(20, camera.zoom)
                    );

                const after =
                    screenToWorld(
                        center.x,
                        center.y
                    );

                camera.x +=
                    (after.x - before.x)
                    * camera.zoom;

                camera.y +=
                    (after.y - before.y)
                    * camera.zoom;

                touchMoved = true;
            }

            // Also allow two-finger panning
            if (lastTouchCenter) {

                camera.x +=
                    center.x -
                    lastTouchCenter.x;

                camera.y +=
                    center.y -
                    lastTouchCenter.y;
            }

            lastTouchCenter = center;

            lastTouchDistance =
                distance;
        }

    },
    { passive: false }
);


// Touch end
canvas.addEventListener(
    "touchend",
    event => {

        event.preventDefault();

        if (
            !touchMoved &&
            event.changedTouches.length === 1
        ) {

            const touch =
                event.changedTouches[0];

            const site =
                findSiteAt(
                    touch.clientX,
                    touch.clientY
                );

            if (site) {
                selectSite(site);
            }
        }

        touches =
            Array.from(event.touches);

        if (touches.length === 0) {

            lastTouchCenter = null;
            lastTouchDistance = null;
        }

        else if (touches.length === 1) {

            lastTouchCenter = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };

            lastTouchDistance = null;
        }

    },
    { passive: false }
);


// =========================
// SEARCH
// =========================

search.addEventListener(
    "input",
    () => {

        const query =
            search.value
                .toLowerCase()
                .trim();

        if (!query) return;

        const result =
            sites.find(site =>
                (
                    site.name ||
                    site.id
                )
                .toLowerCase()
                .includes(query)
            );

        if (!result) return;

        selectSite(result);

        // Move camera so result is centered
        camera.x =
            -result.x * camera.zoom;

        camera.y =
            -result.y * camera.zoom;
    }
);