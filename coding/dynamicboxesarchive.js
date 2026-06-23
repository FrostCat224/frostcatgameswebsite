
const items = [
    {
        title: "Find the Breadsellers",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/breadseller.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/ftbs",
        size: "wide"
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
