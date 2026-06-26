
const items = [
    {
        title: "Image Resizer",
        image: "https://frostcat224.github.io/frostcatgameswebsite/img/unknown.png",
        url: "https://frostcat224.github.io/frostcatgameswebsite/filetools/imageresizer/",
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
