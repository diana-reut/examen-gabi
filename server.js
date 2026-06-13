const express = require("express");
const path = require("path");
const os = require("os");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");
const validation = require("./shared/validation");
require("dotenv").config();

faker.seed(20260613);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const POSTGRES_URL = process.env.POSTGRES_URL || "postgresql://postgres:postgres@127.0.0.1:5432/teoria_transpiratiei";
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/teoria_transpiratiei";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "teoria-transpiratiei";

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 8,
  },
});

const rolePermissions = {
  Admin: {
    canCreateArticle: true,
    canManageArticle: true,
    canWriteParagraphs: true,
    canComment: true,
    canDeleteArticle: true,
    articleScope: "all",
  },
  Editor: {
    canCreateArticle: true,
    canManageArticle: true,
    canWriteParagraphs: false,
    canComment: true,
    canDeleteArticle: false,
    articleScope: "created",
  },
  Journalist: {
    canCreateArticle: false,
    canManageArticle: false,
    canWriteParagraphs: true,
    canComment: false,
    canDeleteArticle: false,
    articleScope: "assigned",
  },
  User: {
    canCreateArticle: false,
    canManageArticle: false,
    canWriteParagraphs: false,
    canComment: false,
    canDeleteArticle: false,
    articleScope: "finished",
  },
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
  { username: "editor2", password: "editor223", role: "Editor", displayName: "Mara Editor" },
  { username: "editor3", password: "editor323", role: "Editor", displayName: "Paul Editor" },
  { username: "journalist", password: "journalist123", role: "Journalist", displayName: "Journalist User" },
  { username: "journalist2", password: "journalist223", role: "Journalist", displayName: "Ana Journalist" },
  { username: "journalist3", password: "journalist323", role: "Journalist", displayName: "Victor Journalist" },
  { username: "journalist4", password: "journalist423", role: "Journalist", displayName: "Teo Journalist" },
  { username: "user", password: "user123", role: "User", displayName: "Reader User" },
  { username: "user2", password: "user223", role: "User", displayName: "Bianca Reader" },
  { username: "user3", password: "user323", role: "User", displayName: "Radu Reader" },
  { username: "user4", password: "user423", role: "User", displayName: "Ioana Reader" },
  { username: "user5", password: "user523", role: "User", displayName: "Matei Reader" },
  { username: "user6", password: "user623", role: "User", displayName: "Daria Reader" },
];

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: true, versionKey: false },
);

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    resolvedById: { type: String, default: "" },
    resolvedByName: { type: String, default: "" },
  },
  { _id: true, versionKey: false },
);

const paragraphSchema = new mongoose.Schema(
  {
    text: { type: String, default: "", trim: true },
    images: { type: [imageSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    createdByUserId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByUserId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true, versionKey: false },
);

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    author: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now },
    summary: { type: String, default: "", trim: true },
    assignedJournalistIds: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "finished"], default: "draft" },
    likedByUserIds: { type: [String], default: [] },
    dislikedByUserIds: { type: [String], default: [] },
    articleComments: { type: [commentSchema], default: [] },
    paragraphs: { type: [paragraphSchema], default: [] },
    createdByUserId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    finishedByEditorId: { type: String, default: "" },
    finishedByEditorName: { type: String, default: "" },
    finishedAt: { type: Date, default: null },
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

function serializePermissions(role) {
  return rolePermissions[role];
}

function serializeParagraph(paragraph) {
  return {
    id: paragraph._id.toString(),
    text: paragraph.text,
    images: (paragraph.images || []).map((image) => ({
      id: image._id.toString(),
      url: image.url,
      publicId: image.publicId,
      width: image.width,
      height: image.height,
    })),
    comments: (paragraph.comments || []).map((comment) => ({
      id: comment._id.toString(),
      text: comment.text,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorRole: comment.authorRole,
      createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : null,
      resolved: Boolean(comment.resolved),
      resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt).toISOString() : null,
      resolvedById: comment.resolvedById || "",
      resolvedByName: comment.resolvedByName || "",
    })),
    createdByUserId: paragraph.createdByUserId,
    createdByName: paragraph.createdByName,
    updatedByUserId: paragraph.updatedByUserId,
    updatedByName: paragraph.updatedByName,
    updatedAt: paragraph.updatedAt ? new Date(paragraph.updatedAt).toISOString() : null,
  };
}

function serializeArticleDocument(article, userDirectory = new Map(), viewer = null) {
  const assignedJournalists = (article.assignedJournalistIds || [])
    .map((id) => userDirectory.get(String(id)))
    .filter(Boolean);
  const likedByUserIds = (article.likedByUserIds || []).map((id) => String(id));
  const dislikedByUserIds = (article.dislikedByUserIds || []).map((id) => String(id));
  const viewerId = viewer ? String(viewer.sub) : "";
  const userReaction = viewerId
    ? likedByUserIds.includes(viewerId)
      ? "like"
      : dislikedByUserIds.includes(viewerId)
        ? "dislike"
        : "none"
    : "none";

  return {
    id: article._id.toString(),
    title: article.title,
    category: article.category,
    author: article.author,
    date: new Date(article.date).toISOString().slice(0, 10),
    summary: article.summary,
    status: article.status,
    likes: likedByUserIds.length,
    dislikes: dislikedByUserIds.length,
    userReaction,
    assignedJournalistIds: article.assignedJournalistIds || [],
    assignedJournalists,
    createdByUserId: article.createdByUserId,
    createdByName: article.createdByName,
    createdByRole: article.createdByRole,
    finishedByEditorName: article.finishedByEditorName || "",
    finishedAt: article.finishedAt ? new Date(article.finishedAt).toISOString() : null,
    articleComments: viewer
      ? (article.articleComments || []).map((comment) => ({
          id: comment._id.toString(),
          text: comment.text,
          authorId: comment.authorId,
          authorName: comment.authorName,
          authorRole: comment.authorRole,
          createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : null,
        }))
      : [],
    paragraphs: (article.paragraphs || []).map(serializeParagraph),
  };
}

function normalizeAssignedJournalistIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
}

function normalizeArticleCreatePayload(body) {
  return {
    title: validation.normalizeString(body.title),
    category: validation.normalizeString(body.category),
    author: validation.normalizeString(body.author),
    date: validation.normalizeString(body.date) || new Date().toISOString().slice(0, 10),
    summary: validation.normalizeString(body.summary),
    assignedJournalistIds: normalizeAssignedJournalistIds(body.assignedJournalistIds),
  };
}

function normalizeArticleManagePayload(body) {
  return {
    title: validation.normalizeString(body.title),
    category: validation.normalizeString(body.category),
    author: validation.normalizeString(body.author),
    date: validation.normalizeString(body.date),
    summary: validation.normalizeString(body.summary),
    assignedJournalistIds: normalizeAssignedJournalistIds(body.assignedJournalistIds),
    status: body.status === "finished" ? "finished" : "draft",
  };
}

function normalizeParagraphPayload(body) {
  return {
    text: validation.normalizeString(body.text),
    images: Array.isArray(body.images)
      ? body.images
          .map((image) => ({
            url: String(image.url || "").trim(),
            publicId: String(image.publicId || "").trim(),
            width: image.width ?? null,
            height: image.height ?? null,
          }))
          .filter((image) => image.url && image.publicId)
      : [],
  };
}

function validateArticleCreatePayload(payload) {
  return validation.firstError(validation.validateArticleCreatePayload(payload));
}

function validateArticleManagePayload(payload) {
  return validation.firstError(validation.validateArticleManagePayload(payload));
}

function validateParagraphPayload(payload) {
  return validation.firstError(validation.validateParagraphPayload(payload));
}

function validateFinishedArticle(article) {
  if (!article.title || !article.author || !article.date) {
    return "Finished articles must have a title, author, and date.";
  }

  if (!article.paragraphs || !article.paragraphs.length) {
    return "Finished articles must have at least one paragraph.";
  }

  const hasEmptyParagraph = article.paragraphs.some((paragraph) => !paragraph.text);
  if (hasEmptyParagraph) {
    return "Finished articles cannot contain empty paragraphs.";
  }

  const hasUnresolvedComments = article.paragraphs.some((paragraph) =>
    (paragraph.comments || []).some((comment) => !comment.resolved),
  );
  if (hasUnresolvedComments) {
    return "All editor comments must be solved before finishing the article.";
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

function authenticateRequestIfPresent(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    req.user = null;
    next();
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireCapability(capability) {
  return (req, res, next) => {
    const permissions = serializePermissions(req.user.role);

    if (!permissions?.[capability]) {
      res.status(403).json({ message: "You are not allowed to perform this action." });
      return;
    }

    next();
  };
}

function buildArticleVisibilityFilter(user) {
  if (!user) {
    return { status: "finished" };
  }

  if (user.role === "Editor") {
    return { createdByUserId: String(user.sub) };
  }

  if (user.role === "Journalist") {
    return { assignedJournalistIds: String(user.sub) };
  }

  if (user.role === "User") {
    return { status: "finished" };
  }

  return {};
}

function canManageArticle(article, user) {
  if (user.role === "Admin") {
    return true;
  }

  return user.role === "Editor" && article.createdByUserId === String(user.sub);
}

function canWriteParagraphs(article, user) {
  if (user.role === "Admin") {
    return true;
  }

  return user.role === "Journalist" && (article.assignedJournalistIds || []).includes(String(user.sub));
}

function canViewArticle(article, user) {
  if (!user) {
    return article.status === "finished";
  }

  if (user.role === "Admin") {
    return true;
  }

  if (user.role === "Editor") {
    return article.createdByUserId === String(user.sub);
  }

  if (user.role === "Journalist") {
    return (article.assignedJournalistIds || []).includes(String(user.sub));
  }

  return article.status === "finished";
}

function canCommentOnParagraph(article, user) {
  if (user.role === "Admin") {
    return true;
  }

  return user.role === "Editor" && article.createdByUserId === String(user.sub);
}

function canCommentOnArticle(article, user) {
  return Boolean(user) && canViewArticle(article, user);
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

async function getUsersByRole(role) {
  const result = await postgresPool.query(
    "SELECT id, username, role, display_name FROM users WHERE role = $1 ORDER BY display_name ASC",
    [role],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    username: row.username,
    role: row.role,
    displayName: row.display_name,
  }));
}

async function getUserDirectoryByIds(userIds) {
  const normalizedIds = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)))];

  if (!normalizedIds.length) {
    return new Map();
  }

  const result = await postgresPool.query(
    "SELECT id, username, role, display_name FROM users WHERE id = ANY($1::int[])",
    [normalizedIds],
  );

  return new Map(
    result.rows.map((row) => [
      String(row.id),
      {
        id: String(row.id),
        username: row.username,
        role: row.role,
        displayName: row.display_name,
      },
    ]),
  );
}

async function serializeArticlesWithAssignments(articles) {
  const userIds = articles.flatMap((article) => article.assignedJournalistIds || []);
  const directory = await getUserDirectoryByIds(userIds);
  return articles.map((article) => serializeArticleDocument(article, directory));
}

function buildArticleStatistics(articles) {
  const finishedArticles = articles.filter((article) => article.status === "finished");

  const items = finishedArticles.map((article) => {
    const likes = (article.likedByUserIds || []).length;
    const dislikes = (article.dislikedByUserIds || []).length;
    const totalReactions = likes + dislikes;

    return {
      id: article._id.toString(),
      title: article.title,
      status: article.status,
      category: article.category,
      likes,
      dislikes,
      totalReactions,
      approvalScore: totalReactions ? Number(((likes / totalReactions) * 100).toFixed(1)) : 0,
    };
  });

  const totals = items.reduce(
    (accumulator, item) => {
      accumulator.likes += item.likes;
      accumulator.dislikes += item.dislikes;
      accumulator.totalReactions += item.totalReactions;
      return accumulator;
    },
    { likes: 0, dislikes: 0, totalReactions: 0 },
  );

  return {
    totals: {
      ...totals,
      finishedArticles: items.length,
    },
    mostLiked: [...items].sort((left, right) => right.likes - left.likes || right.totalReactions - left.totalReactions).slice(0, 5),
    mostDisliked: [...items].sort((left, right) => right.dislikes - left.dislikes || right.totalReactions - left.totalReactions).slice(0, 5),
    articles: [...items].sort((left, right) => right.totalReactions - left.totalReactions || right.likes - left.likes),
  };
}

async function ensureSeedArticles() {
  const existingArticles = await Article.countDocuments();
  if (existingArticles > 0) {
    return;
  }

  const journalists = await getUsersByRole("Journalist");
  const editors = await getUsersByRole("Editor");

  if (!journalists.length || !editors.length) {
    return;
  }

  const seededArticles = Array.from({ length: 10 }, (_, index) => {
    const publishedAt = faker.date.between({
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-06-13T00:00:00.000Z",
    });

    const assigned = faker.helpers.arrayElements(journalists, faker.number.int({ min: 1, max: 2 }));
    const editor = faker.helpers.arrayElement(editors);
    const finished = index % 3 !== 0;

    return {
      title: faker.helpers.arrayElement(articleTopics),
      category: faker.helpers.arrayElement(articleCategories),
      author: faker.person.fullName(),
      date: publishedAt,
      summary: faker.lorem.sentences({ min: 2, max: 3 }),
      assignedJournalistIds: assigned.map((journalist) => journalist.id),
      status: finished ? "finished" : "draft",
      paragraphs: [
        {
          text: faker.lorem.paragraphs({ min: 1, max: 2 }, "\n\n"),
          images: [],
          comments: [],
          createdByUserId: assigned[0].id,
          createdByName: assigned[0].displayName,
          updatedByUserId: assigned[0].id,
          updatedByName: assigned[0].displayName,
          updatedAt: new Date(),
        },
      ],
      createdByUserId: editor.id,
      createdByName: editor.displayName,
      createdByRole: editor.role,
      finishedByEditorId: finished ? editor.id : "",
      finishedByEditorName: finished ? editor.displayName : "",
      finishedAt: finished ? new Date() : null,
    };
  });

  await Article.insertMany(seededArticles);
}

async function ensureArticleStructureDefaults() {
  const articles = await Article.find();

  if (!articles.length) {
    return;
  }

  const fallbackJournalists = await getUsersByRole("Journalist");
  const fallbackEditor = (await getUsersByRole("Editor"))[0];

  for (const article of articles) {
    let changed = false;

    if (!article.assignedJournalistIds || !article.assignedJournalistIds.length) {
      const assigned = faker.helpers.arrayElements(fallbackJournalists, faker.number.int({ min: 1, max: 2 }));
      article.assignedJournalistIds = assigned.map((entry) => entry.id);
      changed = true;
    }

    if (!Array.isArray(article.likedByUserIds)) {
      article.likedByUserIds = [];
      changed = true;
    }

    if (!Array.isArray(article.dislikedByUserIds)) {
      article.dislikedByUserIds = [];
      changed = true;
    }

    if (!Array.isArray(article.articleComments)) {
      article.articleComments = [];
      changed = true;
    }

    if (!article.createdByUserId && fallbackEditor) {
      article.createdByUserId = fallbackEditor.id;
      article.createdByName = fallbackEditor.displayName;
      article.createdByRole = fallbackEditor.role;
      changed = true;
    }

    if (!Array.isArray(article.paragraphs)) {
      article.paragraphs = [];
      changed = true;
    }

    if (!article.paragraphs.length && article.content) {
      article.paragraphs = [
        {
          text: article.content,
          images: [],
          comments: [],
          createdByUserId: article.assignedJournalistIds[0] || "",
          createdByName: "",
          updatedByUserId: article.assignedJournalistIds[0] || "",
          updatedByName: "",
          updatedAt: new Date(),
        },
      ];
      changed = true;
    }

    if (article.status === "finished" && !article.finishedByEditorName && fallbackEditor) {
      article.finishedByEditorId = fallbackEditor.id;
      article.finishedByEditorName = fallbackEditor.displayName;
      article.finishedAt = article.finishedAt || new Date();
      changed = true;
    }

    if (changed) {
      await article.save();
    }
  }
}

function ensureCloudinaryConfigured() {
  return CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET;
}

async function uploadBufferToCloudinary(fileBuffer, originalName, mimeType) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: "image",
        public_id: `${Date.now()}-${originalName.replace(/\.[^.]+$/, "")}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width || null,
          height: result.height || null,
          mimeType,
        });
      },
    );

    uploadStream.end(fileBuffer);
  });
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
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/login", async (req, res) => {
    const username = validation.normalizeString(req.body.username);
    const password = String(req.body.password || "");
    const loginValidationError = validation.firstError(validation.validateLoginPayload({ username, password }));

    if (loginValidationError) {
      res.status(400).json({ message: loginValidationError });
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
      permissions: serializePermissions(user.role),
    });
  });

  app.get("/api/auth/me", authenticateRequest, (req, res) => {
    res.json({
      user: serializeUser(req.user),
      permissions: serializePermissions(req.user.role),
    });
  });

  app.get("/api/journalists", authenticateRequest, requireCapability("canManageArticle"), async (_req, res) => {
    res.json(await getUsersByRole("Journalist"));
  });

  app.get("/api/statistics/articles", authenticateRequest, async (req, res) => {
    if (req.user.role !== "Admin") {
      res.status(403).json({ message: "Only admins can see article statistics." });
      return;
    }

    const articles = await Article.find().sort({ date: -1, createdAt: -1 }).lean();
    res.json(buildArticleStatistics(articles));
  });

  app.get("/api/articles", authenticateRequestIfPresent, async (req, res) => {
    const articles = await Article.find(buildArticleVisibilityFilter(req.user))
      .sort({ date: -1, createdAt: -1 })
      .lean();
    const userIds = new Set();

    for (const article of articles) {
      for (const id of article.assignedJournalistIds || []) {
        userIds.add(String(id));
      }
    }

    const directory = await getUserDirectoryByIds([...userIds]);
    res.json(articles.map((article) => serializeArticleDocument(article, directory, req.user)));
  });

  app.get("/api/articles/:id", authenticateRequestIfPresent, async (req, res) => {
    const article = await Article.findById(req.params.id).lean();

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canViewArticle(article, req.user)) {
      res.status(403).json({ message: "You are not allowed to view this article." });
      return;
    }

    const directory = await getUserDirectoryByIds(article.assignedJournalistIds || []);
    res.json(serializeArticleDocument(article, directory, req.user));
  });

  app.post("/api/articles/:id/comments", authenticateRequest, async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canCommentOnArticle(article, req.user)) {
      res.status(403).json({ message: "You can only comment on articles that you can view." });
      return;
    }

    const text = validation.normalizeString(req.body.text);
    const commentValidationError = validation.firstError(validation.validateCommentPayload({ text }));
    if (commentValidationError) {
      res.status(400).json({ message: commentValidationError });
      return;
    }

    article.articleComments.push({
      text,
      authorId: String(req.user.sub),
      authorName: req.user.displayName,
      authorRole: req.user.role,
      createdAt: new Date(),
      resolved: false,
      resolvedAt: null,
      resolvedById: "",
      resolvedByName: "",
    });

    await article.save();
    const savedComment = article.articleComments[article.articleComments.length - 1];
    res.status(201).json({
      id: savedComment._id.toString(),
      text: savedComment.text,
      authorId: savedComment.authorId,
      authorName: savedComment.authorName,
      authorRole: savedComment.authorRole,
      createdAt: new Date(savedComment.createdAt).toISOString(),
    });
  });

  app.patch("/api/articles/:id/reaction", authenticateRequest, async (req, res) => {
    if (req.user.role !== "User") {
      res.status(403).json({ message: "Only users can like or dislike articles." });
      return;
    }

    const article = await Article.findById(req.params.id);
    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canViewArticle(article, req.user) || article.status !== "finished") {
      res.status(403).json({ message: "You can only react to finished articles that you can view." });
      return;
    }

    const reaction = req.body.reaction;
    const reactionValidationError = validation.firstError(validation.validateReactionPayload({ reaction }));
    if (reactionValidationError) {
      res.status(400).json({ message: reactionValidationError });
      return;
    }

    const userId = String(req.user.sub);
    article.likedByUserIds = (article.likedByUserIds || []).map((id) => String(id)).filter((id) => id !== userId);
    article.dislikedByUserIds = (article.dislikedByUserIds || []).map((id) => String(id)).filter((id) => id !== userId);

    if (reaction === "like") {
      article.likedByUserIds.push(userId);
    } else if (reaction === "dislike") {
      article.dislikedByUserIds.push(userId);
    }

    await article.save();

    const directory = await getUserDirectoryByIds(article.assignedJournalistIds || []);
    res.json(serializeArticleDocument(article, directory, req.user));
  });

  app.post("/api/articles", authenticateRequest, requireCapability("canCreateArticle"), async (req, res) => {
    const payload = normalizeArticleCreatePayload(req.body);
    const validationError = validateArticleCreatePayload(payload);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const validJournalists = await getUserDirectoryByIds(payload.assignedJournalistIds);
    if (validJournalists.size !== payload.assignedJournalistIds.length) {
      res.status(400).json({ message: "All assigned users must be valid journalists." });
      return;
    }

    const article = await Article.create({
      ...payload,
      date: new Date(payload.date),
      status: "draft",
      paragraphs: [],
      createdByUserId: String(req.user.sub),
      createdByName: req.user.displayName,
      createdByRole: req.user.role,
      finishedByEditorId: "",
      finishedByEditorName: "",
      finishedAt: null,
    });

    res.status(201).json(serializeArticleDocument(article, validJournalists));
  });

  app.patch("/api/articles/:id", authenticateRequest, requireCapability("canManageArticle"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canManageArticle(article, req.user)) {
      res.status(403).json({ message: "You can only manage articles that you created." });
      return;
    }

    const payload = normalizeArticleManagePayload(req.body);
    const validationError = validateArticleManagePayload(payload);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const validJournalists = await getUserDirectoryByIds(payload.assignedJournalistIds);
    if (validJournalists.size !== payload.assignedJournalistIds.length) {
      res.status(400).json({ message: "All assigned users must be valid journalists." });
      return;
    }

    article.title = payload.title;
    article.category = payload.category;
    article.author = payload.author;
    article.date = new Date(payload.date);
    article.summary = payload.summary;
    article.assignedJournalistIds = payload.assignedJournalistIds;
    article.status = payload.status;

    if (payload.status === "finished") {
      const finishedValidationError = validateFinishedArticle(article);
      if (finishedValidationError) {
        res.status(400).json({ message: finishedValidationError });
        return;
      }

      article.finishedByEditorId = String(req.user.sub);
      article.finishedByEditorName = req.user.displayName;
      article.finishedAt = new Date();
    } else {
      article.finishedByEditorId = "";
      article.finishedByEditorName = "";
      article.finishedAt = null;
    }

    await article.save();
    res.json(serializeArticleDocument(article, validJournalists));
  });

  app.delete("/api/articles/:id", authenticateRequest, requireCapability("canDeleteArticle"), async (req, res) => {
    const article = await Article.findByIdAndDelete(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    const directory = await getUserDirectoryByIds(article.assignedJournalistIds || []);
    res.json(serializeArticleDocument(article, directory));
  });

  app.post("/api/articles/:id/uploads", authenticateRequest, requireCapability("canWriteParagraphs"), upload.array("images", 8), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canWriteParagraphs(article, req.user)) {
      res.status(403).json({ message: "You can only upload images for assigned articles." });
      return;
    }

    if (!ensureCloudinaryConfigured()) {
      res.status(500).json({ message: "Cloudinary is not configured yet." });
      return;
    }

    const files = req.files || [];
    if (!files.length) {
      res.status(400).json({ message: "Please upload at least one image." });
      return;
    }

    const uploads = await Promise.all(
      files.map((file) => uploadBufferToCloudinary(file.buffer, file.originalname, file.mimetype)),
    );

    res.status(201).json({
      images: uploads.map((image) => ({
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
      })),
    });
  });

  app.post("/api/articles/:id/paragraphs", authenticateRequest, requireCapability("canWriteParagraphs"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canWriteParagraphs(article, req.user)) {
      res.status(403).json({ message: "You can only write on articles assigned to you." });
      return;
    }

    const payload = normalizeParagraphPayload(req.body);
    const validationError = validateParagraphPayload(payload);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    article.paragraphs.push({
      text: payload.text,
      images: payload.images,
      comments: [],
      createdByUserId: String(req.user.sub),
      createdByName: req.user.displayName,
      updatedByUserId: String(req.user.sub),
      updatedByName: req.user.displayName,
      updatedAt: new Date(),
    });

    await article.save();
    const savedParagraph = article.paragraphs[article.paragraphs.length - 1];
    res.status(201).json(serializeParagraph(savedParagraph));
  });

  app.put("/api/articles/:id/paragraphs/:paragraphId", authenticateRequest, requireCapability("canWriteParagraphs"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canWriteParagraphs(article, req.user)) {
      res.status(403).json({ message: "You can only edit paragraphs for assigned articles." });
      return;
    }

    const paragraph = article.paragraphs.id(req.params.paragraphId);
    if (!paragraph) {
      res.status(404).json({ message: "Paragraph not found." });
      return;
    }

    const payload = normalizeParagraphPayload(req.body);
    const validationError = validateParagraphPayload(payload);

    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    paragraph.text = payload.text;
    paragraph.images = payload.images;
    paragraph.updatedByUserId = String(req.user.sub);
    paragraph.updatedByName = req.user.displayName;
    paragraph.updatedAt = new Date();

    await article.save();
    res.json(serializeParagraph(paragraph));
  });

  app.delete("/api/articles/:id/paragraphs/:paragraphId", authenticateRequest, requireCapability("canWriteParagraphs"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canWriteParagraphs(article, req.user)) {
      res.status(403).json({ message: "You can only delete paragraphs for assigned articles." });
      return;
    }

    const paragraph = article.paragraphs.id(req.params.paragraphId);
    if (!paragraph) {
      res.status(404).json({ message: "Paragraph not found." });
      return;
    }

    paragraph.deleteOne();
    await article.save();
    res.json({ id: req.params.paragraphId });
  });

  app.patch("/api/articles/:id/paragraph-order", authenticateRequest, requireCapability("canManageArticle"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canManageArticle(article, req.user)) {
      res.status(403).json({ message: "You can only reorder paragraphs on articles that you created." });
      return;
    }

    const orderedParagraphIds = Array.isArray(req.body.paragraphIds)
      ? req.body.paragraphIds.map((id) => String(id))
      : [];

    if (orderedParagraphIds.length !== article.paragraphs.length) {
      res.status(400).json({ message: "The new order must include every paragraph exactly once." });
      return;
    }

    const paragraphMap = new Map(article.paragraphs.map((paragraph) => [paragraph._id.toString(), paragraph]));
    const reordered = [];

    for (const paragraphId of orderedParagraphIds) {
      const paragraph = paragraphMap.get(paragraphId);
      if (!paragraph) {
        res.status(400).json({ message: "Invalid paragraph order." });
        return;
      }
      reordered.push(paragraph);
    }

    article.paragraphs = reordered;
    await article.save();

    const directory = await getUserDirectoryByIds(article.assignedJournalistIds || []);
    res.json(serializeArticleDocument(article, directory));
  });

  app.post("/api/articles/:id/paragraphs/:paragraphId/comments", authenticateRequest, requireCapability("canComment"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canCommentOnParagraph(article, req.user)) {
      res.status(403).json({ message: "You can only comment on articles that you created." });
      return;
    }

    const paragraph = article.paragraphs.id(req.params.paragraphId);
    if (!paragraph) {
      res.status(404).json({ message: "Paragraph not found." });
      return;
    }

    const text = validation.normalizeString(req.body.text);
    const commentValidationError = validation.firstError(validation.validateCommentPayload({ text }));
    if (commentValidationError) {
      res.status(400).json({ message: commentValidationError });
      return;
    }

    paragraph.comments.push({
      text,
      authorId: String(req.user.sub),
      authorName: req.user.displayName,
      authorRole: req.user.role,
      createdAt: new Date(),
      resolved: false,
      resolvedAt: null,
      resolvedById: "",
      resolvedByName: "",
    });

    await article.save();
    const savedComment = paragraph.comments[paragraph.comments.length - 1];
    res.status(201).json({
      id: savedComment._id.toString(),
      text: savedComment.text,
      authorId: savedComment.authorId,
      authorName: savedComment.authorName,
      authorRole: savedComment.authorRole,
      createdAt: new Date(savedComment.createdAt).toISOString(),
      resolved: false,
      resolvedAt: null,
      resolvedById: "",
      resolvedByName: "",
    });
  });

  app.patch("/api/articles/:id/paragraphs/:paragraphId/comments/:commentId/resolve", authenticateRequest, requireCapability("canComment"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canCommentOnParagraph(article, req.user)) {
      res.status(403).json({ message: "You can only resolve comments on articles that you created." });
      return;
    }

    const paragraph = article.paragraphs.id(req.params.paragraphId);
    if (!paragraph) {
      res.status(404).json({ message: "Paragraph not found." });
      return;
    }

    const comment = paragraph.comments.id(req.params.commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found." });
      return;
    }

    comment.resolved = true;
    comment.resolvedAt = new Date();
    comment.resolvedById = String(req.user.sub);
    comment.resolvedByName = req.user.displayName;

    await article.save();
    res.json({
      id: comment._id.toString(),
      resolved: true,
      resolvedAt: new Date(comment.resolvedAt).toISOString(),
      resolvedById: comment.resolvedById,
      resolvedByName: comment.resolvedByName,
    });
  });

  app.delete("/api/articles/:id/paragraphs/:paragraphId/comments/:commentId", authenticateRequest, requireCapability("canComment"), async (req, res) => {
    const article = await Article.findById(req.params.id);

    if (!article) {
      res.status(404).json({ message: "Article not found." });
      return;
    }

    if (!canCommentOnParagraph(article, req.user)) {
      res.status(403).json({ message: "You can only manage comments on articles that you created." });
      return;
    }

    const paragraph = article.paragraphs.id(req.params.paragraphId);
    if (!paragraph) {
      res.status(404).json({ message: "Paragraph not found." });
      return;
    }

    const comment = paragraph.comments.id(req.params.commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found." });
      return;
    }

    comment.deleteOne();
    await article.save();
    res.json({ id: req.params.commentId });
  });

  app.use("/shared", express.static(path.join(__dirname, "shared")));
  app.use(express.static(path.join(__dirname, "frontend")));
  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: "Image too large. Maximum size is 8 MB per file." });
        return;
      }

      res.status(400).json({ message: error.message || "Upload failed." });
      return;
    }

    if (error?.http_code && error?.message) {
      res.status(400).json({ message: `Cloudinary upload failed: ${error.message}` });
      return;
    }

    res.status(500).json({ message: "Internal server error." });
  });

  return app;
}

async function startServer() {
  await mongoose.connect(MONGODB_URL);
  await ensurePostgresSchema();
  await ensureSeedUsers();
  await ensureSeedArticles();
  await ensureArticleStructureDefaults();

  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://localhost:${PORT}`);

    const lanUrls = getLanUrls(PORT);
    if (lanUrls.length) {
      console.log("LAN URLs:");
      lanUrls.forEach((url) => console.log(`  ${url}`));
    }

    console.log("Using PostgreSQL for users/auth, MongoDB for articles, and Cloudinary for images.");
    console.log("Seeded users:");
    seededUsers.forEach((user) => console.log(`  ${user.username} / ${user.password} (${user.role})`));
  });
}

module.exports = {
  createApp,
  startServer,
  Article,
  postgresPool,
  seededUsers,
  buildArticleStatistics,
  validateArticleCreatePayload,
  validateArticleManagePayload,
  validateParagraphPayload,
  validateFinishedArticle,
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server.");
    console.error(error);
    process.exit(1);
  });
}
