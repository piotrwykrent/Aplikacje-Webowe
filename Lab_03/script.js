const czas = document.getElementById("czas");
const start = document.getElementById("start");
const stop = document.getElementById("stop");
const reset = document.getElementById("reset");

let sekundy = 0;
let interwal = null;

function formatujCzas(calyCzas) {
  if (calyCzas < 60) {
    return calyCzas + "s";
  } else {
    let minuty = Math.floor(calyCzas / 60);
    let sek = calyCzas % 60;
    return minuty + "min " + sek + "s";
  }
}

function aktualizujCzas() {
  czas.innerText = formatujCzas(sekundy);
}
start.addEventListener("click", () => {
  if (!interwal) {
    interwal = setInterval(() => {
      sekundy++;
      aktualizujCzas();
    }, 1000);
  }
});

stop.addEventListener("click", () => {
  clearInterval(interwal);
  interwal = null;
});

reset.addEventListener("click", () => {
  clearInterval(interwal);
  interwal = null;
  sekundy = 0;
  aktualizujCzas();
});

//Cw 2

const generate = document.getElementById("generate");
generate.addEventListener("click", () => {
  const minLength = parseInt(document.getElementById("minLength").value);
  const maxLength = parseInt(document.getElementById("maxLength").value);
  const uppercase = document.getElementById("uppercase").checked;
  const specialChars = document.getElementById("specialChars").checked;

  if (
    isNaN(minLength) ||
    isNaN(maxLength) ||
    minLength <= 0 ||
    minLength > maxLength
  ) {
    alert("Podaj poprawne długości hasła (min <= max, większe od 0)!");
    return;
  }

  let dostepneZnaki = "abcdefghijklmnopqrstuvwxyz0123456789";
  const wielkieLitery = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const znakiSpecjalne = "!@#$%^&*()_+~|}{[]:;?><,./-=";
  let wymagane = "";

  if (uppercase) {
    dostepneZnaki += wielkieLitery;
    wymagane += wielkieLitery[Math.floor(Math.random() * wielkieLitery.length)];
  }
  if (specialChars) {
    dostepneZnaki += znakiSpecjalne;
    wymagane +=
      znakiSpecjalne[Math.floor(Math.random() * znakiSpecjalne.length)];
  }
  if (maxLength < wymagane.length) {
    alert("Maksymalna długość jest za mała dla wybranych opcji!");
    return;
  }

  const realMin = Math.max(minLength, wymagane.length);
  const finalLength =
    Math.floor(Math.random() * (maxLength - realMin + 1)) + realMin;

  let haslo = wymagane;
  for (let i = wymagane.length; i < finalLength; i++) {
    const losowyIndeks = Math.floor(Math.random() * dostepneZnaki.length);
    haslo += dostepneZnaki[losowyIndeks];
  }

  const znaki = haslo.split("");
  for (let i = znaki.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [znaki[i], znaki[j]] = [znaki[j], znaki[i]];
  }
  alert(znaki.join(""));
});

//cw 3
const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("fraza");
const sortSelect = document.getElementById("filtrowanie");

let oryginalneProdukty = [];
let aktualneProdukty = [];

async function pobierzProdukty() {
  const odpowiedz = await fetch("https://dummyjson.com/products?limit=30");
  const dane = await odpowiedz.json();

  oryginalneProdukty = dane.products;
  aktualneProdukty = [...oryginalneProdukty];

  renderujTabele(aktualneProdukty);
}

function renderujTabele(produkty) {
  tableBody.innerHTML = "";

  produkty.forEach((produkt) => {
    const tr = document.createElement("tr");

    const tdZdjecie = document.createElement("td");
    const img = document.createElement("img");
    img.src = produkt.thumbnail;
    tdZdjecie.appendChild(img);

    const tdTytul = document.createElement("td");
    tdTytul.innerText = produkt.title;

    const tdOpis = document.createElement("td");
    tdOpis.innerText = produkt.description;

    tr.appendChild(tdZdjecie);
    tr.appendChild(tdTytul);
    tr.appendChild(tdOpis);

    tableBody.appendChild(tr);
  });
}

function filtrujISortuj() {
  const szukanaFraza = searchInput.value.toLowerCase();

  let przefiltrowane = oryginalneProdukty.filter(
    (produkt) =>
      produkt.title.toLowerCase().includes(szukanaFraza) ||
      produkt.description.toLowerCase().includes(szukanaFraza),
  );

  const trybSortowania = sortSelect.value;

  if (trybSortowania === "asc") {
    przefiltrowane.sort((a, b) => a.title.localeCompare(b.title));
  } else if (trybSortowania === "desc") {
    przefiltrowane.sort((a, b) => b.title.localeCompare(a.title));
  }

  renderujTabele(przefiltrowane);
}

searchInput.addEventListener("input", filtrujISortuj);
sortSelect.addEventListener("change", filtrujISortuj);

pobierzProdukty();
