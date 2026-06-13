const express = require("express");
const path = require("path");
const os = require("os");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");
require("dotenv").config();

faker.seed(20260613);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const POSTGRES_URL = process.env.POSTGRES_URL || "postgresql://postgres:postgres@127.0.0.1:5432/teoria_transpiratiei";
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/teoria_transpiratiei";

const rolePermissions = {
  Admin: { canCreate: true, canEdit: true, canDelete: true, canRead: true },
  Editor: { canCreate: false, canEdit: true, canDelete: false, canRead: true },
  Journalist: { canCreate: true, canEdit: false, canDelete: true, canRead: true },
  User: { canCreate: false, canEdit: false, canDelete: false, canRead: true },
};

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

const seededUsers = [
  { username: "admin", password: "admin123", role: "Admin", displayName: "Admin User" },
  { username: "editor", password: "editor123", role: "Editor", displayName: "Editor User" },
  { username: "journalist", password: "journalist123", role: "Journalist", displayName: "Journalist User" },
  { username: "user", password: "user123", role: "User", displayName: "Reader User" },
];

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    summary: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

const Article = mongoose.model("Article", articleSchema);
const postgresPool = new Pool({ connectionString: POSTGRES_URL });

function serializeUser(user) {
  return {
    id: user.sub || String(user.id),
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.display_name,
  };
}

function serializeArticleDocument(article) {
  return {
    id: article._id.toString(),
    title: article.title,
    category: article.category,
    author: article.author,
    date: new Date(article.date).toISOString().slice(0, 10),
    summary: article.summary,
    content: article.content,
  };
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

function validateArticlePayload(payload) {
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

function authenticateRequest(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_error) {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireReadPermission(req, res, next) {
  const permissions = rolePermissions[req.user.role];

  if (!permissions?.canRead) {
    res.status(403).json({ message: "You are not allowed to view articles." });
    return;
  }

  next();
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    const permissions = rolePermissions[req.user.role];

    if (!permissions?.[permissionKey]) {
      res.status(403).json({ message: "You are not allowed to perform this action." });
      return;
    }

    next();
  };
}

async function ensurePostgresSchema() {
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureSeedUsers() {
  for (const user of seededUsers) {
    const existing = await postgresPool.query("SELECT id FROM users WHERE username = $1", [user.username]);

    if (existing.rowCount > 0) {
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 10);
    await postgresPool.query(
      "INSERT INTO users (username, password_hash, role, display_name) VALUES ($1, $2, $3, $4)",
      [user.username, passwordHash, user.role, user.displayName],
    );
  }
}

async function ensureSeedArticles() {
  const existingArticles = await Article.countDocuments();
  if (existingArticles > 0) {
    return;
  }

  const seededArticles = Array.from({ length: 8 }, () => {
    const publishedAt = faker.date.between({
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-06-13T00:00:00.000Z",
    });

    return {
      title: faker.helpers.arrayElement(articleTopics),
      category: faker.helpers.arrayElement(articleCategories),
      author: faker.person.fullName(),
      date: publishedAt,
      summary: faker.lorem.sentences({ min: 2, max: 3 }),
      content: faker.lorem.paragraphs({ min: 3, max: 5 }, "\n\n"),
    };
  });

  await Article.insertMany(seededArticles);
}

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

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required." });
      return;
    }

    const result = await postgresPool.query(
      "SELECT id, username, password_hash, role, display_name FROM users WHERE username = $1",
      [username],
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ message: "Invalid username or password." });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid username or password." });
      return;
    }

    const payload = {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
    res.json({
      token,
      user: serializeUser(payload),
      permissions: rolePermissions[user.role],
    });
  });

  app.get("/api/auth/me", authenticateRequest, (req, res) => {
    res.json({
      user: serializeUser(req.user),
      permissions: rolePermissions[req.user.role],
    });
  });

  app.get("/api/articles", authenticateRequest, requireReadPermission, async (_req, res) => {
    const articles = await Article.find().sort({ date: -1, createdAt: -1 }).lean();
    res.json(articles.map(serializeArticleDocument));
  });

  app.get("/api/articles/:id", authenticateRequest, requireReadPermission, async (req, res) => {
    const article = await Article.findById(req.params.id).lean();

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    res.json(serializeArticleDocument(article));
  });

  app.post("/api/articles", authenticateRequest, requirePermission("canCreate"), async (req, res) => {
    const payload = normalizeArticlePayload(req.body);
    const validationError = validateArticlePayload(payload);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const article = await Article.create({
      ...payload,
      date: new Date(payload.date),
    });

    res.status(201).json(serializeArticleDocument(article));
  });

  app.put("/api/articles/:id", authenticateRequest, requirePermission("canEdit"), async (req, res) => {
    const payload = normalizeArticlePayload(req.body);
    const validationError = validateArticlePayload(payload);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const article = await Article.findByIdAndUpdate(
      req.params.id,
      {
        ...payload,
        date: new Date(payload.date),
      },
      { new: true, runValidators: true },
    );

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    res.json(serializeArticleDocument(article));
  });

  app.delete("/api/articles/:id", authenticateRequest, requirePermission("canDelete"), async (req, res) => {
    const article = await Article.findByIdAndDelete(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    res.json(serializeArticleDocument(article));
  });

  app.use(express.static(path.join(__dirname, "frontend")));
  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  });

  return app;
}

async function startServer() {
  await mongoose.connect(MONGODB_URL);
  await ensurePostgresSchema();
  await ensureSeedUsers();
  await ensureSeedArticles();

  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://localhost:${PORT}`);

    const lanUrls = getLanUrls(PORT);
    if (lanUrls.length) {
      console.log("LAN URLs:");
      lanUrls.forEach((url) => console.log(`  ${url}`));
    }

    console.log("Using PostgreSQL for users/auth and MongoDB for articles.");
    console.log("Seeded users:");
    seededUsers.forEach((user) => console.log(`  ${user.username} / ${user.password} (${user.role})`));
  });
}

startServer().catch((error) => {
  console.error("Failed to start server.");
  console.error(error);
  process.exit(1);
});
