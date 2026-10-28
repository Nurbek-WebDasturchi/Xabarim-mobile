// using on index.html
const days = document.querySelector("#day"),
  hours = document.querySelector("#hour"),
  seconds = document.querySelector("#second");
const deadline = "2026-11-19";
function getTime(deadline) {
  let days, hours, seconds;
  const time = Date.parse(deadline) - Date.parse(new Date());
  if (time < 0) {
    days = 0;
    hours = 0;
    seconds = 0;
  } else {
    days = Math.floor(time / (1000 * 60 * 60 * 24)); // kun
    hours = Math.floor((time / (1000 * 60 * 60)) % 24); // soat
    seconds = Math.floor((time / 1000) % 60); // seconds
  }
  return { totalTime: time, days, hours, seconds };
}
function formatNumber(number) {
  if (number >= 0 && number < 10) {
    return `0${number}`;
  } else {
    return number;
  }
}
function setClock() {
  const timeInterval = setInterval(updateClock, 1000);
  updateClock();
  function updateClock() {
    const displayedTime = getTime(deadline);
    days.textContent = formatNumber(displayedTime.days);
    hours.textContent = formatNumber(displayedTime.hours);
    seconds.textContent = formatNumber(displayedTime.seconds);

    if (displayedTime.totalTime <= 0) {
      clearInterval(timeInterval);
    }
  }
}
setClock();
