const body = document.querySelector("body");
const modeIcon = document.querySelector("#mode-icon");
if (!localStorage.getItem("mode")) {
  localStorage.setItem("mode", "light");
}
const savedMode = localStorage.getItem("mode");
if (savedMode === "dark") {
  body.classList.add("dark-mode");
  modeIcon.classList.replace("bi-moon-stars-fill", "bi-brightness-high-fill");
}
modeIcon.addEventListener("click", () => {
  body.classList.toggle("dark-mode");

  if (modeIcon.classList.contains("bi-moon-stars-fill")) {
    modeIcon.classList.replace("bi-moon-stars-fill", "bi-brightness-high-fill");
  } else {
    modeIcon.classList.replace("bi-brightness-high-fill", "bi-moon-stars-fill");
  }
  // hozirgi holatni saqlash
  if (body.classList.contains("dark-mode")) {
    localStorage.setItem("mode", "dark");
  } else {
    localStorage.setItem("mode", "light");
  }
});
