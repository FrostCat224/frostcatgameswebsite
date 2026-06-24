
const items = [
    {
        title: "Moechat",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/moechat.png",
        url: "https://frostcat224.github.io/moechat",
        size: "wide"
    },
    {
        title: "Find the Breadsellers",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/breadseller.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/ftbs",
        size: "square"
    },
    {
        title: "Zoek de Bo's",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/zoekdebos.png",
        url: "https://turbowarp.org/886364357",
        size: "square"
    },
    {
        title: "Illegal Minecraft World",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/netherportalblock.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/minecraft/illegalworld.html",
        size: "square"
    },
];

const container = document.getElementById("dynamicBoxes");

items.forEach(item => {
    const box = document.createElement("a");

    box.href = item.url;
    box.className = `game-box ${item.size}`;

    box.innerHTML = `
        <img src="${item.image}" alt="${item.title}">
        <div class="game-title">${item.title}</div>
    `;

    container.appendChild(box);
});
