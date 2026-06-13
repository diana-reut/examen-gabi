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

const articleMetaShell = document.getElementById("articleMetaShell");
const articleMetaHeading = document.getElementById("articleMetaHeading");
const articleMetaForm = document.getElementById("articleMetaForm");
const paragraphShell = document.getElementById("paragraphShell");
const paragraphForm = document.getElementById("paragraphForm");
const paragraphSubmitBtn = document.getElementById("paragraphSubmitBtn");
const paragraphCancelBtn = document.getElementById("paragraphCancelBtn");

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
    return "";
  }

  if (currentUser.role === "Admin") {
    return "Admins can manage article metadata, paragraphs, images, comments, and deletion.";
  }

  if (currentUser.role === "Editor") {
    return "Editors create articles, assign one or two journalists, mark an article as finished, and leave paragraph comments. They cannot write paragraphs or upload images.";
  }

  if (currentUser.role === "Journalist") {
    return "Journalists only see articles assigned to them and can add or edit paragraphs plus upload images for those articles.";
  }

  return "Readers only see finished articles.";
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
  userPanel.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  loginForm.classList.remove("hidden");
  articleList.innerHTML = "";
  articleCounter.textContent = "0 articles";
  articleDetail.innerHTML = '<p class="detail-placeholder">Log in to load articles.</p>';
  articleMetaShell.classList.add("hidden");
  paragraphShell.classList.add("hidden");
  deleteArticleBtn.classList.add("hidden");
  createArticleShortcutBtn.classList.add("hidden");
  setRoleTheme(null);
  resetForms();
}

function applyPermissions() {
  const article = getSelectedArticle();
  const canCreateArticle = Boolean(currentPermissions?.canCreateArticle);
  const canManageArticle = Boolean(currentPermissions?.canManageArticle);
  const canWriteParagraphs = Boolean(currentPermissions?.canWriteParagraphs);
  const canDeleteArticle = Boolean(currentPermissions?.canDeleteArticle);

  const canManageSelected = article && (currentUser.role === "Admin" || article.createdByUserId === currentUser.id);
  const canWriteSelected = article && (currentUser.role === "Admin" || article.assignedJournalistIds.includes(currentUser.id));

  createArticleShortcutBtn.classList.toggle("hidden", !canCreateArticle);
  articleMetaShell.classList.toggle("hidden", !(canCreateArticle || (canManageArticle && canManageSelected)));
  paragraphShell.classList.toggle("hidden", !(canWriteParagraphs && canWriteSelected));
  deleteArticleBtn.classList.toggle("hidden", !canDeleteArticle);
  deleteArticleBtn.disabled = !canDeleteArticle || !article;
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

  articleMetaHeading.textContent = "Update Article Setup";
  articleFields.title.value = article.title;
  articleFields.category.value = article.category;
  articleFields.author.value = article.author;
  articleFields.date.value = article.date;
  articleFields.summary.value = article.summary;
  articleFields.status.value = article.status;
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

function renderParagraphCommentForm(paragraph) {
  if (!(currentUser && (currentUser.role === "Admin" || currentUser.role === "Editor"))) {
    return "";
  }

  const article = getSelectedArticle();
  if (!article) {
    return "";
  }

  if (currentUser.role === "Editor" && article.createdByUserId !== currentUser.id) {
    return "";
  }

  return `
    <form class="comment-form" data-paragraph-id="${paragraph.id}">
      <textarea name="commentText" rows="3" placeholder="Leave a comment for this paragraph..."></textarea>
      <button class="secondary-button" type="submit">Add comment</button>
    </form>
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

  const paragraphsHtml = article.paragraphs.length
    ? article.paragraphs
        .map((paragraph, index) => {
          const imagesHtml = paragraph.images.length
            ? `<div class="paragraph-images">${paragraph.images
                .map((image) => `<img src="${image.url}" alt="Paragraph image ${index + 1}">`)
                .join("")}</div>`
            : `<p class="empty-inline">No images added for this paragraph yet.</p>`;

          const commentsHtml = paragraph.comments.length
            ? `<div class="comments-list">${paragraph.comments
                .map(
                  (comment) => `
                    <div class="comment-item">
                      <div class="comment-meta">${comment.authorName} (${comment.authorRole})</div>
                      <div>${comment.text}</div>
                    </div>
                  `,
                )
                .join("")}</div>`
            : `<p class="empty-inline">No editor comments yet.</p>`;

          return `
            <section class="paragraph-card">
              <div class="paragraph-actions">
                <h3>Paragraph ${index + 1}</h3>
                ${renderParagraphActions(paragraph)}
              </div>
              <div class="paragraph-meta">Updated by ${paragraph.updatedByName || "Unknown"}${paragraph.updatedAt ? ` on ${new Date(paragraph.updatedAt).toLocaleString("en-GB")}` : ""}</div>
              <p class="paragraph-text">${paragraph.text}</p>
              ${imagesHtml}
              <div class="detail-assignees"><strong>Editor comments</strong></div>
              ${commentsHtml}
              ${renderParagraphCommentForm(paragraph)}
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
    <p class="detail-assignees"><strong>Assigned journalists:</strong> ${article.assignedJournalists.map((entry) => entry.displayName).join(", ") || "No assignments yet"}</p>
    <p class="detail-assignees"><strong>Finished by:</strong> ${article.finishedByEditorName || "Not finished yet"}</p>
    <p class="detail-summary">${article.summary || "No summary added yet."}</p>
    <div class="paragraph-list">${paragraphsHtml}</div>
  `;
}

function attachDetailInteractions() {
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

      const commentText = String(form.querySelector("textarea").value || "").trim();
      if (!commentText) {
        showFeedback("Comment text is required.");
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
      <div class="article-meta-inline">Paragraphs: ${article.paragraphs.length}</div>
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
    resetAuthenticatedState();
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
    resetAuthenticatedState();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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

logoutBtn.addEventListener("click", () => {
  resetAuthenticatedState();
  clearFeedback();
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
    title: articleFields.title.value.trim(),
    category: articleFields.category.value.trim(),
    author: articleFields.author.value.trim(),
    date: articleFields.date.value,
    summary: articleFields.summary.value.trim(),
    assignedJournalistIds: selectedIds,
    status: articleFields.status.value,
  };

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
      text: paragraphFields.text.value.trim(),
      images: [...getKeptExistingImages(), ...uploadedImages],
    };

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
