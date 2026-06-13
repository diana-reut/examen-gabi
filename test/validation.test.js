const test = require("node:test");
const assert = require("node:assert/strict");
const validation = require("../shared/validation");

test("login validation requires username and password", () => {
  const result = validation.validateLoginPayload({ username: "", password: "" });
  assert.deepEqual(result.errors, ["Username is required.", "Password is required."]);
});

test("article validation rejects too many assigned journalists", () => {
  const result = validation.validateArticleCreatePayload({
    title: "Article",
    date: "2026-06-13",
    category: "Campus",
    author: "Author",
    summary: "Summary",
    assignedJournalistIds: ["1", "2", "3"],
  });

  assert.equal(result.errors[0], "Each article must assign one or two journalists.");
});

test("article manage validation rejects invalid dates", () => {
  const result = validation.validateArticleManagePayload({
    title: "Article",
    date: "13-06-2026",
    assignedJournalistIds: ["1"],
    status: "draft",
  });

  assert.equal(result.errors[0], 'Field "date" must be a valid date in YYYY-MM-DD format.');
});

test("paragraph validation rejects empty text", () => {
  const result = validation.validateParagraphPayload({ text: "   " });
  assert.equal(result.errors[0], 'Field "text" is required.');
});

test("comment validation rejects overly long comments", () => {
  const result = validation.validateCommentPayload({ text: "a".repeat(validation.limits.comment + 1) });
  assert.equal(result.errors[0], `Comment must be at most ${validation.limits.comment} characters.`);
});

test("reaction validation only accepts like, dislike, or none", () => {
  const result = validation.validateReactionPayload({ reaction: "love" });
  assert.equal(result.errors[0], 'Field "reaction" must be "like", "dislike", or "none".');
});
