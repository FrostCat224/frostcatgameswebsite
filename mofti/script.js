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

    // =========================
    // SETTINGS
    // =========================

    const hubRadius = 180;
    const clusterSpacing = 65;
    const isolatedDistance = 500;

    // =========================
    // BUILD GRAPH
    // =========================

    const connectionCount = new Map();
    const neighbors = new Map();

    for (const site of sites) {

        const connections =
            Array.isArray(site.connections)
                ? site.connections
                : [];

        connectionCount.set(
            site.id,
            connections.length
        );

        neighbors.set(
            site.id,
            new Set(
                connections.filter(id =>
                    siteMap.has(id)
                )
            )
        );
    }

    // =========================
    // ALSO ADD REVERSE LINKS
    // =========================
    //
    // If A -> B, B is considered
    // related to A as well.
    //

    for (const site of sites) {

        const connections =
            neighbors.get(site.id);

        for (const id of connections) {

            if (!neighbors.has(id)) continue;

            neighbors.get(id).add(site.id);
        }
    }

    // =========================
    // RESET
    // =========================

    for (const site of sites) {
        site.x = null;
        site.y = null;
    }

    if (sites.length === 0) {

        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1;

        return;
    }

    // =========================
    // SORT BY IMPORTANCE
    // =========================

    const sorted = [...sites].sort((a, b) => {

        const aCount =
            neighbors.get(a.id)?.size || 0;

        const bCount =
            neighbors.get(b.id)?.size || 0;

        return bCount - aCount;
    });

    // =========================
    // FIND HUBS
    // =========================
    //
    // A hub is a highly connected node.
    //

    const hubs = [];

    const hubThreshold = Math.max(
        4,
        Math.floor(sorted.length * 0.03)
    );

    for (const site of sorted) {

        const count =
            neighbors.get(site.id)?.size || 0;

        if (
            count >= hubThreshold &&
            hubs.length < 40
        ) {
            hubs.push(site);
        }
    }

    // Make sure there is at least one hub
    if (hubs.length === 0) {
        hubs.push(sorted[0]);
    }

    // =========================
    // PLACE HUBS
    // =========================
    //
    // Hubs are arranged in a loose grid
    // instead of a circle.
    //

    const hubColumns =
        Math.ceil(Math.sqrt(hubs.length));

    const hubSpacing = 650;

    for (let i = 0; i < hubs.length; i++) {

        const hub = hubs[i];

        const column =
            i % hubColumns;

        const row =
            Math.floor(i / hubColumns);

        hub.x =
            (column -
                (hubColumns - 1) / 2)
            * hubSpacing;

        hub.y =
            row * hubSpacing;

        if (row % 2 === 1) {
            hub.x += hubSpacing * 0.5;
        }
    }

    // =========================
    // FIND CLOSEST HUB
    // =========================

    function getClosestHub(site) {

        let bestHub = null;
        let bestScore = Infinity;

        for (const hub of hubs) {

            if (hub === site) continue;

            const hubNeighbors =
                neighbors.get(hub.id);

            let shared = 0;

            const siteNeighbors =
                neighbors.get(site.id);

            if (siteNeighbors) {

                for (const id of siteNeighbors) {

                    if (hubNeighbors?.has(id)) {
                        shared++;
                    }
                }
            }

            const direct =
                siteNeighbors?.has(hub.id)
                    ? 1
                    : 0;

            const distance =
                Math.hypot(
                    hub.x || 0,
                    hub.y || 0
                );

            // Shared connections are VERY important.
            const score =
                distance
                - shared * 1000
                - direct * 5000;

            if (score < bestScore) {

                bestScore = score;
                bestHub = hub;
            }
        }

        return bestHub;
    }

    // =========================
    // ASSIGN CLUSTERS
    // =========================

    const clusters = new Map();

    for (const hub of hubs) {
        clusters.set(hub.id, []);
    }

    const assigned = new Set(
        hubs.map(h => h.id)
    );

    for (const site of sorted) {

        if (assigned.has(site.id)) {
            continue;
        }

        const count =
            neighbors.get(site.id)?.size || 0;

        // =========================
        // VERY LOW CONNECTION NODES
        // =========================
        //
        // These become satellites.
        //

        if (count <= 0) {
            continue;
        }

        const hub =
            getClosestHub(site);

        if (!hub) continue;

        clusters
            .get(hub.id)
            .push(site);

        assigned.add(site.id);
    }

    // =========================
    // PLACE CLUSTERS
    // =========================

    for (const hub of hubs) {

        const cluster =
            clusters.get(hub.id) || [];

        // Strongest connections first
        cluster.sort((a, b) => {

            const aCount =
                neighbors.get(a.id)?.size || 0;

            const bCount =
                neighbors.get(b.id)?.size || 0;

            return bCount - aCount;
        });

        // =========================
        // PLACE EACH NODE
        // =========================

        for (let i = 0; i < cluster.length; i++) {

            const site = cluster[i];

            const siteNeighbors =
                neighbors.get(site.id) ||
                new Set();

            // =========================
            // FIND CONNECTED NODES
            // ALREADY PLACED
            // =========================

            let centerX = hub.x;
            let centerY = hub.y;

            let weightTotal = 1;

            for (const id of siteNeighbors) {

                const target =
                    siteMap.get(id);

                if (
                    !target ||
                    target.x === null
                ) {
                    continue;
                }

                // Stronger connections
                // pull the node closer.
                const weight =
                    1 +
                    Math.sqrt(
                        neighbors.get(id)?.size || 1
                    );

                centerX +=
                    target.x * weight;

                centerY +=
                    target.y * weight;

                weightTotal += weight;
            }

            centerX /= weightTotal;
            centerY /= weightTotal;

            // =========================
            // MATHEMATICAL LOCAL POSITION
            // =========================

            const angle =
                i * 2.399963229728653;

            // Golden-angle distribution.
            // This avoids the obvious circle.
            const radius =
                clusterSpacing *
                Math.sqrt(i + 1);

            let x =
                centerX +
                Math.cos(angle) * radius;

            let y =
                centerY +
                Math.sin(angle) * radius;

            // =========================
            // SMALL DETERMINISTIC
            // OFFSET
            // =========================

            // Prevents identical positions
            // without using Math.random().
            x +=
                Math.sin(site.id.length * 12.37)
                * 12;

            y +=
                Math.cos(site.id.length * 7.91)
                * 12;

            site.x = x;
            site.y = y;
        }
    }

    // =========================
    // PLACE ISOLATED NODES
    // =========================
    //
    // Nodes with 0-1 connections get
    // placed OUTSIDE the main clusters.
    //

    const isolated = sorted.filter(site =>
        !assigned.has(site.id)
    );

    for (let i = 0; i < isolated.length; i++) {

        const site = isolated[i];

        const angle =
            i * 2.399963229728653;

        const radius =
            isolatedDistance +
            Math.sqrt(i) * 90;

        // Put isolated nodes around the
        // outside, but NOT in a perfect circle.

        const stretchX =
            1.35;

        const stretchY =
            0.85;

        site.x =
            Math.cos(angle) *
            radius *
            stretchX;

        site.y =
            Math.sin(angle) *
            radius *
            stretchY;

        assigned.add(site.id);
    }

    // =========================
    // HANDLE UNPLACED NODES
    // =========================

    for (const site of sites) {

        if (
            site.x === null ||
            site.y === null
        ) {

            site.x = 0;
            site.y = 0;
        }
    }

    // =========================
    // STATIC OVERLAP CLEANUP
    // =========================
    //
    // Mathematical collision cleanup.
    // Runs ONLY when generating positions.
    //

    const minDistance = 55;

    for (let iteration = 0; iteration < 12; iteration++) {

        for (let i = 0; i < sites.length; i++) {

            const a = sites[i];

            for (let j = i + 1; j < sites.length; j++) {

                const b = sites[j];

                let dx =
                    b.x - a.x;

                let dy =
                    b.y - a.y;

                let distance =
                    Math.hypot(dx, dy);

                if (distance === 0) {

                    dx = 1;
                    dy = 0;
                    distance = 1;
                }

                if (distance < minDistance) {

                    const push =
                        (minDistance - distance)
                        * 0.5;

                    dx /= distance;
                    dy /= distance;

                    a.x -=
                        dx * push;

                    a.y -=
                        dy * push;

                    b.x +=
                        dx * push;

                    b.y +=
                        dy * push;
                }
            }
        }
    }

    // =========================
    // CENTER MAP
    // =========================

    let minX = Infinity;
    let maxX = -Infinity;

    let minY = Infinity;
    let maxY = -Infinity;

    for (const site of sites) {

        minX =
            Math.min(minX, site.x);

        maxX =
            Math.max(maxX, site.x);

        minY =
            Math.min(minY, site.y);

        maxY =
            Math.max(maxY, site.y);
    }

    const centerX =
        (minX + maxX) / 2;

    const centerY =
        (minY + maxY) / 2;

    for (const site of sites) {

        site.x -= centerX;
        site.y -= centerY;
    }

    // =========================
    // RESET CAMERA
    // =========================

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
            position.x < -100 ||
            position.x > window.innerWidth + 100 ||
            position.y < -100 ||
            position.y > window.innerHeight + 100
        ) {
            continue;
        }

        // =========================
        // CONNECTION COUNT
        // =========================
        //
        // Count both outgoing and incoming
        // connections, just like selectSite().
        //

        const connectionIds = new Set();

        // Outgoing
        if (Array.isArray(site.connections)) {

            for (const id of site.connections) {

                if (siteMap.has(id)) {
                    connectionIds.add(id);
                }
            }
        }

        // Incoming
        for (const otherSite of sites) {

            if (
                !Array.isArray(otherSite.connections)
            ) {
                continue;
            }

            if (
                otherSite.connections.includes(site.id)
            ) {
                connectionIds.add(otherSite.id);
            }
        }

        const connectionCount =
            connectionIds.size;


        // =========================
        // NODE SIZE
        // =========================
        //
        // More connections = bigger node.
        //
        // sqrt() prevents highly connected
        // nodes from becoming ridiculously huge.
        //

        let size =
            4 +
            Math.sqrt(connectionCount) * 1.5;

        // Keep nodes within sensible limits
        size =
            Math.max(4, Math.min(size, 18));


        // Selected node is slightly bigger
        if (site === selectedSite) {
            size += 3;
        }


        // =========================
        // ZOOM SCALING
        // =========================
        //
        // Keep nodes visible when zoomed out,
        // but let them grow normally when zoomed in.
        //

        if (camera.zoom < 0.5) {

            size *=
                Math.max(
                    0.7,
                    camera.zoom * 1.4
                );
        }


        // =========================
        // DRAW NODE
        // =========================

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


        // =========================
        // LABEL
        // =========================

        if (
            camera.zoom > 0.7 ||
            site === selectedSite
        ) {

            ctx.fillStyle = "#ffffff";

            ctx.font =
                "12px Arial";

            ctx.fillText(
                site.name || site.id,
                position.x + size + 4,
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

    let connectionCount = new Set();

    // Connections this site points to
    if (Array.isArray(site.connections)) {
        for (const id of site.connections) {
            if (siteMap.has(id)) {
                connectionCount.add(id);
            }
        }
    }

    // Sites that point TO this site
    for (const otherSite of sites) {

        if (
            !Array.isArray(otherSite.connections)
        ) {
            continue;
        }

        if (
            otherSite.connections.includes(site.id)
        ) {
            connectionCount.add(otherSite.id);
        }
    }

    const amount = connectionCount.size;

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

        const normalizedSites = sites.map(site => ({
            site,
            name: (
                site.name ||
                site.id
            ).toLowerCase()
        }));

        // 1. EXACT MATCH
        let result =
            normalizedSites.find(item =>
                item.name === query
            );

        // 2. STARTS WITH
        if (!result) {
            result =
                normalizedSites.find(item =>
                    item.name.startsWith(query)
                );
        }

        // 3. CONTAINS
        if (!result) {
            result =
                normalizedSites.find(item =>
                    item.name.includes(query)
                );
        }

        // Nothing found
        if (!result) return;

        const site = result.site;

        selectSite(site);

        // Move camera so result is centered
        camera.x =
            -site.x * camera.zoom;

        camera.y =
            -site.y * camera.zoom;
    }
);
