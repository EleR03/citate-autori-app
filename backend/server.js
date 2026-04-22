// Încarcă variabilele din .env în process.env
require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const Joi     = require("joi");
const fs      = require("fs");
const path    = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const OpenAI = require("openai");
const openai = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN,
});

// ─────────────────────────────────────────────────────────────────────────────
const IMAGES_DIR = path.join(__dirname, "images");

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

app.use("/images", express.static(IMAGES_DIR));
// ─────────────────────────────────────────────────────────────────────────────

const JSON_SERVER_URL = "http://localhost:3000/quotes";

const validateId = (req, res, next) => {
  if (isNaN(req.params.id)) {
    return res.status(400).json({ error: "invalid id format" });
  }
  next();
};

const quoteSchema = Joi.object({
  author:   Joi.string().trim().min(2).required(),
  quote:    Joi.string().trim().min(5).required(),
  imageUrl: Joi.string().allow("").optional(),
  // categoria trebuie să fie una din valorile predefinite sau absentă
  category: Joi.string()
    .valid("intelepciune", "motivatie", "umor", "filosofie", "stiinta")
    .allow("")
    .optional(),
});

app.get("/", (req, res) => {
  res.send("printing quotes API is running---");
});

// GET /api/quotes?search=termen&category=motivatie
// Suportă filtrare simultană după search și category.
app.get("/api/quotes", async (req, res) => {
  try {
    const response = await fetch(JSON_SERVER_URL);
    const data     = await response.json();

    const { search, category } = req.query;

    let result = data;

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(q =>
        q.author.toLowerCase().includes(term) ||
        q.quote.toLowerCase().includes(term)
      );
    }

    if (category && category !== "all") {
      result = result.filter(q => q.category === category);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Eroare la preluarea citatelor:", error.message);
    res.status(500).json({ error: "Nu s-au putut prelua citatele." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotes/fetch-image
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/quotes/fetch-image", async (req, res) => {
  const { author } = req.body;

  if (!author || !author.trim()) {
    return res.status(400).json({ error: "Numele autorului este obligatoriu." });
  }

  try {
    const wikiName = author.trim().replace(/\s+/g, "_");
    const wikiUrl  = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`;

    const wikiResponse = await fetch(wikiUrl, {
      headers: { "User-Agent": "PrintingQuotesApp/1.0" },
    });

    if (!wikiResponse.ok) {
      return res.status(404).json({
        error: `Autorul "${author}" nu a fost găsit pe Wikipedia.`,
      });
    }

    const wikiData = await wikiResponse.json();

    if (!wikiData.thumbnail?.source) {
      return res.status(404).json({
        error: `Nu există imagine disponibilă pentru "${author}" pe Wikipedia.`,
      });
    }

    const imageUrl = wikiData.thumbnail.source;
    const ext      = imageUrl.split(".").pop().split("?")[0].toLowerCase();
    const fileName = `${author.trim().toLowerCase().replace(/\s+/g, "_")}.${ext}`;
    const filePath = path.join(IMAGES_DIR, fileName);

    if (fs.existsSync(filePath)) {
      return res.status(200).json({ imageUrl: `/images/${fileName}` });
    }

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(500).json({ error: "Nu s-a putut descărca imaginea." });
    }

    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    res.status(200).json({ imageUrl: `/images/${fileName}` });

  } catch (error) {
    console.error("Eroare la fetch-image:", error.message);
    res.status(500).json({ error: "Eroare internă la preluarea imaginii." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotes/generate-quote
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/quotes/generate-quote", async (req, res) => {
  const { author } = req.body;

  if (!author || !author.trim()) {
    return res.status(400).json({ error: "Numele autorului este obligatoriu." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ești un cunoscător în literatură și filosofie.
Generezi citate scurte, inspiraționale și autentice.
Răspunzi DOAR cu citatul, fără ghilimele, fără numele autorului,
fără explicații suplimentare. Maxim 2 propoziții.`,
        },
        {
          role: "user",
          content: `Scrie un citat autentic specific lui ${author.trim()}.
Dacă autorul are citate celebre cunoscute, folosește unul dintre ele.
Dacă nu, generează unul în stilul și filosofia sa.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const generatedQuote = completion.choices[0].message.content.trim();
    res.status(200).json({ quote: generatedQuote });

  } catch (error) {
    console.error("Eroare OpenAI:", error.message);
    if (error.status === 401) {
      return res.status(500).json({ error: "Cheie API OpenAI invalidă." });
    }
    res.status(500).json({ error: "Nu s-a putut genera citatul." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quotes/author-info
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/quotes/author-info", async (req, res) => {
  const { author } = req.body;

  if (!author || !author.trim()) {
    return res.status(400).json({ error: "Numele autorului este obligatoriu." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ești un asistent concis care descrie personalități istorice.
                    Răspunzi doar în limba română.
                    Răspunsul conține EXACT două propoziții scurte.
                    Menționezi: domeniul, perioada și contribuția principală.
                    Fără introduceri, fără "Sigur!", fără explicații extra.`,
        },
        {
          role: "user",
          content: `Descrie pe ${author.trim()} în exact 2 propoziții.`,
        },
      ],
      max_tokens: 120,
      temperature: 0.5,
    });

    const info = completion.choices[0].message.content.trim();
    res.status(200).json({ info });

  } catch (error) {
    console.error("Eroare author-info:", error.message);
    res.status(500).json({ error: "Nu s-au putut prelua informațiile." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTE CU :id (trebuie să fie DUPĂ toate rutele cu nume fixe)
// ─────────────────────────────────────────────────────────────────────────────

// Adaugă un nou citat
app.post("/api/quotes", async (req, res) => {
  const { error } = quoteSchema.validate(req.body);
  if (error) { return res.status(400).json({ error: error.details[0].message }); }

  try {
    const response = await fetch(JSON_SERVER_URL);
    const quotes   = await response.json();

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