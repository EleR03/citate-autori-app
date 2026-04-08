// URL-ul de bază al backend-ului Express.
const BASE_URL = "http://localhost:5000/api/quotes";

// GET /api/quotes
export async function getAllQuotes(search = "") {
  const url = search.trim()
    ? `${BASE_URL}?search=${encodeURIComponent(search.trim())}`
    : BASE_URL;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Nu s-au putut prelua citatele.");
  return response.json();
}

// POST /api/quotes – adaugă un citat nou
export async function addQuote(quoteData) {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quoteData),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.errors?.join(", ") || "Nu s-a putut adăuga citatul.");
  }
  return response.json();
}

// POST /api/quotes/fetch-image – imagine autor
export async function fetchAuthorImage(author) {
  const response = await fetch(
    `${BASE_URL.replace("/quotes", "")}/quotes/fetch-image`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Nu s-a putut prelua imaginea.");
  }
  return response.json();
}

// ─────────────────────────────────────────────────────────────
// POST /api/quotes/author-info  ← CODUL DIN IMAGINE INTEGRAT
// Returnează o descriere scurtă despre autor generată de AI.
// Apelată din QuoteCard la hover pe numele autorului.
// ─────────────────────────────────────────────────────────────
export async function fetchAuthorInfo(author) {
  const response = await fetch(
    `${BASE_URL.replace("/quotes", "")}/quotes/author-info`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    }
  );

  if (!response.ok) {
    throw new Error("Nu s-au putut prelua informațiile despre autor.");
  }

  return response.json(); // { text: "..." }
}

// POST /api/quotes/generate-quote – generează un citat AI
export async function generateQuote(author) {
  const response = await fetch(
    `${BASE_URL.replace("/quotes", "")}/quotes/generate-quote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Nu s-a putut genera citatul.");
  }

  return response.json(); // { quote: "..." }
}

// PUT /api/quotes/:id – actualizează citat
export async function updateQuote(id, quoteData) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quoteData),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.errors?.join(", ") || "Nu s-a putut actualiza citatul.");
  }
  return response.json();
}

// DELETE /api/quotes/:id – șterge citat
export async function deleteQuote(id) {
  const response = await fetch(`${BASE_URL}/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Nu s-a putut șterge citatul.");
}
