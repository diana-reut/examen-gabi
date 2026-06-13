(function universalModule(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TeoriaValidation = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createValidationApi() {
  const limits = {
    username: 100,
    password: 200,
    title: 140,
    category: 60,
    author: 100,
    summary: 600,
    paragraph: 12000,
    comment: 600,
    assignedJournalistsMin: 1,
    assignedJournalistsMax: 2,
  };

  function normalizeString(value) {
    return String(value || "").trim();
  }

  function isValidDateInput(value) {
    const normalized = normalizeString(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return false;
    }

    const parsed = new Date(normalized);
    return !Number.isNaN(parsed.getTime());
  }

  function pushLengthError(errors, label, value, maxLength) {
    if (normalizeString(value).length > maxLength) {
      errors.push(`${label} must be at most ${maxLength} characters.`);
    }
  }

  function validateLoginPayload(payload) {
    const errors = [];
    const username = normalizeString(payload?.username);
    const password = String(payload?.password || "");

    if (!username) {
      errors.push("Username is required.");
    }

    if (!password) {
      errors.push("Password is required.");
    }

    pushLengthError(errors, "Username", username, limits.username);

    if (password.length > limits.password) {
      errors.push(`Password must be at most ${limits.password} characters.`);
    }

    return { errors };
  }

  function validateAssignedJournalistIds(assignedJournalistIds, messagePrefix) {
    const normalized = Array.isArray(assignedJournalistIds)
      ? [...new Set(assignedJournalistIds.map((entry) => normalizeString(entry)).filter(Boolean))]
      : [];

    const errors = [];

    if (normalized.length < limits.assignedJournalistsMin || normalized.length > limits.assignedJournalistsMax) {
      errors.push(`${messagePrefix} must assign one or two journalists.`);
    }

    return { errors, normalized };
  }

  function validateArticleBase(payload, messagePrefix) {
    const errors = [];
    const title = normalizeString(payload?.title);
    const category = normalizeString(payload?.category);
    const author = normalizeString(payload?.author);
    const summary = normalizeString(payload?.summary);
    const date = normalizeString(payload?.date);
    const assignedValidation = validateAssignedJournalistIds(payload?.assignedJournalistIds, messagePrefix);

    if (!title) {
      errors.push('Field "title" is required.');
    }

    if (!date || !isValidDateInput(date)) {
      errors.push('Field "date" must be a valid date in YYYY-MM-DD format.');
    }

    pushLengthError(errors, "Title", title, limits.title);
    pushLengthError(errors, "Category", category, limits.category);
    pushLengthError(errors, "Author", author, limits.author);
    pushLengthError(errors, "Summary", summary, limits.summary);

    return {
      errors: [...errors, ...assignedValidation.errors],
      normalizedAssignedJournalistIds: assignedValidation.normalized,
    };
  }

  function validateArticleCreatePayload(payload) {
    return validateArticleBase(payload, "Each article");
  }

  function validateArticleManagePayload(payload) {
    const result = validateArticleBase(payload, "An editor");

    if (payload?.status && !["draft", "finished"].includes(payload.status)) {
      result.errors.push('Field "status" must be either "draft" or "finished".');
    }

    return result;
  }

  function validateParagraphPayload(payload) {
    const errors = [];
    const text = normalizeString(payload?.text);

    if (!text) {
      errors.push('Field "text" is required.');
    }

    pushLengthError(errors, "Paragraph text", text, limits.paragraph);

    return { errors };
  }

  function validateCommentPayload(payload) {
    const errors = [];
    const text = normalizeString(payload?.text);

    if (!text) {
      errors.push('Field "text" is required.');
    }

    pushLengthError(errors, "Comment", text, limits.comment);

    return { errors };
  }

  function validateReactionPayload(payload) {
    const errors = [];

    if (!["like", "dislike", "none"].includes(payload?.reaction)) {
      errors.push('Field "reaction" must be "like", "dislike", or "none".');
    }

    return { errors };
  }

  function firstError(result) {
    return result?.errors?.[0] || null;
  }

  return {
    limits,
    normalizeString,
    isValidDateInput,
    validateLoginPayload,
    validateArticleCreatePayload,
    validateArticleManagePayload,
    validateParagraphPayload,
    validateCommentPayload,
    validateReactionPayload,
    firstError,
  };
});
