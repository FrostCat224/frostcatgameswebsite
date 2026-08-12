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

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);

resize();


// Load data
fetch("data.json")
    .then(response => response.json())
    .then(data => {

        sites = data.sites;

        // Create fast ID lookup
        for (const site of sites) {
            siteMap.set(site.id, site);
        }

        createPositions();

        draw();
    })
    .catch(error => {
        console.error("Could not load data.json:", error);
    });


// Create initial positions
function createPositions() {

    const radius = Math.max(200, sites.length * 40);

    sites.forEach((site, index) => {

        const angle =
            (index / sites.length) * Math.PI * 2;

        site.x = Math.cos(angle) * radius;
        site.y = Math.sin(angle) * radius;

    });
}


// Convert world coordinates to screen coordinates
function worldToScreen(x, y) {

    return {
        x: x * camera.zoom +
           canvas.width / 2 +
           camera.x,

        y: y * camera.zoom +
           canvas.height / 2 +
           camera.y
    };
}


// Draw everything
function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawConnections();
    drawSites();

    requestAnimationFrame(draw);
}


// Draw connections
function drawConnections() {

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#333";

    for (const site of sites) {

        const a = worldToScreen(site.x, site.y);

        for (const connectionId of site.connections) {

            const target = siteMap.get(connectionId);

            if (!target) continue;

            const b =
                worldToScreen(target.x, target.y);

            ctx.beginPath();

            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);

            ctx.stroke();
        }
    }
}


// Draw websites
function drawSites() {

    for (const site of sites) {

        const position =
            worldToScreen(site.x, site.y);

        // Don't draw things outside the screen
        if (
            position.x < -50 ||
            position.x > canvas.width + 50 ||
            position.y < -50 ||
            position.y > canvas.height + 50
        ) {
            continue;
        }

        const size =
            site === selectedSite
                ? 9
                : 5;

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

        // Labels only when zoomed in
        if (camera.zoom > 0.8) {

            ctx.fillStyle = "white";
            ctx.font = "12px Arial";

            ctx.fillText(
                site.name,
                position.x + 8,
                position.y + 4
            );
        }
    }
}


// Click detection
canvas.addEventListener("click", event => {

    const rect = canvas.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    for (const site of sites) {

        const position =
            worldToScreen(site.x, site.y);

        const distance = Math.hypot(
            mouseX - position.x,
            mouseY - position.y
        );

        if (distance < 12) {

            selectSite(site);

            break;
        }
    }
});


// Show website information
function selectSite(site) {

    selectedSite = site;

    siteName.textContent = site.name;

    siteUrl.textContent = site.url;
    siteUrl.href = site.url;

    connectionsText.textContent =
        `${site.connections.length} connections`;
}


// Zoom
canvas.addEventListener("wheel", event => {

    event.preventDefault();

    const zoomAmount =
        event.deltaY < 0 ? 1.1 : 0.9;

    camera.zoom *= zoomAmount;

    camera.zoom =
        Math.max(0.1, Math.min(10, camera.zoom));
}, { passive: false });


// Search
search.addEventListener("input", () => {

    const query =
        search.value.toLowerCase().trim();

    if (!query) return;

    const result = sites.find(site =>
        site.name.toLowerCase().includes(query)
    );

    if (result) {

        selectedSite = result;

        camera.x =
            -result.x * camera.zoom;

        camera.y =
            -result.y * camera.zoom;
    }
});