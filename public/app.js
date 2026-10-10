const list = document.querySelector("#notes");
const form = document.querySelector("#new-note");
const status = document.querySelector("#status");

async function api(path, init) {
  const res = await fetch(path, init);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(`${data.error} (request ${data.requestId})`);
  return data;
}

function render(notes) {
  list.replaceChildren(
    ...notes.map((n) => {
      const li = document.createElement("li");
      const h = document.createElement("strong");
      h.textContent = n.title;
      const p = document.createElement("p");
      p.textContent = n.body;
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.onclick = async () => {
        await api(`/api/notes/${encodeURIComponent(n.id)}`, { method: "DELETE" });
        load();
      };
      li.append(h, p, del);
      return li;
    }),
  );
}

async function load() {
  try {
    render((await api("/api/notes")).notes);
    status.textContent = "";
  } catch (err) {
    status.textContent = err.message;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  try {
    await api("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    form.reset();
    load();
  } catch (err) {
    status.textContent = err.message;
  }
});

load();
