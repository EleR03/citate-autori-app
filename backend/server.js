const express = require("express");
const cors= require("cors");
const Joi = require("joi");
const fs = require("fs"); // modul pentru operații cu fişiere
const path = require("path"); // modul pentru construirea căilor

const app = express(); // creează instanţa aplicației Express
app.use(cors()); // activează CORS - orice client poate face cereri
app.use(express.json()); //middleware care parsează automat corpul

const JSON_SERVER_URL= "http://localhost:3000/quotes";

// verificam daca id-ul din PUT si DELETE este un numar valid
const validateId = (req, res, next) => {
  if (isNaN(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  next();
};

// Schema Joi pentru validarea citatelor
const quoteSchema = Joi.object({
  author: Joi.string().min(2).required(),
  quote: Joi.string().min(5).required(),
});

// API route placeholder
app.get("/", (req, res) => {
  res.send("Printing Quotes API is running...");
});
// Extragem citatele
app.get("/api/quotes", async (req, res) => {
try {
const response = await fetch(JSON_SERVER_URL);
const data  = await response.json();
res.json(data);
} catch (error) {
console.error("Eroare la preluarea citatelor:", error);
res.status(500).json({ error: "Nu s-au putut prelua citatele" });
}
});

//Adauga un nou citat
app.post("/api/quotes", async (req, res) => {
  const { error } = quoteSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const response = await fetch(JSON_SERVER_URL);
    const quotes = await response.json();

    // generam un ID numeric (urmatorul numar disponibil)
    const numericIds = quotes.map(q => Number(q.id)).filter(id => !isNaN(id));
    const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

    const newQuote = { id: newId.toString(), ...req.body };

    // trimite la json-server
    const postResponse = await fetch(JSON_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newQuote),
    });

    const data = await postResponse.json();
    res.status(201).json(data);
  } catch (error) {
    console.error("Error adding quote:", error);
    res.status(500).json({ error: "Failed to add quote" });
  }
});

// Actualizam un citat
// Actualizam un citat
app.put("/api/quotes/:id", validateId, async (req, res) => {
  const { error } = quoteSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const quoteId = req.params.id;
    const updatedQuote = { id: quoteId, ...req.body };

    const response = await fetch(`${JSON_SERVER_URL}/${quoteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedQuote),
    });

    if (!response.ok) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const data = await response.json();
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
      return res.status(404).json({ error: "Quote not found" });
    }

    await fetch(`${JSON_SERVER_URL}/${quoteId}`, { method: "DELETE" });
    res.status(200).json({ message: "Quote deleted successfully" });
  } catch (error) {
    console.error("Error deleting quote:", error);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

// Pornim serverul
const port = 5000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

// Verificam repornirea automata a serverului
console.log("Server restarted!");






// let quotes= [{id:1, author: "Socrates", qoute:"The only true wisdom..."},
//  {id:2, author: "Albert Einstein", qoute:"The only true wisdom..."}   
// ]
// app.get("/api/quotes", (req, res)=>{
//     res.status(200).json(quotes);
// });

// app.post("/api/quotes", (req, res) =>{
// const {author, quote}= req.body;
// const newQuote ={
// id: quotes.length + 1, // Generäm un ID unic
// author,
// quote};
// quotes.push(newQuote);
// res.status(201).json(newQuote);
// });

// app.put("/api/quotes/:id", (req, res)=> {
// const id= parseInt(req.params.id);
// const { author, quote}= req.body;
// const index =quotes.findIndex(q=> q.id ==id);
// if (index== -1) {
// // 404 Not Found citatul cu 10-ul respectiv nu există
// return res.status(404).json({message: "Citatul nu a fost găsit."});
// }
// // Actualizăn intrarea păstrand ID-ul neschimbat
// quotes [index] ={id, author, quote};
// res.status(200).json(quotes [index]);});

// app.delete("/api/quotes/:id", (req, res)=> {
// const id= parseInt(req.params.id);
// const index =quotes.findIndex(q=> q.id == id);
// if (index == -1) {
// return res.status(404).json({message: "Citatul nu a fost găsit." });
// }
// quotes.splice(index, 1);
// res.status(200).json({ message: "Citatul a fost şters cu succes." });
// });


// app.get("/", (req, res)=> {
// res.json({
// message: "Citate Autori API functioneaza...",
// endpoints: {
// quotes: "/api/quotes",
// health: "/api/health"
// }
// });
// });



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serverul ruleaza la http://localhost:${PORT}`);
});

console.log("Server restarted");