const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp, Article, postgresPool, buildModerationDecision, runAsyncModerationScan } = require("../server");

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

function mockAuthenticatedUser(user) {
  postgresPool.query = async (query, params = []) => {
    if (String(query).includes("FROM users WHERE id = $1")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: Number(user.id),
            username: user.username,
            role: user.role,
            display_name: user.display_name,
            is_banned: user.is_banned ?? false,
            ban_type: user.ban_type ?? "",
            banned_at: user.banned_at ?? null,
          },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
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

test("GET /api/recommendations returns simple content-based suggestions for readers", async () => {
  const token = signToken({ sub: "20", username: "user", role: "User", displayName: "Reader User" });
  mockAuthenticatedUser({ id: 20, username: "user", role: "User", display_name: "Reader User" });

  Article.find = (filter) => {
    assert.deepEqual(filter, { status: "finished" });
    return createSortLeanResult([
      {
        _id: { toString: () => "liked-1" },
        title: "Campus research festival",
        category: "Campus",
        summary: "Research students and festival projects across UBB.",
        status: "finished",
        likedByUserIds: ["20"],
        dislikedByUserIds: [],
        paragraphs: [{ text: "Research stories and campus innovation." }],
      },
      {
        _id: { toString: () => "candidate-1" },
        title: "Research ideas for the campus community",
        category: "Campus",
        summary: "Fresh research events for students.",
        status: "finished",
        likedByUserIds: ["11"],
        dislikedByUserIds: [],
        paragraphs: [{ text: "Community research fair." }],
      },
      {
        _id: { toString: () => "candidate-2" },
        title: "Sports day highlights",
        category: "Sports",
        summary: "Team results and scores.",
        status: "finished",
        likedByUserIds: [],
        dislikedByUserIds: ["20"],
        paragraphs: [{ text: "Athletes and matches." }],
      },
    ]);
  };

  const app = createApp();
  const response = await request(app)
    .get("/api/recommendations")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.profileTerms.length > 0);
  assert.equal(response.body.recommendations.length, 1);
  assert.equal(response.body.recommendations[0].id, "candidate-1");
  assert.ok(response.body.recommendations[0].matchedTerms.includes("research"));
});

test("POST /api/articles rejects invalid editor payload", async () => {
  const token = signToken({ sub: "2", username: "editor", role: "Editor", displayName: "Editor User" });
  mockAuthenticatedUser({ id: 2, username: "editor", role: "Editor", display_name: "Editor User" });
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
  mockAuthenticatedUser({ id: 20, username: "user", role: "User", display_name: "Reader User" });

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

test("POST /api/articles/:id/comments allows logged-in viewers to add article comments", async () => {
  const token = signToken({ sub: "20", username: "user", role: "User", displayName: "Reader User" });
  mockAuthenticatedUser({ id: 20, username: "user", role: "User", display_name: "Reader User" });
  const saveCalls = [];
  const article = {
    _id: { toString: () => "article-4" },
    status: "finished",
    articleComments: [],
    assignedJournalistIds: ["7"],
    createdByUserId: "2",
    articleComments: [],
    save: async () => {
      saveCalls.push("saved");
    },
  };

  article.articleComments.push = function push(comment) {
    Array.prototype.push.call(this, {
      _id: { toString: () => "comment-1" },
      ...comment,
    });
    return this.length;
  };

  Article.findById = async () => article;
  Article.find = () => ({
    lean: async () => [],
  });

  const app = createApp();
  const response = await request(app)
    .post("/api/articles/article-4/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Great article." });

  assert.equal(response.status, 201);
  assert.equal(response.body.text, "Great article.");
  assert.equal(response.body.authorRole, "User");
  assert.equal(saveCalls.length, 1);
});

test("GET /api/articles/:id hides article comments from guests", async () => {
  const article = {
    _id: { toString: () => "article-5" },
    title: "Finished article",
    category: "Campus",
    author: "Author",
    date: new Date("2026-06-13"),
    summary: "Summary",
    status: "finished",
    likedByUserIds: [],
    dislikedByUserIds: [],
    articleComments: [
      {
        _id: { toString: () => "comment-2" },
        text: "Visible only when logged in",
        authorId: "20",
        authorName: "Reader User",
        authorRole: "User",
        createdAt: new Date("2026-06-13"),
      },
    ],
    assignedJournalistIds: ["7"],
    createdByUserId: "2",
    createdByName: "Editor",
    createdByRole: "Editor",
    finishedByEditorName: "Editor",
    finishedAt: new Date("2026-06-13"),
    paragraphs: [],
  };

  Article.findById = () => ({
    lean: async () => article,
  });
  postgresPool.query = async () => ({
    rows: [{ id: 7, username: "journalist2", role: "Journalist", display_name: "Ana Journalist" }],
  });

  const app = createApp();
  const response = await request(app).get("/api/articles/article-5");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.articleComments, []);
});

test("POST /api/articles/:id/paragraphs rejects empty paragraph text", async () => {
  const token = signToken({ sub: "7", username: "journalist2", role: "Journalist", displayName: "Ana Journalist" });
  mockAuthenticatedUser({ id: 7, username: "journalist2", role: "Journalist", display_name: "Ana Journalist" });

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
  mockAuthenticatedUser({ id: 1, username: "admin", role: "Admin", display_name: "Admin User" });

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

test("POST /api/articles/:id/comments still saves comments before async moderation runs", async () => {
  const token = signToken({ sub: "20", username: "user", role: "User", displayName: "Reader User" });
  mockAuthenticatedUser({ id: 20, username: "user", role: "User", display_name: "Reader User" });
  const saveCalls = [];
  const article = {
    _id: { toString: () => "article-6" },
    status: "finished",
    articleComments: [],
    assignedJournalistIds: ["7"],
    createdByUserId: "2",
    save: async () => {
      saveCalls.push("saved");
    },
  };

  article.articleComments.push = function push(comment) {
    Array.prototype.push.call(this, {
      _id: { toString: () => "comment-6" },
      ...comment,
    });
    return this.length;
  };

  Article.findById = async () => article;

  const app = createApp();
  const response = await request(app)
    .post("/api/articles/article-6/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Esti prost." });

  assert.equal(response.status, 201);
  assert.equal(saveCalls.length, 1);
});

test("GET /api/admin/banned-users returns postac and hater users for admin", async () => {
  const token = signToken({ sub: "1", username: "admin", role: "Admin", displayName: "Admin User" });
  postgresPool.query = async (query) => {
    if (String(query).includes("FROM users WHERE id = $1")) {
      return {
        rowCount: 1,
        rows: [{
          id: 1,
          username: "admin",
          role: "Admin",
          display_name: "Admin User",
          is_banned: false,
          ban_type: "",
          banned_at: null,
        }],
      };
    }

    if (String(query).includes("WHERE is_banned = TRUE")) {
      return {
        rowCount: 2,
        rows: [
          { id: 20, username: "user", role: "User", display_name: "Reader User", is_banned: true, ban_type: "hater", banned_at: new Date("2026-06-13") },
          { id: 21, username: "user2", role: "User", display_name: "Bianca Reader", is_banned: true, ban_type: "postac", banned_at: new Date("2026-06-12") },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
  };

  const app = createApp();
  const response = await request(app)
    .get("/api/admin/banned-users")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.deepEqual(response.body.map((user) => user.banType), ["hater", "postac"]);
});

test("buildModerationDecision detects hater comments with a stronger score", () => {
  const comments = [
    { text: "Esti prost si idiot.", createdAt: new Date("2026-06-13T10:00:00Z") },
    { text: "Comentariu normal.", createdAt: new Date("2026-06-13T10:02:00Z") },
  ];

  const decision = buildModerationDecision(comments, new Date("2026-06-13T10:03:00Z").getTime());

  assert.equal(decision.shouldBan, true);
  assert.equal(decision.banType, "hater");
  assert.ok(decision.scores.haterScore >= 4);
});

test("runAsyncModerationScan bans postac users based on burst and repetition", async () => {
  const queries = [];
  postgresPool.query = async (query, params = []) => {
    queries.push({ query: String(query), params });

    if (String(query).includes("WHERE role = 'User' AND is_banned = FALSE")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 20,
            username: "user",
            role: "User",
            display_name: "Reader User",
            is_banned: false,
            ban_type: "",
            banned_at: null,
          },
        ],
      };
    }

    if (String(query).includes("UPDATE users SET is_banned = TRUE")) {
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  };

  Article.find = (filter) => {
    assert.deepEqual(filter, { "articleComments.authorId": "20" });
    return {
      lean: async () => [
        {
          articleComments: [
            { authorId: "20", text: "Aceeasi idee", createdAt: new Date("2026-06-13T10:00:00Z") },
            { authorId: "20", text: "Aceeasi idee", createdAt: new Date("2026-06-13T10:00:15Z") },
            { authorId: "20", text: "Aceeasi idee", createdAt: new Date("2026-06-13T10:00:30Z") },
            { authorId: "20", text: "Aceeasi idee", createdAt: new Date("2026-06-13T10:00:45Z") },
          ],
        },
      ],
    };
  };

  const bans = await runAsyncModerationScan(new Date("2026-06-13T10:01:00Z").getTime());

  assert.equal(bans.length, 1);
  assert.equal(bans[0].banType, "postac");
  assert.ok(queries.some((entry) => entry.query.includes("UPDATE users SET is_banned = TRUE") && entry.params[1] === "postac"));
});
