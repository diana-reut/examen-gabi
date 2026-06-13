const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp, Article, postgresPool } = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

function createSortLeanResult(data) {
  return {
    sort() {
      return {
        lean: async () => data,
      };
    },
  };
}

const originalMethods = {
  query: postgresPool.query,
  find: Article.find,
  findById: Article.findById,
  create: Article.create,
  findByIdAndDelete: Article.findByIdAndDelete,
};

function restoreMethods() {
  postgresPool.query = originalMethods.query;
  Article.find = originalMethods.find;
  Article.findById = originalMethods.findById;
  Article.create = originalMethods.create;
  Article.findByIdAndDelete = originalMethods.findByIdAndDelete;
}

test.afterEach(() => {
  restoreMethods();
});

test("POST /api/auth/login validates missing credentials before querying the database", async () => {
  let called = false;
  postgresPool.query = async () => {
    called = true;
    return { rowCount: 0, rows: [] };
  };

  const app = createApp();
  const response = await request(app).post("/api/auth/login").send({ username: "", password: "" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Username is required.");
  assert.equal(called, false);
});

test("GET /api/articles allows guest access to finished articles with reaction totals", async () => {
  const article = {
    _id: { toString: () => "article-1" },
    title: "Finished article",
    category: "Campus",
    author: "Author",
    date: new Date("2026-06-13"),
    summary: "Summary",
    status: "finished",
    likedByUserIds: ["10", "11"],
    dislikedByUserIds: ["12"],
    assignedJournalistIds: ["7"],
    createdByUserId: "2",
    createdByName: "Editor",
    createdByRole: "Editor",
    finishedByEditorName: "Editor",
    finishedAt: new Date("2026-06-13"),
    paragraphs: [],
  };

  Article.find = (filter) => {
    assert.deepEqual(filter, { status: "finished" });
    return createSortLeanResult([article]);
  };

  postgresPool.query = async () => ({
    rows: [{ id: 7, username: "journalist2", role: "Journalist", display_name: "Ana Journalist" }],
  });

  const app = createApp();
  const response = await request(app).get("/api/articles");

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].likes, 2);
  assert.equal(response.body[0].dislikes, 1);
  assert.equal(response.body[0].userReaction, "none");
});

test("POST /api/articles rejects invalid editor payload", async () => {
  const token = signToken({ sub: "2", username: "editor", role: "Editor", displayName: "Editor User" });
  const app = createApp();

  const response = await request(app)
    .post("/api/articles")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "",
      date: "2026-06-13",
      assignedJournalistIds: [],
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Field "title" is required.');
});

test("PATCH /api/articles/:id/reaction rejects invalid reactions", async () => {
  const token = signToken({ sub: "20", username: "user", role: "User", displayName: "Reader User" });

  Article.findById = async () => ({
    _id: { toString: () => "article-2" },
    status: "finished",
    assignedJournalistIds: ["7"],
    likedByUserIds: [],
    dislikedByUserIds: [],
    save: async () => {},
  });

  const app = createApp();
  const response = await request(app)
    .patch("/api/articles/article-2/reaction")
    .set("Authorization", `Bearer ${token}`)
    .send({ reaction: "love" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Field "reaction" must be "like", "dislike", or "none".');
});

test("POST /api/articles/:id/paragraphs rejects empty paragraph text", async () => {
  const token = signToken({ sub: "7", username: "journalist2", role: "Journalist", displayName: "Ana Journalist" });

  Article.findById = async () => ({
    _id: { toString: () => "article-3" },
    assignedJournalistIds: ["7"],
    paragraphs: [],
  });

  const app = createApp();
  const response = await request(app)
    .post("/api/articles/article-3/paragraphs")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "   ", images: [] });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Field "text" is required.');
});

test("GET /api/statistics/articles only counts finished articles", async () => {
  const token = signToken({ sub: "1", username: "admin", role: "Admin", displayName: "Admin User" });

  Article.find = () =>
    createSortLeanResult([
      {
        _id: { toString: () => "finished-1" },
        title: "Finished",
        status: "finished",
        category: "Campus",
        likedByUserIds: ["1", "2"],
        dislikedByUserIds: ["3"],
      },
      {
        _id: { toString: () => "draft-1" },
        title: "Draft",
        status: "draft",
        category: "Campus",
        likedByUserIds: ["1", "2", "3"],
        dislikedByUserIds: ["4"],
      },
    ]);

  const app = createApp();
  const response = await request(app)
    .get("/api/statistics/articles")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.totals.finishedArticles, 1);
  assert.equal(response.body.totals.likes, 2);
  assert.equal(response.body.totals.dislikes, 1);
  assert.equal(response.body.articles.length, 1);
  assert.equal(response.body.articles[0].title, "Finished");
});
