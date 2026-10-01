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


// ============================================================
// FIREBASE
// ============================================================

const FIREBASE_URL =
    "https://mapoftheinternet-default-rtdb.europe-west1.firebasedatabase.app/internetmap/sites.json";


// ============================================================
// CANVAS
// ============================================================

function resize() {

    const dpr =
        window.devicePixelRatio || 1;

    canvas.width =
        window.innerWidth * dpr;

    canvas.height =
        window.innerHeight * dpr;

    canvas.style.width =
        window.innerWidth + "px";

    canvas.style.height =
        window.innerHeight + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

window.addEventListener(
    "resize",
    resize
);

resize();


// ============================================================
// LOAD FIREBASE DATA
// ============================================================

fetch(FIREBASE_URL)
    .then(response => {

        if (!response.ok) {
            throw new Error(
                `HTTP error ${response.status}`
            );
        }

        return response.json();
    })
    .then(data => {

        if (!data || typeof data !== "object") {
            throw new Error(
                "Firebase returned no site data"
            );
        }

        sites = Object.values(data);

        siteMap.clear();

        for (const site of sites) {

            if (!site || !site.id) {
                continue;
            }

            if (!Array.isArray(site.connections)) {
                site.connections = [];
            }

            siteMap.set(
                site.id,
                site
            );
        }

        sites = sites.filter(
            site => site && site.id
        );

        createPositions();

        console.log(
            `Loaded ${sites.length} websites from Firebase`
        );

        draw();
    })
    .catch(error => {

        console.error(
            "Could not load Firebase data:",
            error
        );

        siteName.textContent =
            "Could not load Firebase data";

        siteUrl.textContent =
            "Check your Firebase database and rules.";
    });


// ============================================================
// CREATE CONNECTION GRAPH
// ============================================================

function createGraph() {

    const graph = new Map();

    for (const site of sites) {

        graph.set(
            site.id,
            new Set()
        );
    }

    // Normal connections

    for (const site of sites) {

        if (!Array.isArray(site.connections)) {
            continue;
        }

        for (
            const connectionId
            of site.connections
        ) {

            if (!siteMap.has(connectionId)) {
                continue;
            }

            graph
                .get(site.id)
                .add(connectionId);
        }
    }

    // Reverse connections

    /*
        If A -> B exists, treat it as
        A <-> B for positioning.

        This DOES NOT change Firebase.
    */

    for (const site of sites) {

        const connections =
            graph.get(site.id);

        if (!connections) {
            continue;
        }

        for (const connectionId of connections) {

            if (!graph.has(connectionId)) {
                continue;
            }

            graph
                .get(connectionId)
                .add(site.id);
        }
    }

    return graph;
}


// ============================================================
// NON-PHYSICS LAYOUT
// ============================================================

function createPositions() {

    if (sites.length === 0) {
        return;
    }

    const graph =
        createGraph();


    /*
        SETTINGS

        connectedDistance:
        Distance between directly connected
        websites.

        groupSpacing:
        Distance between separate groups.

        centerSpacing:
        Distance between major hubs.

        These are just coordinates.
        No physics happens.
    */

    const connectedDistance = 115;

    const groupSpacing = 500;

    const centerSpacing = 650;


    // --------------------------------------------------------
    // RESET
    // --------------------------------------------------------

    for (const site of sites) {

        site.x = 0;
        site.y = 0;
    }


    // --------------------------------------------------------
    // FIND CONNECTED GROUPS
    // --------------------------------------------------------

    const visited =
        new Set();

    const groups = [];


    for (const site of sites) {

        if (visited.has(site.id)) {
            continue;
        }

        const group = [];

        const queue = [site.id];

        visited.add(site.id);

        while (queue.length > 0) {

            const currentId =
                queue.shift();

            group.push(currentId);

            const neighbors =
                graph.get(currentId);

            if (!neighbors) {
                continue;
            }

            for (const neighborId of neighbors) {

                if (
                    visited.has(neighborId)
                ) {
                    continue;
                }

                visited.add(neighborId);

                queue.push(
                    neighborId
                );
            }
        }

        groups.push(group);
    }


    // --------------------------------------------------------
    // SORT GROUPS
    // --------------------------------------------------------

    /*
        Biggest groups go toward the center.
    */

    groups.sort(
        (a, b) =>
            b.length - a.length
    );


    // --------------------------------------------------------
    // PLACE GROUPS
    // --------------------------------------------------------

    const groupPositions = [];

    for (
        let i = 0;
        i < groups.length;
        i++
    ) {

        const angle =
            i * 2.3999632297;

        const radius =
            Math.sqrt(i) *
            groupSpacing;

        groupPositions.push({

            x:
                Math.cos(angle) *
                radius,

            y:
                Math.sin(angle) *
                radius
        });
    }


    // --------------------------------------------------------
    // LAYOUT EACH GROUP
    // --------------------------------------------------------

    for (
        let groupIndex = 0;
        groupIndex < groups.length;
        groupIndex++
    ) {

        const group =
            groups[groupIndex];

        const groupCenter =
            groupPositions[groupIndex];


        // ----------------------------------------------------
        // FIND HUBS
        // ----------------------------------------------------

        const sortedNodes =
            [...group].sort(
                (a, b) => {

                    const aConnections =
                        graph.get(a)?.size || 0;

                    const bConnections =
                        graph.get(b)?.size || 0;

                    return (
                        bConnections -
                        aConnections
                    );
                }
            );


        // ----------------------------------------------------
        // POSITION FIRST NODE
        // ----------------------------------------------------

        const firstId =
            sortedNodes[0];

        const firstSite =
            siteMap.get(firstId);

        firstSite.x =
            groupCenter.x;

        firstSite.y =
            groupCenter.y;


        const placed =
            new Set([
                firstId
            ]);


        // ----------------------------------------------------
        // PLACE NODES BY CONNECTION
        // ----------------------------------------------------

        /*
            We repeatedly look for an unplaced
            node that is connected to something
            already placed.

            This creates a tree-like layout:

                    A
                  / | \
                 B  C  D
                / \    |
               E   F   G

            instead of a random cluster.
        */

        while (
            placed.size <
            sortedNodes.length
        ) {

            let bestNode = null;
            let bestParent = null;
            let bestScore = -Infinity;


            for (
                const nodeId
                of sortedNodes
            ) {

                if (
                    placed.has(nodeId)
                ) {
                    continue;
                }

                const neighbors =
                    graph.get(nodeId);

                if (!neighbors) {
                    continue;
                }


                for (
                    const parentId
                    of neighbors
                ) {

                    if (
                        !placed.has(
                            parentId
                        )
                    ) {
                        continue;
                    }


                    const parent =
                        siteMap.get(
                            parentId
                        );

                    if (!parent) {
                        continue;
                    }


                    /*
                        More connected nodes are
                        placed earlier.
                    */

                    const degree =
                        graph.get(
                            nodeId
                        )?.size || 0;


                    /*
                        Prefer parents with more
                        connections too.
                    */

                    const parentDegree =
                        graph.get(
                            parentId
                        )?.size || 0;


                    const score =
                        degree * 2 +
                        parentDegree;


                    if (
                        score >
                        bestScore
                    ) {

                        bestScore =
                            score;

                        bestNode =
                            nodeId;

                        bestParent =
                            parentId;
                    }
                }
            }


            // If no connected node was found,
            // place the remaining node normally.

            if (!bestNode) {

                for (
                    const nodeId
                    of sortedNodes
                ) {

                    if (
                        !placed.has(
                            nodeId
                        )
                    ) {

                        bestNode =
                            nodeId;

                        break;
                    }
                }

                if (!bestNode) {
                    break;
                }
            }


            const node =
                siteMap.get(
                    bestNode
                );


            // ------------------------------------------------
            // PLACE AROUND PARENT
            // ------------------------------------------------

            if (bestParent) {

                const parent =
                    siteMap.get(
                        bestParent
                    );


                /*
                    Find how many children the
                    parent already has.
                */

                let childIndex = 0;

                for (
                    const id
                    of placed
                ) {

                    const neighbors =
                        graph.get(id);

                    if (
                        neighbors &&
                        neighbors.has(
                            bestNode
                        )
                    ) {

                        childIndex++;
                    }
                }


                /*
                    Spread children in a circle
                    around their parent.
                */

                const childCount =
                    Math.max(
                        childIndex,
                        1
                    );

                const angle =
                    childIndex *
                    (
                        Math.PI * 2 /
                        Math.max(
                            childCount,
                            5
                        )
                    );


                /*
                    Small offset based on the
                    node's position.

                    This prevents huge groups
                    from forming a perfectly
                    straight line.
                */

                const extraAngle =
                    (
                        graph.get(
                            bestNode
                        )?.size || 0
                    ) * 0.15;


                const finalAngle =
                    angle +
                    extraAngle;


                node.x =
                    parent.x +
                    Math.cos(
                        finalAngle
                    ) *
                    connectedDistance;

                node.y =
                    parent.y +
                    Math.sin(
                        finalAngle
                    ) *
                    connectedDistance;

            } else {

                /*
                    Completely disconnected
                    leftover node.

                    Put it near the group center.
                */

                const index =
                    placed.size;

                const angle =
                    index *
                    2.3999632297;

                const radius =
                    connectedDistance *
                    Math.sqrt(
                        index + 1
                    );

                node.x =
                    groupCenter.x +
                    Math.cos(angle) *
                    radius;

                node.y =
                    groupCenter.y +
                    Math.sin(angle) *
                    radius;
            }


            placed.add(
                bestNode
            );
        }


        // ----------------------------------------------------
        // IMPROVE POSITION USING CONNECTIONS
        // ----------------------------------------------------

        /*
            This is NOT physics.

            It is simply a few deterministic
            passes that move a node toward the
            average position of its already-known
            neighbors.

            There is no animation and it only
            runs while creating the map.
        */

        for (
            let pass = 0;
            pass < 3;
            pass++
        ) {

            for (
                const nodeId
                of sortedNodes
            ) {

                const node =
                    siteMap.get(
                        nodeId
                    );

                const neighbors =
                    graph.get(
                        nodeId
                    );

                if (
                    !node ||
                    !neighbors ||
                    neighbors.size === 0
                ) {
                    continue;
                }


                let totalX = 0;
                let totalY = 0;
                let count = 0;


                for (
                    const neighborId
                    of neighbors
                ) {

                    const neighbor =
                        siteMap.get(
                            neighborId
                        );

                    if (!neighbor) {
                        continue;
                    }

                    totalX +=
                        neighbor.x;

                    totalY +=
                        neighbor.y;

                    count++;
                }


                if (count === 0) {
                    continue;
                }


                const averageX =
                    totalX / count;

                const averageY =
                    totalY / count;


                /*
                    Only move part of the way
                    toward the average.

                    This is a one-time layout
                    calculation, not a physics loop.
                */

                node.x =
                    node.x * 0.65 +
                    averageX * 0.35;

                node.y =
                    node.y * 0.65 +
                    averageY * 0.35;
            }
        }
    }


    // ========================================================
    // PREVENT HUGE OVERLAPS
    // ========================================================

    /*
        Lightweight deterministic overlap
        correction.

        It only runs once.
    */

    const minDistance = 55;

    for (
        let i = 0;
        i < sites.length;
        i++
    ) {

        const a =
            sites[i];

        for (
            let j = i + 1;
            j < sites.length;
            j++
        ) {

            const b =
                sites[j];


            const dx =
                b.x - a.x;

            const dy =
                b.y - a.y;

            const distance =
                Math.hypot(
                    dx,
                    dy
                );


            if (
                distance >=
                minDistance
            ) {
                continue;
            }


            /*
                Only separate them enough
                to avoid exact overlap.

                This is NOT an ongoing force.
            */

            let pushX;
            let pushY;


            if (
                distance < 0.001
            ) {

                pushX = 1;
                pushY = 0;

            } else {

                pushX =
                    dx / distance;

                pushY =
                    dy / distance;
            }


            const amount =
                (
                    minDistance -
                    distance
                ) / 2;


            a.x -=
                pushX * amount;

            a.y -=
                pushY * amount;

            b.x +=
                pushX * amount;

            b.y +=
                pushY * amount;
        }
    }


    // ========================================================
    // CENTER ENTIRE MAP
    // ========================================================

    let minX = Infinity;
    let maxX = -Infinity;

    let minY = Infinity;
    let maxY = -Infinity;


    for (const site of sites) {

        minX =
            Math.min(
                minX,
                site.x
            );

        maxX =
            Math.max(
                maxX,
                site.x
            );

        minY =
            Math.min(
                minY,
                site.y
            );

        maxY =
            Math.max(
                maxY,
                site.y
            );
    }


    const centerX =
        (minX + maxX) / 2;

    const centerY =
        (minY + maxY) / 2;


    for (const site of sites) {

        site.x -=
            centerX;

        site.y -=
            centerY;
    }


    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
}


// ============================================================
// WORLD → SCREEN
// ============================================================

function worldToScreen(x, y) {

    return {

        x:
            x * camera.zoom +
            window.innerWidth / 2 +
            camera.x,

        y:
            y * camera.zoom +
            window.innerHeight / 2 +
            camera.y
    };
}


// ============================================================
// SCREEN → WORLD
// ============================================================

function screenToWorld(x, y) {

    return {

        x:
            (
                x -
                window.innerWidth / 2 -
                camera.x
            ) /
            camera.zoom,

        y:
            (
                y -
                window.innerHeight / 2 -
                camera.y
            ) /
            camera.zoom
    };
}


// ============================================================
// DRAW
// ============================================================

function draw() {

    ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );

    drawConnections();

    drawSites();

    requestAnimationFrame(
        draw
    );
}


// ============================================================
// DRAW CONNECTIONS
// ============================================================

function drawConnections() {

    ctx.lineWidth = 1;

    for (const site of sites) {

        if (
            !Array.isArray(
                site.connections
            )
        ) {
            continue;
        }


        const a =
            worldToScreen(
                site.x,
                site.y
            );


        for (
            const connectionId
            of site.connections
        ) {

            const target =
                siteMap.get(
                    connectionId
                );

            if (!target) {
                continue;
            }


            const b =
                worldToScreen(
                    target.x,
                    target.y
                );


            if (
                (
                    a.x < -500 ||
                    a.x >
                        window.innerWidth + 500 ||
                    a.y < -500 ||
                    a.y >
                        window.innerHeight + 500
                ) &&
                (
                    b.x < -500 ||
                    b.x >
                        window.innerWidth + 500 ||
                    b.y < -500 ||
                    b.y >
                        window.innerHeight + 500
                )
            ) {
                continue;
            }


            ctx.strokeStyle =
                "#333";


            ctx.beginPath();

            ctx.moveTo(
                a.x,
                a.y
            );

            ctx.lineTo(
                b.x,
                b.y
            );

            ctx.stroke();
        }
    }
}


// ============================================================
// DRAW SITES
// ============================================================

function drawSites() {

    for (const site of sites) {

        const position =
            worldToScreen(
                site.x,
                site.y
            );


        if (
            position.x < -50 ||
            position.x >
                window.innerWidth + 50 ||
            position.y < -50 ||
            position.y >
                window.innerHeight + 50
        ) {
            continue;
        }


        let size =
            site === selectedSite
                ? 9
                : 5;


        if (
            camera.zoom < 0.5
        ) {

            size =
                site === selectedSite
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


        // ----------------------------------------------------
        // LABEL
        // ----------------------------------------------------

        if (
            camera.zoom > 0.7 ||
            site === selectedSite
        ) {

            ctx.fillStyle =
                "#ffffff";

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


// ============================================================
// FIND NODE UNDER MOUSE
// ============================================================

function findSiteAt(
    x,
    y
) {

    let closest = null;

    let closestDistance =
        Infinity;


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


        const hitRadius =
            Math.max(
                14,
                18 *
                Math.min(
                    camera.zoom,
                    1
                )
            );


        if (
            distance <
                hitRadius &&
            distance <
                closestDistance
        ) {

            closest =
                site;

            closestDistance =
                distance;
        }
    }


    return closest;
}


// ============================================================
// SELECT SITE
// ============================================================

function selectSite(site) {

    selectedSite =
        site;


    siteName.textContent =
        site.name || site.id;


    siteUrl.textContent =
        site.url || "";


    siteUrl.href =
        site.url || "#";


    const connectionIds =
        new Set();


    // Outgoing connections

    if (
        Array.isArray(
            site.connections
        )
    ) {

        for (
            const id
            of site.connections
        ) {

            if (
                siteMap.has(id)
            ) {

                connectionIds.add(
                    id
                );
            }
        }
    }


    // Incoming connections

    for (
        const otherSite
        of sites
    ) {

        if (
            !Array.isArray(
                otherSite.connections
            )
        ) {
            continue;
        }


        if (
            otherSite.connections.includes(
                site.id
            )
        ) {

            connectionIds.add(
                otherSite.id
            );
        }
    }


    const count =
        connectionIds.size;


    connectionsText.textContent =
        `${count} connection${
            count === 1
                ? ""
                : "s"
        }`;
}


// ============================================================
// MOUSE DRAGGING
// ============================================================

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

        if (!mouseDown) {
            return;
        }


        const dx =
            event.clientX -
            mouseStart.x;

        const dy =
            event.clientY -
            mouseStart.y;


        if (
            Math.abs(dx) > 4 ||
            Math.abs(dy) > 4
        ) {

            mouseMoved = true;
        }


        camera.x =
            cameraStart.x +
            dx;

        camera.y =
            cameraStart.y +
            dy;
    }
);


window.addEventListener(
    "mouseup",
    event => {

        if (!mouseDown) {
            return;
        }


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


// ============================================================
// ZOOM
// ============================================================

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


        camera.zoom *=
            zoomAmount;


        camera.zoom =
            Math.max(
                0.05,
                Math.min(
                    20,
                    camera.zoom
                )
            );


        const after =
            screenToWorld(
                mouseX,
                mouseY
            );


        camera.x +=
            (
                after.x -
                before.x
            ) *
            camera.zoom;


        camera.y +=
            (
                after.y -
                before.y
            ) *
            camera.zoom;

    },
    {
        passive: false
    }
);


// ============================================================
// TOUCH CONTROLS
// ============================================================

let touches = [];

let lastTouchCenter = null;

let lastTouchDistance = null;

let touchMoved = false;


function getTouchCenter(
    t1,
    t2
) {

    return {

        x:
            (
                t1.clientX +
                t2.clientX
            ) / 2,

        y:
            (
                t1.clientY +
                t2.clientY
            ) / 2
    };
}


function getTouchDistance(
    t1,
    t2
) {

    return Math.hypot(
        t1.clientX -
            t2.clientX,

        t1.clientY -
            t2.clientY
    );
}


canvas.addEventListener(
    "touchstart",
    event => {

        event.preventDefault();


        touches =
            Array.from(
                event.touches
            );


        touchMoved = false;


        if (
            touches.length === 1
        ) {

            lastTouchCenter = {

                x:
                    touches[0].clientX,

                y:
                    touches[0].clientY
            };


            lastTouchDistance =
                null;
        }

        else if (
            touches.length >= 2
        ) {

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
    {
        passive: false
    }
);


canvas.addEventListener(
    "touchmove",
    event => {

        event.preventDefault();


        touches =
            Array.from(
                event.touches
            );


        // Single finger pan

        if (
            touches.length === 1
        ) {

            const current = {

                x:
                    touches[0].clientX,

                y:
                    touches[0].clientY
            };


            if (!lastTouchCenter) {

                lastTouchCenter =
                    current;

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


            lastTouchCenter =
                current;
        }


        // Two finger zoom + pan

        else if (
            touches.length >= 2
        ) {

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
                        Math.min(
                            20,
                            camera.zoom
                        )
                    );


                const after =
                    screenToWorld(
                        center.x,
                        center.y
                    );


                camera.x +=
                    (
                        after.x -
                        before.x
                    ) *
                    camera.zoom;


                camera.y +=
                    (
                        after.y -
                        before.y
                    ) *
                    camera.zoom;


                touchMoved = true;
            }


            if (
                lastTouchCenter
            ) {

                camera.x +=
                    center.x -
                    lastTouchCenter.x;

                camera.y +=
                    center.y -
                    lastTouchCenter.y;
            }


            lastTouchCenter =
                center;

            lastTouchDistance =
                distance;
        }

    },
    {
        passive: false
    }
);


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
            Array.from(
                event.touches
            );


        if (
            touches.length === 0
        ) {

            lastTouchCenter =
                null;

            lastTouchDistance =
                null;

        } else if (
            touches.length === 1
        ) {

            lastTouchCenter = {

                x:
                    touches[0].clientX,

                y:
                    touches[0].clientY
            };

            lastTouchDistance =
                null;
        }

    },
    {
        passive: false
    }
);


// ============================================================
// SEARCH
// ============================================================

search.addEventListener(
    "input",
    () => {

        const query =
            search.value
                .toLowerCase()
                .trim();


        if (!query) {
            return;
        }


        const normalizedSites =
            sites.map(
                site => ({

                    site,

                    name:
                        (
                            site.name ||
                            site.id
                        ).toLowerCase()
                })
            );


        // Exact match

        let result =
            normalizedSites.find(
                item =>
                    item.name ===
                    query
            );


        // Starts with

        if (!result) {

            result =
                normalizedSites.find(
                    item =>
                        item.name.startsWith(
                            query
                        )
                );
        }


        // Contains

        if (!result) {

            result =
                normalizedSites.find(
                    item =>
                        item.name.includes(
                            query
                        )
                );
        }


        if (!result) {
            return;
        }


        const site =
            result.site;


        selectSite(site);


        // Center on result

        camera.x =
            -site.x *
            camera.zoom;

        camera.y =
            -site.y *
            camera.zoom;
    }
);
