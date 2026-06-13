const express = require("express");
const path = require("path");
const os = require("os");
const { faker } = require("@faker-js/faker");

faker.seed(20260613);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json());

const articleTopics = [
  "Student journalism becomes a meeting place for ideas",
  "Classrooms, communities, and the rhythm of school life",
  "What a modern school newspaper can still do well",
  "Digital editorial work connects students and teachers",
  "How UBB initiatives inspire pre-university communities",
  "The role of reflection in academic and cultural life",
];

const articleCategories = [
  "Campus",
  "Education",
  "Culture",
  "Opinion",
  "Research",
  "Student Life",
];

let articles = Array.from({ length: 8 }, (_, index) => createArticle(index));

function createArticle(index) {
  const publishedAt = faker.date.between({
    from: "2026-05-01T00:00:00.000Z",
    to: "2026-06-13T00:00:00.000Z",
  });

  return {
    id: `${index + 1}-${faker.string.alphanumeric(10)}`,
    title: faker.helpers.arrayElement(articleTopics),
    category: faker.helpers.arrayElement(articleCategories),
    author: faker.person.fullName(),
    date: publishedAt.toISOString().slice(0, 10),
    summary: faker.lorem.sentences({ min: 2, max: 3 }),
    content: faker.lorem.paragraphs({ min: 3, max: 5 }, "\n\n"),
  };
}

function sortArticlesDescending(list) {
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function normalizeArticlePayload(body) {
  return {
    title: String(body.title || "").trim(),
    category: String(body.category || "").trim(),
    author: String(body.author || "").trim(),
    date: String(body.date || "").trim(),
    summary: String(body.summary || "").trim(),
    content: String(body.content || "").trim(),
  };
}

function validateArticle(payload) {
  const requiredFields = ["title", "category", "author", "date", "summary", "content"];
  const missingField = requiredFields.find((field) => !payload[field]);

  if (missingField) {
    return `Field "${missingField}" is required.`;
  }

  if (Number.isNaN(new Date(payload.date).getTime())) {
    return 'Field "date" must be a valid date.';
  }

  return null;
}

app.get("/api/articles", (_req, res) => {
  res.json(sortArticlesDescending(articles));
});

app.get("/api/articles/:id", (req, res) => {
  const article = articles.find((entry) => entry.id === req.params.id);

  if (!article) {
    res.status(404).json({ message: "Article not found." });
    return;
  }

  res.json(article);
});

app.post("/api/articles", (req, res) => {
  const payload = normalizeArticlePayload(req.body);
  const validationError = validateArticle(payload);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const article = {
    id: faker.string.alphanumeric(12),
    ...payload,
  };

  articles.unshift(article);
  res.status(201).json(article);
});

app.put("/api/articles/:id", (req, res) => {
  const payload = normalizeArticlePayload(req.body);
  const validationError = validateArticle(payload);

  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const articleIndex = articles.findIndex((entry) => entry.id === req.params.id);

  if (articleIndex === -1) {
    res.status(404).json({ message: "Article not found." });
    return;
  }

  const updatedArticle = {
    ...articles[articleIndex],
    ...payload,
  };

  articles[articleIndex] = updatedArticle;
  res.json(updatedArticle);
});

app.delete("/api/articles/:id", (req, res) => {
  const articleIndex = articles.findIndex((entry) => entry.id === req.params.id);

  if (articleIndex === -1) {
    res.status(404).json({ message: "Article not found." });
    return;
  }

  const [deletedArticle] = articles.splice(articleIndex, 1);
  res.json(deletedArticle);
});

app.use(express.static(path.join(__dirname, "frontend")));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const adapter of Object.values(interfaces)) {
    for (const address of adapter || []) {
      if (address.family === "IPv4" && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }

  return urls;
}

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://localhost:${PORT}`);

  const lanUrls = getLanUrls(PORT);
  if (lanUrls.length) {
    console.log("LAN URLs:");
    lanUrls.forEach((url) => console.log(`  ${url}`));
  }

  console.log("Data is stored in memory only and resets when the server restarts.");
});
