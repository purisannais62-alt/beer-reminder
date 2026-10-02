async function loadStats() {
  const counter = document.getElementById("subscriber-count");

  try {
    const response = await fetch("/api/stats");

    if (!response.ok) {
      throw new Error("Не вдалося завантажити статистику");
    }

    const data = await response.json();
    counter.textContent = Number(data.subscribers).toLocaleString("uk-UA");
  } catch (error) {
    counter.textContent = "—";
    console.error(error);
  }
}

loadStats();