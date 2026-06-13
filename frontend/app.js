const articleList = document.getElementById("articleList");
const articleDetail = document.getElementById("articleDetail");
const articleCounter = document.getElementById("articleCount");
const feedbackBanner = document.getElementById("feedbackBanner");

const articleForm = document.getElementById("articleForm");
const formHeading = document.getElementById("formHeading");
const createArticleBtn = document.getElementById("createArticleBtn");
const editArticleBtn = document.getElementById("editArticleBtn");
const deleteArticleBtn = document.getElementById("deleteArticleBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const formFields = {
  id: document.getElementById("articleId"),
  title: document.getElementById("titleInput"),
  category: document.getElementById("categoryInput"),
  author: document.getElementById("authorInput"),
  date: document.getElementById("dateInput"),
  summary: document.getElementById("summaryInput"),
  content: document.getElementById("contentInput"),
};

let articles = [];
let selectedArticleId = null;
let editingArticleId = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Something went wrong.";

    try {
      const errorPayload = await response.json();
      message = errorPayload.message || message;
    } catch {
      // Ignore malformed error bodies and use the default message.
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

function getSelectedArticle() {
  return articles.find((article) => article.id === selectedArticleId) ?? null;
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
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function setFormMode(mode, article = null) {
  if (mode === "edit" && article) {
    formHeading.textContent = "Edit Article";
    cancelEditBtn.classList.remove("hidden");
    editingArticleId = article.id;
    formFields.id.value = article.id;
    formFields.title.value = article.title;
    formFields.category.value = article.category;
    formFields.author.value = article.author;
    formFields.date.value = article.date;
    formFields.summary.value = article.summary;
    formFields.content.value = article.content;
    return;
  }

  formHeading.textContent = "Create Article";
  cancelEditBtn.classList.add("hidden");
  editingArticleId = null;
  articleForm.reset();
  formFields.id.value = "";
  formFields.date.value = new Date().toISOString().slice(0, 10);
}

function renderList() {
  articleList.innerHTML = "";
  articleCounter.textContent = `${articles.length} article${articles.length === 1 ? "" : "s"}`;

  articles.forEach((article) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `article-card${article.id === selectedArticleId ? " active" : ""}`;
    button.innerHTML = `
      <div class="meta-pill">${article.category}</div>
      <h3 class="article-title">${article.title}</h3>
      <p class="article-summary">${article.summary}</p>
      <div class="card-meta">
        <span>${article.author}</span>
        <span>${formatDate(article.date)}</span>
      </div>
    `;

    button.addEventListener("click", async () => {
      try {
        const articleDetails = await apiRequest(`/api/articles/${article.id}`);
        selectedArticleId = articleDetails.id;
        renderList();
        renderDetail(articleDetails);
        setFormMode("create");
        scrollToTop();
        clearFeedback();
      } catch (error) {
        showFeedback(error.message);
      }
    });

    articleList.appendChild(button);
  });
}

function renderDetail(article) {
  if (!article) {
    articleDetail.innerHTML = '<p class="detail-placeholder">Create or select an article to see it here.</p>';
    editArticleBtn.disabled = true;
    deleteArticleBtn.disabled = true;
    return;
  }

  editArticleBtn.disabled = false;
  deleteArticleBtn.disabled = false;

  articleDetail.innerHTML = `
    <div class="meta-pill">${article.category}</div>
    <h2 class="detail-title">${article.title}</h2>
    <div class="detail-meta">
      <span><strong>Author:</strong> ${article.author}</span>
      <span><strong>Date:</strong> ${formatDate(article.date)}</span>
    </div>
    <p class="detail-summary">${article.summary}</p>
    <div class="detail-content">${article.content}</div>
  `;
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
    return;
  }

  const selectedArticle = await apiRequest(`/api/articles/${selectedArticleId}`);
  renderDetail(selectedArticle);
}

function getFormPayload() {
  return {
    title: formFields.title.value.trim(),
    category: formFields.category.value.trim(),
    author: formFields.author.value.trim(),
    date: formFields.date.value,
    summary: formFields.summary.value.trim(),
    content: formFields.content.value.trim(),
  };
}

createArticleBtn.addEventListener("click", () => {
  setFormMode("create");
  formFields.title.focus();
  clearFeedback();
});

editArticleBtn.addEventListener("click", async () => {
  const article = getSelectedArticle();

  if (!article) {
    return;
  }

  try {
    const articleDetails = await apiRequest(`/api/articles/${article.id}`);
    setFormMode("edit", articleDetails);
    formFields.title.focus();
    clearFeedback();
  } catch (error) {
    showFeedback(error.message);
  }
});

cancelEditBtn.addEventListener("click", () => {
  setFormMode("create");
  clearFeedback();
});

deleteArticleBtn.addEventListener("click", async () => {
  const article = getSelectedArticle();

  if (!article) {
    return;
  }

  try {
    await apiRequest(`/api/articles/${article.id}`, {
      method: "DELETE",
    });

    await loadArticles();
    setFormMode("create");
    showFeedback("Article deleted.");
    scrollToTop();
  } catch (error) {
    showFeedback(error.message);
  }
});

articleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = getFormPayload();
  const isEditing = Boolean(editingArticleId);

  try {
    const savedArticle = await apiRequest(
      isEditing ? `/api/articles/${editingArticleId}` : "/api/articles",
      {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );

    await loadArticles(savedArticle.id);
    setFormMode("create");
    showFeedback(isEditing ? "Article updated." : "Article created.");
    scrollToTop();
  } catch (error) {
    showFeedback(error.message);
  }
});

async function initializeApp() {
  try {
    await loadArticles();
    setFormMode("create");
    clearFeedback();
  } catch (error) {
    showFeedback(error.message);
  }
}

initializeApp();
