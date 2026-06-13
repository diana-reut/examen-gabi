import { faker } from "https://esm.sh/@faker-js/faker@9.8.0";

faker.seed(20260613);

const articleCount = 8;
const articleList = document.getElementById("articleList");
const articleDetail = document.getElementById("articleDetail");
const articleCounter = document.getElementById("articleCount");

const categories = [
  "Campus",
  "Research",
  "Student Life",
  "Culture",
  "Education",
  "Opinion",
];

const articles = Array.from({ length: articleCount }, (_, index) => createArticle(index));
let selectedArticleId = articles[0]?.id ?? null;

function createArticle(index) {
  const title = faker.helpers.arrayElement([
    "New initiatives are reshaping classroom life at UBB",
    "Why student communities matter more than ever",
    "A closer look at digital journalism in schools",
    "Teachers and students build a shared editorial culture",
    "How ideas move from campus events into the newsletter",
    "Reading, writing, and reflection in a changing school",
  ]);

  const paragraphs = faker.lorem.paragraphs({ min: 3, max: 5 }, "\n\n");
  const publishedAt = faker.date.between({
    from: "2026-05-01T00:00:00.000Z",
    to: "2026-06-13T00:00:00.000Z",
  });

  return {
    id: `${index}-${faker.string.uuid()}`,
    category: faker.helpers.arrayElement(categories),
    title,
    author: faker.person.fullName(),
    date: publishedAt.toISOString().slice(0, 10),
    summary: faker.lorem.sentences({ min: 2, max: 3 }),
    content: paragraphs,
  };
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

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function renderList() {
  articleList.innerHTML = "";
  articleCounter.textContent = `${articles.length} articles`;

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

    button.addEventListener("click", () => {
      selectedArticleId = article.id;
      renderList();
      renderDetail(getSelectedArticle());
      scrollToTop();
    });

    articleList.appendChild(button);
  });
}

function renderDetail(article) {
  if (!article) {
    articleDetail.innerHTML = '<p class="detail-placeholder">Select an article to read it here.</p>';
    return;
  }

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

renderList();
renderDetail(getSelectedArticle());
