const formularz = document.querySelector("form");
const poleImie = document.getElementById("imie");
const poleEmail = document.getElementById("email");
const poleTemat = document.getElementById("temat");
const poleWiadomosc = document.getElementById("wiadomosc");

const komunikat = document.createElement("p");
komunikat.style.display = "none";
komunikat.style.marginTop = "15px";
komunikat.style.fontWeight = "bold";
formularz.appendChild(komunikat);

const zapisaneImie = localStorage.getItem("zapamietaneImie");
if (zapisaneImie) {
  poleImie.value = zapisaneImie;
}

formularz.addEventListener("submit", function (event) {
  event.preventDefault();

  const imie = poleImie.value.trim();
  const email = poleEmail.value.trim();
  const temat = poleTemat.value;
  const wiadomosc = poleWiadomosc.value.trim();

  if (imie === "" || email === "" || temat === "" || wiadomosc === "") {
    komunikat.style.display = "block";
    komunikat.style.color = "#900000";
    komunikat.innerText = "Wszystkie pola są wymagane!";
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    komunikat.style.display = "block";
    komunikat.style.color = "#900000";
    komunikat.innerText = "Podaj poprawny adres e-mail";
    return;
  }

  localStorage.setItem("zapamietaneImie", imie);

  komunikat.style.display = "block";
  komunikat.style.color = "#c8dfdb";
  komunikat.innerText = "Wiadomość wysłana";

  poleEmail.value = "";
  poleTemat.value = "";
  poleWiadomosc.value = "";
});
