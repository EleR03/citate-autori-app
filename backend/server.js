const express = require("express");
const cors    = require("cors");
const Joi     = require("joi");
const fs      = require("fs");   // modul pentru operații cu fișiere
const path    = require("path"); // modul pentru construirea căilor

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Directorul unde salvăm imaginile descărcate.
// path.join asigură compatibilitate cross-platform.
const IMAGES_DIR = path.join(__dirname, "images");

// Creăm directorul /images dacă nu există deja
// { recursive: true } previne eroarea dacă directorul există
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Servim fișierele statice din /images pe ruta /images/*
app.use("/images", express.static(IMAGES_DIR));
// ─────────────────────────────────────────────────────────────────────────────

const JSON_SERVER_URL = "http://localhost:3000/quotes";

const validateId = (req, res, next) => {
  if (isNaN(req.params.id)) {
    return res.status(400).json({ error: "invalid id format" });
  }
  next();
};

// ✅ imageUrl este opțional — poate fi string gol sau un path valid
const quoteSchema = Joi.object({
  author:   Joi.string().min(2).required(),
  quote:    Joi.string().min(5).required(),
  imageUrl: Joi.string().allow("").optional(),
});

app.get("/", (req, res) => {
  res.send("printing quotes API is running---");
});

// Extragem citatele
app.get("/api/quotes", async (req, res) => {
  try {
    const response = await fetch(JSON_SERVER_URL);
    const data     = await response.json();

    const { search } = req.query; // req.query conține parametrii din URL (?search=...)

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();

      // Filtrăm array-ul - includem citatul dacă termenul apare
      // în numele autorului SAU în textul citatului
      const filtered = data.filter(q =>
        q.author.toLowerCase().includes(term) ||
        q.quote.toLowerCase().includes(term)
      );

      return res.status(200).json(filtered);
    }

    // Fără parametru search → returnăm toate citatele
    res.status(200).json(data);
  } catch (error) {
    console.error("Eroare la preluarea citatelor:", error.message);
    res.status(500).json({ error: "Nu s-au putut prelua citatele." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotes/fetch-image
// Primește { author } din body, caută pe Wikipedia,
// descarcă imaginea și o salvează în /images/.
// Returnează URL-ul local al imaginii.
//
// ⚠️  Această rută trebuie definită ÎNAINTE de
// rutele cu parametru (:id) — altfel Express ar interpreta
// "fetch-image" ca un ID.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/quotes/fetch-image", async (req, res) => {
  const { author } = req.body;

  if (!author || !author.trim()) {
    return res.status(400).json({ error: "Numele autorului este obligatoriu." });
  }

  try {
    // Formatăm numele autorului pentru URL Wikipedia:
    // "Albert Einstein" → "Albert_Einstein"
    const wikiName = author.trim().replace(/\s+/g, "_");
    const wikiUrl  = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`;

    // Cerere către Wikipedia REST API
    // User-Agent este recomandat de Wikipedia pentru identificarea aplicației
    const wikiResponse = await fetch(wikiUrl, {
      headers: {
        "User-Agent": "PrintingQuotesApp/1.0",
      },
    });

    if (!wikiResponse.ok) {
      return res.status(404).json({
        error: `Autorul "${author}" nu a fost găsit pe Wikipedia.`,
      });
    }

    const wikiData = await wikiResponse.json();

    // Verificăm dacă pagina Wikipedia are o imagine thumbnail
    if (!wikiData.thumbnail?.source) {
      return res.status(404).json({
        error: `Nu există imagine disponibilă pentru "${author}" pe Wikipedia.`,
      });
    }

    const imageUrl = wikiData.thumbnail.source;

    // Determinăm extensia fișierului din URL (jpg, png, jpeg etc.)
    const ext = imageUrl.split(".").pop().split("?")[0].toLowerCase();

    // Numele fișierului local: "albert_einstein.jpg"
    // toLowerCase + replace spații = nume de fișier valid
    const fileName = `${author.trim().toLowerCase().replace(/\s+/g, "_")}.${ext}`;
    const filePath = path.join(IMAGES_DIR, fileName);

    // Dacă imaginea a fost descărcată anterior, o returnăm direct
    // fără a face o nouă cerere la Wikipedia
    if (fs.existsSync(filePath)) {
      console.log(`Imagine existentă returnată: ${fileName}`);
      return res.status(200).json({ imageUrl: `/images/${fileName}` });
    }

    // Descărcăm imaginea de la Wikipedia
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(500).json({ error: "Nu s-a putut descărca imaginea." });
    }

    // Convertim răspunsul într-un Buffer (date binare)
    const buffer = Buffer.from(await imgResponse.arrayBuffer());

    // Scriem fișierul pe disc în directorul /images
    fs.writeFileSync(filePath, buffer);
    console.log(`Imagine salvată: ${fileName}`);

    // Returnăm URL-ul local — Express servește /images/* ca static
    res.status(200).json({ imageUrl: `/images/${fileName}` });

  } catch (error) {
    console.error("Eroare la fetch-image:", error.message);
    res.status(500).json({ error: "Eroare internă la preluarea imaginii." });
  }
});

// Adaugă un nou citat
app.post("/api/quotes", async (req, res) => {
  const { error } = quoteSchema.validate(req.body);
  if (error) { return res.status(400).json({ error: error.details[0].message }); }

  try {
    const response = await fetch(JSON_SERVER_URL);
    const quotes   = await response.json();

    // generam un ID numeric (urmatorul numar disponibil)
    const newId    = quotes.length > 0 ? Math.max(...quotes.map(q => Number(q.id))) + 1 : 1;
    const newQuote = { id: newId.toString(), ...req.body };

    const postResponse = await fetch(JSON_SERVER_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newQuote),
    });

    const data = await postResponse.json();
    res.status(postResponse.status).json(data);
  } catch (error) {
    console.error("Error adding quote:", error);
    res.status(500).json({ error: "Failed to add quote" });
  }
});

// Actualizam un citat
app.put("/api/quotes/:id", validateId, async (req, res) => {
  const { error } = quoteSchema.validate(req.body);
  if (error) { return res.status(400).json({ error: error.details[0].message }); }

  try {
    const quoteId      = req.params.id;
    const updatedQuote = { id: quoteId, ...req.body };

    const response = await fetch(`${JSON_SERVER_URL}/${quoteId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updatedQuote),
    });

    if (!response.ok) { return res.status(404).json({ error: "quote not found" }); }

    const data          = await response.json();
    const reorderedData = { id: data.id, author: data.author, quote: data.quote };
    res.status(response.status).json(reorderedData);
  } catch (error) {
    console.error("Error updating quote:", error);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

// Stergem un citat
app.delete("/api/quotes/:id", validateId, async (req, res) => {
  try {
    const quoteId = req.params.id;

    const checkResponse = await fetch(`${JSON_SERVER_URL}/${quoteId}`);
    if (!checkResponse.ok) {
      return res.status(404).json({ error: "quote not found" });
    }

    await fetch(`${JSON_SERVER_URL}/${quoteId}`, { method: "DELETE" });
    res.status(200).json({ message: "Quote deleted successfully" });
  } catch (error) {
    console.error("Error deleting quote:", error);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serverul rulează la http://localhost:${PORT}`);
});
console.log("Server restarted");