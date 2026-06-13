const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const userPanel = document.getElementById("userPanel");
const roleBadge = document.getElementById("roleBadge");
const userIdentity = document.getElementById("userIdentity");
const permissionSummary = document.getElementById("permissionSummary");

const articleList = document.getElementById("articleList");
const articleDetail = document.getElementById("articleDetail");
const articleCounter = document.getElementById("articleCount");
const feedbackBanner = document.getElementById("feedbackBanner");
const deleteArticleBtn = document.getElementById("deleteArticleBtn");
const createArticleShortcutBtn = document.getElementById("createArticleShortcutBtn");
const statisticsBtn = document.getElementById("statisticsBtn");
const statisticsShell = document.getElementById("statisticsShell");
const statisticsContent = document.getElementById("statisticsContent");

const articleMetaShell = document.getElementById("articleMetaShell");
const articleMetaHeading = document.getElementById("articleMetaHeading");
const articleMetaForm = document.getElementById("articleMetaForm");
const paragraphShell = document.getElementById("paragraphShell");
const paragraphForm = document.getElementById("paragraphForm");
const paragraphSubmitBtn = document.getElementById("paragraphSubmitBtn");
const paragraphCancelBtn = document.getElementById("paragraphCancelBtn");
const validation = window.TeoriaValidation;

const articleFields = {
  title: document.getElementById("articleTitleInput"),
  category: document.getElementById("articleCategoryInput"),
  author: document.getElementById("articleAuthorInput"),
  date: document.getElementById("articleDateInput"),
  summary: document.getElementById("articleSummaryInput"),
  assignedJournalistIds: document.getElementById("articleAssignedInput"),
  status: document.getElementById("articleStatusInput"),
};

const paragraphFields = {
  id: document.getElementById("paragraphIdInput"),
  text: document.getElementById("paragraphTextInput"),
  images: document.getElementById("paragraphImagesInput"),
  existingImages: document.getElementById("paragraphExistingImages"),
};

const roleClassNames = {
  Admin: "role-admin",
  Editor: "role-editor",
  Journalist: "role-journalist",
  User: "role-user",
};

let authToken = localStorage.getItem("teoriaToken") || "";
let currentUser = null;
let currentPermissions = null;
let articles = [];
let journalists = [];
let selectedArticleId = null;
let paragraphDraftImages = [];
let draggedParagraphId = null;
let statisticsVisible = false;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Something went wrong.";
    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch {}

    if (response.status === 401) {
      resetAuthenticatedState();
      throw new Error("Session expired or invalid. Please log in again.");
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function showFeedback(message) {
  feedbackBanner.textContent = message;
  feedbackBanner.classList.remove("hidden");
}

function getValidationMessage(result) {
  return result?.errors?.[0] || "";
}

function clearFeedback() {
  feedbackBanner.textContent = "";
  feedbackBanner.classList.add("hidden");
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setRoleTheme(role) {
  document.body.className = roleClassNames[role] || "role-anonymous";
}

function getSelectedArticle() {
  return articles.find((article) => article.id === selectedArticleId) ?? null;
}

function canManageSelectedArticle(article = getSelectedArticle()) {
  if (!article || !currentUser) {
    return false;
  }

  return currentUser.role === "Admin" || article.createdByUserId === currentUser.id;
}

function getSelectedValues(selectElement) {
  return Array.from(selectElement.selectedOptions).map((option) => option.value);
}

function setSelectedValues(selectElement, values) {
  const wanted = new Set(values);
  Array.from(selectElement.options).forEach((option) => {
    option.selected = wanted.has(option.value);
  });
}

function populateJournalistSelect(selectElement, selectedIds = []) {
  selectElement.innerHTML = journalists
    .map((journalist) => {
      const selected = selectedIds.includes(journalist.id) ? "selected" : "";
      return `<option value="${journalist.id}" ${selected}>${journalist.displayName} (${journalist.username})</option>`;
    })
    .join("");
}

function describeRole() {
  if (!currentUser) {
    return "Guests can browse finished articles and see like/dislike totals, but they cannot react until they log in.";
  }

  if (currentUser.role === "Admin") {
    return "Admins can manage article metadata, paragraphs, images, comments, deletion, and article statistics.";
  }

  if (currentUser.role === "Editor") {
    return "Editors create articles, assign one or two journalists, mark an article as finished, and leave paragraph comments. They cannot write paragraphs or upload images.";
  }

  if (currentUser.role === "Journalist") {
    return "Journalists only see articles assigned to them and can add or edit paragraphs plus upload images for those articles.";
  }

  return "Readers only see finished articles and can like or dislike them.";
}

function setAuthenticatedState(user, permissions) {
  currentUser = user;
  currentPermissions = permissions;
  roleBadge.textContent = user.role;
  userIdentity.textContent = `${user.displayName} (${user.username})`;
  permissionSummary.textContent = describeRole();
  userPanel.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  loginForm.classList.add("hidden");
  setRoleTheme(user.role);
}

function resetForms() {
  articleMetaForm.reset();
  paragraphForm.reset();
  articleFields.date.value = new Date().toISOString().slice(0, 10);
  articleFields.status.value = "draft";
  articleFields.status.querySelector("option[value='finished']").disabled = false;
  articleFields.title.maxLength = validation.limits.title;
  articleFields.category.maxLength = validation.limits.category;
  articleFields.author.maxLength = validation.limits.author;
  articleFields.summary.maxLength = validation.limits.summary;
  paragraphFields.text.maxLength = validation.limits.paragraph;
  paragraphFields.id.value = "";
  paragraphDraftImages = [];
  renderExistingImages([]);
  articleMetaHeading.textContent = "Create Article";
  paragraphSubmitBtn.textContent = "Save paragraph";
  paragraphCancelBtn.classList.add("hidden");
}

function resetAuthenticatedState() {
  currentUser = null;
  currentPermissions = null;
  authToken = "";
  localStorage.removeItem("teoriaToken");
  journalists = [];
  articles = [];
  selectedArticleId = null;
  statisticsVisible = false;
  userPanel.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  loginForm.classList.remove("hidden");
  articleList.innerHTML = "";
  articleCounter.textContent = "0 articles";
  articleDetail.innerHTML = '<p class="detail-placeholder">Browse published articles or log in for more actions.</p>';
  articleMetaShell.classList.add("hidden");
  paragraphShell.classList.add("hidden");
  statisticsShell.classList.add("hidden");
  deleteArticleBtn.classList.add("hidden");
  createArticleShortcutBtn.classList.add("hidden");
  statisticsBtn.classList.add("hidden");
  setRoleTheme(null);
  resetForms();
}

function applyPermissions() {
  const article = getSelectedArticle();
  const canCreateArticle = Boolean(currentPermissions?.canCreateArticle);
  const canManageArticle = Boolean(currentPermissions?.canManageArticle);
  const canWriteParagraphs = Boolean(currentPermissions?.canWriteParagraphs);
  const canDeleteArticle = Boolean(currentPermissions?.canDeleteArticle);

  const canManageSelected = canManageSelectedArticle(article);
  const canWriteSelected = Boolean(article && currentUser && (currentUser.role === "Admin" || article.assignedJournalistIds.includes(currentUser.id)));

  createArticleShortcutBtn.classList.toggle("hidden", !canCreateArticle);
  articleMetaShell.classList.toggle("hidden", !(canCreateArticle || (canManageArticle && canManageSelected)));
  paragraphShell.classList.toggle("hidden", !(canWriteParagraphs && canWriteSelected));
  deleteArticleBtn.classList.toggle("hidden", !canDeleteArticle);
  deleteArticleBtn.disabled = !canDeleteArticle || !article;
  statisticsBtn.classList.toggle("hidden", currentUser?.role !== "Admin");
  statisticsShell.classList.toggle("hidden", !(currentUser?.role === "Admin" && statisticsVisible));
}

async function enterGuestMode() {
  resetAuthenticatedState();
  permissionSummary.textContent = describeRole();
  await loadArticles();
  clearFeedback();
}

async function loadJournalistsIfNeeded() {
  if (!currentPermissions?.canManageArticle && !currentPermissions?.canCreateArticle) {
    journalists = [];
    return;
  }

  journalists = await apiRequest("/api/journalists");
  populateJournalistSelect(articleFields.assignedJournalistIds);
}

function renderExistingImages(images) {
  if (!images.length) {
    paragraphFields.existingImages.classList.add("hidden");
    paragraphFields.existingImages.innerHTML = "";
    return;
  }

  paragraphFields.existingImages.classList.remove("hidden");
  paragraphFields.existingImages.innerHTML = images
    .map(
      (image, index) => `
        <div class="existing-image-item">
          <img src="${image.url}" alt="Paragraph image ${index + 1}">
          <label>
            <input type="checkbox" data-image-public-id="${image.publicId}" checked>
            Keep this image
          </label>
        </div>
      `,
    )
    .join("");
}

function getKeptExistingImages() {
  const article = getSelectedArticle();
  const paragraphId = paragraphFields.id.value;
  if (!article || !paragraphId) {
    return [];
  }

  const paragraph = article.paragraphs.find((entry) => entry.id === paragraphId);
  if (!paragraph) {
    return [];
  }

  const keptPublicIds = new Set(
    Array.from(paragraphFields.existingImages.querySelectorAll("input[type='checkbox']:checked")).map((input) =>
      input.getAttribute("data-image-public-id"),
    ),
  );

  return paragraph.images.filter((image) => keptPublicIds.has(image.publicId));
}

function fillArticleMetaForm(article) {
  if (!article) {
    resetForms();
    populateJournalistSelect(articleFields.assignedJournalistIds);
    return;
  }

  const unresolvedComments = countUnresolvedComments(article);
  articleMetaHeading.textContent = "Update Article Setup";
  articleFields.title.value = article.title;
  articleFields.category.value = article.category;
  articleFields.author.value = article.author;
  articleFields.date.value = article.date;
  articleFields.summary.value = article.summary;
  articleFields.status.querySelector("option[value='finished']").disabled = unresolvedComments > 0;
  articleFields.status.value = article.status === "finished" || unresolvedComments === 0 ? article.status : "draft";
  populateJournalistSelect(articleFields.assignedJournalistIds, article.assignedJournalistIds);
}

function fillParagraphForm(paragraph) {
  if (!paragraph) {
    paragraphForm.reset();
    paragraphFields.id.value = "";
    paragraphDraftImages = [];
    renderExistingImages([]);
    paragraphSubmitBtn.textContent = "Save paragraph";
    paragraphCancelBtn.classList.add("hidden");
    return;
  }

  paragraphFields.id.value = paragraph.id;
  paragraphFields.text.value = paragraph.text;
  paragraphDraftImages = [];
  renderExistingImages(paragraph.images);
  paragraphSubmitBtn.textContent = "Update paragraph";
  paragraphCancelBtn.classList.remove("hidden");
}

function countUnresolvedComments(article) {
  if (!article) {
    return 0;
  }

  return article.paragraphs.reduce(
    (count, paragraph) => count + paragraph.comments.filter((comment) => !comment.resolved).length,
    0,
  );
}

function renderReactionSummary(article) {
  const isUser = currentUser?.role === "User";
  const canReact = isUser && article.status === "finished";

  return `
    <div class="reaction-strip">
      <div class="reaction-counts">
        <span class="reaction-pill like">Likes: ${article.likes ?? 0}</span>
        <span class="reaction-pill dislike">Dislikes: ${article.dislikes ?? 0}</span>
      </div>
      ${
        canReact
          ? `
            <div class="reaction-actions">
              <button class="secondary-button${article.userReaction === "like" ? " active-reaction" : ""}" type="button" data-action="react" data-reaction="like">Like</button>
              <button class="secondary-button${article.userReaction === "dislike" ? " active-reaction" : ""}" type="button" data-action="react" data-reaction="dislike">Dislike</button>
              ${
                article.userReaction !== "none"
                  ? '<button class="ghost-button" type="button" data-action="react" data-reaction="none">Clear reaction</button>'
                  : ""
              }
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderStatistics(statistics) {
  if (!statistics) {
    statisticsContent.innerHTML = "";
    return;
  }

  const renderBar = (likes, dislikes) => {
    const total = likes + dislikes;
    const likeWidth = total ? (likes / total) * 100 : 0;
    const dislikeWidth = total ? (dislikes / total) * 100 : 0;

    return `
      <div class="stats-bar" aria-hidden="true">
        <div class="stats-bar-like" style="width:${likeWidth}%"></div>
        <div class="stats-bar-dislike" style="width:${dislikeWidth}%"></div>
      </div>
    `;
  };

  const renderRows = (items) =>
    items.length
      ? items
          .map(
            (item) => `
              <div class="stats-row">
                <div>
                  <strong>${item.title || "Untitled article"}</strong>
                  <div class="stats-subline">${item.category || "Uncategorized"} · ${item.status}</div>
                  ${renderBar(item.likes, item.dislikes)}
                </div>
                <div class="stats-metrics">
                  <span>Likes: ${item.likes}</span>
                  <span>Dislikes: ${item.dislikes}</span>
                  <span>${item.approvalScore}% positive</span>
                </div>
              </div>
            `,
          )
          .join("")
      : '<p class="empty-inline">No statistics available yet.</p>';

  statisticsContent.innerHTML = `
    <div class="stats-grid">
      <div class="stats-card">
        <h3>Finished articles only</h3>
        <p><strong>${statistics.totals.finishedArticles}</strong> published article${statistics.totals.finishedArticles === 1 ? "" : "s"}</p>
        ${renderBar(statistics.totals.likes, statistics.totals.dislikes)}
        <p><strong>${statistics.totals.totalReactions}</strong> total reactions</p>
        <p>Likes: ${statistics.totals.likes}</p>
        <p>Dislikes: ${statistics.totals.dislikes}</p>
      </div>
      <div class="stats-card">
        <h3>Reaction split</h3>
        <div class="stats-legend">
          <span class="stats-legend-item"><span class="stats-swatch like"></span>Likes</span>
          <span class="stats-legend-item"><span class="stats-swatch dislike"></span>Dislikes</span>
        </div>
        <div class="stats-donut-shell">
          <div class="stats-donut" style="--like-share:${statistics.totals.totalReactions ? (statistics.totals.likes / statistics.totals.totalReactions) * 360 : 0}deg;">
            <div class="stats-donut-center">${statistics.totals.totalReactions || 0}</div>
          </div>
        </div>
      </div>
      <div class="stats-card">
        <h3>Most liked</h3>
        ${renderRows(statistics.mostLiked)}
      </div>
      <div class="stats-card">
        <h3>Most disliked</h3>
        ${renderRows(statistics.mostDisliked)}
      </div>
      <div class="stats-card stats-card-wide">
        <h3>All finished articles</h3>
        ${renderRows(statistics.articles)}
      </div>
    </div>
  `;
}

function renderParagraphCommentForm(paragraph) {
  if (!(currentUser && (currentUser.role === "Admin" || currentUser.role === "Editor"))) {
    return "";
  }

  const article = getSelectedArticle();
  if (!canManageSelectedArticle(article)) {
    return "";
  }

  return `
    <form class="comment-form" data-paragraph-id="${paragraph.id}">
      <textarea name="commentText" rows="3" maxlength="${validation.limits.comment}" placeholder="Leave a comment for this paragraph..."></textarea>
      <button class="secondary-button" type="submit">Add comment</button>
    </form>
  `;
}

function renderSolveCommentButton(paragraph, comment) {
  const article = getSelectedArticle();
  if (!article || comment.resolved || !canManageSelectedArticle(article)) {
    return "";
  }

  return `
    <button
      class="secondary-button solve-comment-btn"
      type="button"
      data-action="solve-comment"
      data-paragraph-id="${paragraph.id}"
      data-comment-id="${comment.id}"
    >
      Solve comment
    </button>
  `;
}

function renderParagraphActions(paragraph) {
  const article = getSelectedArticle();
  if (!article || !currentUser) {
    return "";
  }

  const canWrite = currentUser.role === "Admin" || (currentUser.role === "Journalist" && article.assignedJournalistIds.includes(currentUser.id));
  const canDelete = canWrite;

  if (!canWrite) {
    return "";
  }

  return `
    <div class="paragraph-actions">
      <button class="ghost-button" type="button" data-action="edit-paragraph" data-paragraph-id="${paragraph.id}">Edit paragraph</button>
      ${canDelete ? `<button class="danger-button" type="button" data-action="delete-paragraph" data-paragraph-id="${paragraph.id}">Delete paragraph</button>` : ""}
    </div>
  `;
}

function renderDetail(article) {
  if (!article) {
    articleDetail.innerHTML = '<p class="detail-placeholder">No article is selected yet.</p>';
    return;
  }

  const unresolvedComments = countUnresolvedComments(article);
  const canManageCurrent = canManageSelectedArticle(article);
  const shouldHideCommentsFromReader = (!currentUser || currentUser.role === "User") && article.status === "finished";

  const paragraphsHtml = article.paragraphs.length
    ? article.paragraphs
        .map((paragraph, index) => {
          const imagesHtml = paragraph.images.length
            ? `<div class="paragraph-images">${paragraph.images
                .map((image) => `<img src="${image.url}" alt="Paragraph image ${index + 1}">`)
                .join("")}</div>`
            : `<p class="empty-inline">No images added for this paragraph yet.</p>`;

          const commentsHtml = shouldHideCommentsFromReader
            ? ""
            : paragraph.comments.length
              ? `<div class="comments-list">${paragraph.comments
                  .map(
                    (comment) => `
                      <div class="comment-item ${comment.resolved ? "resolved" : "unresolved"}">
                        <div class="comment-meta">
                          ${comment.authorName} (${comment.authorRole})
                          <span class="comment-status ${comment.resolved ? "resolved" : "unresolved"}">
                            ${comment.resolved ? "Solved" : "Open"}
                          </span>
                        </div>
                        <div>${comment.text}</div>
                        ${renderSolveCommentButton(paragraph, comment)}
                      </div>
                    `,
                  )
                  .join("")}</div>`
              : `<p class="empty-inline">No editor comments yet.</p>`;

          return `
            <section class="paragraph-card${canManageCurrent ? " draggable" : ""}" data-paragraph-id="${paragraph.id}" ${canManageCurrent ? 'draggable="true"' : ""}>
              <div class="paragraph-actions">
                <h3>Paragraph ${index + 1}</h3>
                ${renderParagraphActions(paragraph)}
              </div>
              <div class="paragraph-meta">Updated by ${paragraph.updatedByName || "Unknown"}${paragraph.updatedAt ? ` on ${new Date(paragraph.updatedAt).toLocaleString("en-GB")}` : ""}</div>
              <p class="paragraph-text">${paragraph.text}</p>
              ${imagesHtml}
              ${shouldHideCommentsFromReader ? "" : '<div class="detail-assignees"><strong>Editor comments</strong></div>'}
              ${commentsHtml}
              ${shouldHideCommentsFromReader ? "" : renderParagraphCommentForm(paragraph)}
            </section>
          `;
        })
        .join("")
    : '<p class="empty-inline">No paragraphs yet.</p>';

  articleDetail.innerHTML = `
    <div class="detail-status-row">
      <div class="meta-pill">${article.category || "Uncategorized"}</div>
      <div class="status-pill">${article.status}</div>
    </div>
    <h2 class="detail-title">${article.title || "Untitled article"}</h2>
    <div class="detail-meta">
      <span><strong>Author:</strong> ${article.author || "No author yet"}</span>
      <span><strong>Date:</strong> ${formatDate(article.date)}</span>
      <span><strong>Created by:</strong> ${article.createdByName || "Unknown"}</span>
    </div>
    ${renderReactionSummary(article)}
    <p class="detail-assignees"><strong>Assigned journalists:</strong> ${article.assignedJournalists.map((entry) => entry.displayName).join(", ") || "No assignments yet"}</p>
    <p class="detail-assignees"><strong>Finished by:</strong> ${article.finishedByEditorName || "Not finished yet"}</p>
    <p class="detail-summary">${article.summary || "No summary added yet."}</p>
    ${
      canManageCurrent
        ? unresolvedComments
          ? `<p class="workflow-warning">This article still has ${unresolvedComments} open editor comment${unresolvedComments === 1 ? "" : "s"}. Solve them before finishing the article.</p>`
          : '<p class="workflow-ok">All editor comments are solved. This article can now be finished.</p>'
        : ""
    }
    <div class="paragraph-list">${paragraphsHtml}</div>
  `;
}

function attachDetailInteractions() {
  articleDetail.querySelectorAll(".paragraph-card.draggable").forEach((card) => {
    card.addEventListener("dragstart", () => {
      draggedParagraphId = card.dataset.paragraphId;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      draggedParagraphId = null;
      card.classList.remove("dragging");
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    card.addEventListener("drop", async (event) => {
      event.preventDefault();

      const article = getSelectedArticle();
      const targetParagraphId = card.dataset.paragraphId;
      if (!article || !draggedParagraphId || draggedParagraphId === targetParagraphId) {
        return;
      }

      const reorderedIds = article.paragraphs.map((paragraph) => paragraph.id);
      const draggedIndex = reorderedIds.indexOf(draggedParagraphId);
      const targetIndex = reorderedIds.indexOf(targetParagraphId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return;
      }

      reorderedIds.splice(targetIndex, 0, reorderedIds.splice(draggedIndex, 1)[0]);

      try {
        await apiRequest(`/api/articles/${article.id}/paragraph-order`, {
          method: "PATCH",
          body: JSON.stringify({ paragraphIds: reorderedIds }),
        });
        await loadArticles(article.id);
        showFeedback("Paragraph order updated.");
      } catch (error) {
        showFeedback(error.message);
      }
    });
  });

  articleDetail.querySelectorAll("[data-action='edit-paragraph']").forEach((button) => {
    button.addEventListener("click", () => {
      const article = getSelectedArticle();
      const paragraph = article?.paragraphs.find((entry) => entry.id === button.dataset.paragraphId);
      if (!paragraph) {
        return;
      }

      fillParagraphForm(paragraph);
      paragraphShell.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  articleDetail.querySelectorAll("[data-action='delete-paragraph']").forEach((button) => {
    button.addEventListener("click", async () => {
      const article = getSelectedArticle();
      if (!article) {
        return;
      }

      try {
        await apiRequest(`/api/articles/${article.id}/paragraphs/${button.dataset.paragraphId}`, {
          method: "DELETE",
        });
        await loadArticles(article.id);
        fillParagraphForm(null);
        showFeedback("Paragraph deleted.");
      } catch (error) {
        showFeedback(error.message);
      }
    });
  });

  articleDetail.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const article = getSelectedArticle();
      if (!article) {
        return;
      }

      const commentText = validation.normalizeString(form.querySelector("textarea").value);
      const commentError = getValidationMessage(validation.validateCommentPayload({ text: commentText }));
      if (commentError) {
        showFeedback(commentError);
        return;
      }

      try {
        await apiRequest(`/api/articles/${article.id}/paragraphs/${form.dataset.paragraphId}/comments`, {
          method: "POST",
          body: JSON.stringify({ text: commentText }),
        });
        await loadArticles(article.id);
        showFeedback("Comment added.");
      } catch (error) {
        showFeedback(error.message);
      }
    });
  });

  articleDetail.querySelectorAll("[data-action='solve-comment']").forEach((button) => {
    button.addEventListener("click", async () => {
      const article = getSelectedArticle();
      if (!article) {
        return;
      }

      try {
        await apiRequest(
          `/api/articles/${article.id}/paragraphs/${button.dataset.paragraphId}/comments/${button.dataset.commentId}/resolve`,
          {
            method: "PATCH",
          },
        );
        await loadArticles(article.id);
        showFeedback("Comment solved.");
      } catch (error) {
        showFeedback(error.message);
      }
    });
  });

  articleDetail.querySelectorAll("[data-action='react']").forEach((button) => {
    button.addEventListener("click", async () => {
      const article = getSelectedArticle();
      if (!article) {
        return;
      }

      try {
        await apiRequest(`/api/articles/${article.id}/reaction`, {
          method: "PATCH",
          body: JSON.stringify({ reaction: button.dataset.reaction }),
        });
        await loadArticles(article.id);
        showFeedback("Reaction updated.");
      } catch (error) {
        showFeedback(error.message);
      }
    });
  });
}

function renderList() {
  articleList.innerHTML = "";
  articleCounter.textContent = `${articles.length} article${articles.length === 1 ? "" : "s"}`;

  if (!articles.length) {
    articleList.innerHTML = '<p class="detail-placeholder">No articles are visible for this role yet.</p>';
    return;
  }

  articles.forEach((article) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `article-card${article.id === selectedArticleId ? " active" : ""}`;
    button.innerHTML = `
      <div class="article-card-top">
        <div class="meta-pill">${article.category || "Uncategorized"}</div>
        <div class="status-pill">${article.status}</div>
      </div>
      <h3 class="article-title">${article.title || "Untitled article"}</h3>
      <p class="article-summary">${article.summary || "No summary yet."}</p>
      <div class="card-meta">
        <span>${article.author || "No author"}</span>
        <span>${formatDate(article.date)}</span>
      </div>
      <div class="article-meta-inline">Paragraphs: ${article.paragraphs.length} · Likes: ${article.likes ?? 0} · Dislikes: ${article.dislikes ?? 0}</div>
    `;

    button.addEventListener("click", async () => {
      try {
        const articleDetails = await apiRequest(`/api/articles/${article.id}`);
        selectedArticleId = articleDetails.id;
        renderList();
        renderDetail(articleDetails);
        attachDetailInteractions();
        fillArticleMetaForm(articleDetails);
        fillParagraphForm(null);
        applyPermissions();
        scrollToTop();
        clearFeedback();
      } catch (error) {
        showFeedback(error.message);
      }
    });

    articleList.appendChild(button);
  });
}

async function toggleStatistics() {
  if (currentUser?.role !== "Admin") {
    return;
  }

  statisticsVisible = !statisticsVisible;
  if (!statisticsVisible) {
    statisticsShell.classList.add("hidden");
    statisticsContent.innerHTML = "";
    statisticsBtn.textContent = "See statistics";
    return;
  }

  try {
    const statistics = await apiRequest("/api/statistics/articles");
    renderStatistics(statistics);
    statisticsShell.classList.remove("hidden");
    statisticsBtn.textContent = "Hide statistics";
    statisticsShell.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    statisticsVisible = false;
    statisticsShell.classList.add("hidden");
    statisticsBtn.textContent = "See statistics";
    showFeedback(error.message);
  }
}

async function loadArticles(preferredArticleId = null) {
  const results = await apiRequest("/api/articles");
  articles = results;
  selectedArticleId = preferredArticleId && results.some((article) => article.id === preferredArticleId)
    ? preferredArticleId
    : results[0]?.id ?? null;

  renderList();

  if (!selectedArticleId) {
    renderDetail(null);
    fillArticleMetaForm(null);
    fillParagraphForm(null);
    applyPermissions();
    return;
  }

  const article = await apiRequest(`/api/articles/${selectedArticleId}`);
  renderDetail(article);
  attachDetailInteractions();
  fillArticleMetaForm(article);
  fillParagraphForm(null);
  applyPermissions();
}

async function uploadParagraphImages(articleId) {
  const files = Array.from(paragraphFields.images.files || []);
  if (!files.length) {
    return [];
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const response = await apiRequest(`/api/articles/${articleId}/uploads`, {
    method: "POST",
    body: formData,
  });

  return response.images || [];
}

async function loadJournalistsIfNeeded() {
  const canManage = Boolean(currentPermissions?.canManageArticle || currentPermissions?.canCreateArticle);
  if (!canManage) {
    journalists = [];
    return;
  }

  journalists = await apiRequest("/api/journalists");
  populateJournalistSelect(articleFields.assignedJournalistIds);
}

async function restoreSession() {
  if (!authToken) {
    await enterGuestMode();
    return;
  }

  try {
    const payload = await apiRequest("/api/auth/me");
    setAuthenticatedState(payload.user, payload.permissions);
    await loadJournalistsIfNeeded();
    resetForms();
    await loadArticles();
    clearFeedback();
  } catch {
    await enterGuestMode();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const loginError = getValidationMessage(
    validation.validateLoginPayload({
      username: usernameInput.value,
      password: passwordInput.value,
    }),
  );
  if (loginError) {
    showFeedback(loginError);
    return;
  }

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    authToken = payload.token;
    localStorage.setItem("teoriaToken", authToken);
    setAuthenticatedState(payload.user, payload.permissions);
    await loadJournalistsIfNeeded();
    resetForms();
    await loadArticles();
    loginForm.reset();
    clearFeedback();
  } catch (error) {
    showFeedback(error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await enterGuestMode();
  clearFeedback();
});

statisticsBtn.addEventListener("click", async () => {
  await toggleStatistics();
});

createArticleShortcutBtn.addEventListener("click", () => {
  if (!currentPermissions?.canCreateArticle) {
    return;
  }

  selectedArticleId = null;
  renderList();
  renderDetail(null);
  fillArticleMetaForm(null);
  articleMetaShell.scrollIntoView({ behavior: "smooth", block: "start" });
  clearFeedback();
});

deleteArticleBtn.addEventListener("click", async () => {
  const article = getSelectedArticle();
  if (!article || !currentPermissions?.canDeleteArticle) {
    return;
  }

  try {
    await apiRequest(`/api/articles/${article.id}`, { method: "DELETE" });
    await loadArticles();
    showFeedback("Article deleted.");
    scrollToTop();
  } catch (error) {
    showFeedback(error.message);
  }
});

articleMetaForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedIds = getSelectedValues(articleFields.assignedJournalistIds);
  const payload = {
    title: validation.normalizeString(articleFields.title.value),
    category: validation.normalizeString(articleFields.category.value),
    author: validation.normalizeString(articleFields.author.value),
    date: articleFields.date.value,
    summary: validation.normalizeString(articleFields.summary.value),
    assignedJournalistIds: selectedIds,
    status: articleFields.status.value,
  };

  const articleError = getValidationMessage(
    selectedArticleId ? validation.validateArticleManagePayload(payload) : validation.validateArticleCreatePayload(payload),
  );
  if (articleError) {
    showFeedback(articleError);
    return;
  }

  try {
    let article;
    if (selectedArticleId) {
      article = await apiRequest(`/api/articles/${selectedArticleId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      showFeedback("Article setup updated.");
    } else {
      article = await apiRequest("/api/articles", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showFeedback("Article created.");
    }

    await loadArticles(article.id);
    scrollToTop();
  } catch (error) {
    showFeedback(error.message);
  }
});

paragraphCancelBtn.addEventListener("click", () => {
  fillParagraphForm(null);
  clearFeedback();
});

paragraphForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const article = getSelectedArticle();
  if (!article) {
    showFeedback("Select an article first.");
    return;
  }

  try {
    const uploadedImages = await uploadParagraphImages(article.id);
    const payload = {
      text: validation.normalizeString(paragraphFields.text.value),
      images: [...getKeptExistingImages(), ...uploadedImages],
    };
    const paragraphError = getValidationMessage(validation.validateParagraphPayload(payload));
    if (paragraphError) {
      showFeedback(paragraphError);
      return;
    }

    if (paragraphFields.id.value) {
      await apiRequest(`/api/articles/${article.id}/paragraphs/${paragraphFields.id.value}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showFeedback("Paragraph updated.");
    } else {
      await apiRequest(`/api/articles/${article.id}/paragraphs`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showFeedback("Paragraph added.");
    }

    await loadArticles(article.id);
    fillParagraphForm(null);
    scrollToTop();
  } catch (error) {
    showFeedback(error.message);
  }
});

restoreSession();
