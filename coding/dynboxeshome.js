
const items = [
    {
        title: "Moechat",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/moechat.png",
        url: "https://frostcat224.github.io/moechat",
        size: "square"
    },
    {
        title: "Find the Breadsellers",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/breadseller.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/ftbs",
        size: "square"
    },
    {
        title: "Vote for Everything",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/vote.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/voteforeverything/",
        size: "square"
    },
    {
        title: "Elemental Quadrillion",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/elementalquadrillion.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/elementalquadrillion/",
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
