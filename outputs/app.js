const storageKey = "sankofa-budget-desk-state";
const colors = ["#00f5d4", "#f15bb5", "#fee440", "#7b2cff", "#43aa8b", "#ff6b35", "#3a86ff"];

const fallbackNews = [
  {
    title: "Budget check: grocery and housing pressure still shape household plans",
    source: "Sample free feed fallback",
    date: "Today",
    url: ""
  },
  {
    title: "Simple cash buffers can soften surprise bills without paid tools",
    source: "Sample free feed fallback",
    date: "This week",
    url: ""
  },
  {
    title: "Community finance groups share low-cost saving habits for summer",
    source: "Sample free feed fallback",
    date: "This week",
    url: ""
  }
];

const defaultState = {
  income: 5200,
  categories: {
    Housing: 1520,
    Food: 620,
    Transport: 420,
    Joy: 360,
    Debt: 300,
    Savings: 950
  },
  months: [
    { label: "Jan", income: 4700, spend: 3650, savings: 580 },
    { label: "Feb", income: 4850, spend: 3720, savings: 660 },
    { label: "Mar", income: 4925, spend: 3810, savings: 720 },
    { label: "Apr", income: 5050, spend: 3880, savings: 790 },
    { label: "May", income: 5125, spend: 4010, savings: 850 }
  ],
  transactions: [
    { name: "Rent portal", category: "Housing", amount: 1520, date: "Jun 01" },
    { name: "Market run", category: "Food", amount: 96, date: "Jun 04" },
    { name: "Train pass", category: "Transport", amount: 128, date: "Jun 06" },
    { name: "Record crate", category: "Joy", amount: 42, date: "Jun 09" },
    { name: "Loan payment", category: "Debt", amount: 300, date: "Jun 12" }
  ]
};

let state = loadState();

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function $(selector) {
  return document.querySelector(selector);
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? normalizeState(JSON.parse(raw)) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(nextState) {
  return {
    ...structuredClone(defaultState),
    ...nextState,
    categories: {
      ...defaultState.categories,
      ...(nextState.categories || {})
    },
    months: Array.isArray(nextState.months) ? nextState.months : structuredClone(defaultState.months),
    transactions: Array.isArray(nextState.transactions) ? nextState.transactions : structuredClone(defaultState.transactions)
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function getPlannedSpend() {
  return Object.entries(state.categories)
    .filter(([name]) => name !== "Savings")
    .reduce((sum, [, value]) => sum + value, 0);
}

function getTotalOutflow() {
  return Object.values(state.categories).reduce((sum, value) => sum + value, 0);
}

function getCurrentMonth() {
  return {
    label: "Now",
    income: state.income,
    spend: getPlannedSpend(),
    savings: state.categories.Savings || 0
  };
}

function updateInputs() {
  $("#income").value = state.income;
  $("#housing").value = state.categories.Housing || 0;
  $("#food").value = state.categories.Food || 0;
  $("#transport").value = state.categories.Transport || 0;
  $("#debt").value = state.categories.Debt || 0;
  $("#savings").value = state.categories.Savings || 0;
}

function renderSummary() {
  const spend = getPlannedSpend();
  const total = getTotalOutflow();
  const left = state.income - total;
  const savingsRate = state.income > 0 ? Math.round(((state.categories.Savings || 0) / state.income) * 100) : 0;

  $("#income-value").textContent = money.format(state.income);
  $("#spend-value").textContent = money.format(spend);
  $("#left-value").textContent = money.format(left);
  $("#left-value").style.color = left < 0 ? "#b00020" : "#0b5f46";
  $("#savings-rate").textContent = `${savingsRate}%`;
}

function renderLedger() {
  const body = $("#ledger-body");
  body.replaceChildren();

  state.transactions.slice(0, 7).forEach((transaction) => {
    const row = document.createElement("tr");
    [transaction.name, transaction.category, money.format(transaction.amount), transaction.date].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.max(260, rect.width);
  const height = Math.max(180, rect.height || Number(canvas.getAttribute("height")) || 220);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function drawGrid(ctx, width, height, pad) {
  ctx.strokeStyle = "rgba(17, 17, 17, .13)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
}

function drawBarChart() {
  const canvas = $("#bar-chart");
  const { ctx, width, height } = setupCanvas(canvas);
  const months = [...state.months.slice(-5), getCurrentMonth()];
  const pad = { top: 24, right: 18, bottom: 36, left: 52 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(...months.flatMap((month) => [month.income, month.spend]), 1) * 1.18;

  drawGrid(ctx, width, height, pad);
  ctx.font = "700 12px Tahoma, sans-serif";
  ctx.fillStyle = "#222";
  ctx.fillText(money.format(maxValue), 8, pad.top + 4);

  const group = plotWidth / months.length;
  const barWidth = Math.max(10, group * .28);

  months.forEach((month, index) => {
    const x = pad.left + group * index + group * .24;
    const incomeHeight = (month.income / maxValue) * plotHeight;
    const spendHeight = (month.spend / maxValue) * plotHeight;
    const base = height - pad.bottom;

    ctx.fillStyle = "#00f5d4";
    ctx.fillRect(x, base - incomeHeight, barWidth, incomeHeight);
    ctx.fillStyle = "#f15bb5";
    ctx.fillRect(x + barWidth + 5, base - spendHeight, barWidth, spendHeight);

    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.fillText(month.label, x + barWidth, height - 12);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#00f5d4";
  ctx.fillRect(width - 168, 12, 12, 12);
  ctx.fillStyle = "#111";
  ctx.fillText("Income", width - 150, 23);
  ctx.fillStyle = "#f15bb5";
  ctx.fillRect(width - 88, 12, 12, 12);
  ctx.fillStyle = "#111";
  ctx.fillText("Spend", width - 70, 23);
}

function drawLineChart() {
  const canvas = $("#line-chart");
  const { ctx, width, height } = setupCanvas(canvas);
  const months = [...state.months.slice(-5), getCurrentMonth()];
  const pad = { top: 24, right: 20, bottom: 34, left: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const savings = months.reduce((running, month) => {
    const previous = running.length ? running[running.length - 1].value : 0;
    running.push({ label: month.label, value: previous + month.savings });
    return running;
  }, []);
  const maxValue = Math.max(...savings.map((point) => point.value), 1) * 1.12;

  drawGrid(ctx, width, height, pad);

  ctx.beginPath();
  savings.forEach((point, index) => {
    const x = pad.left + (plotWidth / Math.max(1, savings.length - 1)) * index;
    const y = height - pad.bottom - (point.value / maxValue) * plotHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#7b2cff";
  ctx.stroke();

  savings.forEach((point, index) => {
    const x = pad.left + (plotWidth / Math.max(1, savings.length - 1)) * index;
    const y = height - pad.bottom - (point.value / maxValue) * plotHeight;
    ctx.fillStyle = index % 2 ? "#fee440" : "#00f5d4";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.font = "700 12px Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(point.label, x, height - 11);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#222";
  ctx.fillText("Projected stash", 12, 22);
}

function drawPieChart() {
  const canvas = $("#pie-chart");
  const { ctx, width, height } = setupCanvas(canvas);
  const entries = Object.entries(state.categories).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  const radius = Math.min(width, height) * .36;
  const centerX = width / 2;
  const centerY = height / 2;
  let start = -Math.PI / 2;

  entries.forEach(([name, value], index) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * .42, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.font = "700 13px Tahoma, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Mix", centerX, centerY + 4);

  const legend = $("#pie-legend");
  legend.replaceChildren();
  entries.forEach(([name, value], index) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.style.background = colors[index % colors.length];
    const label = document.createElement("span");
    label.textContent = `${name} ${Math.round((value / total) * 100)}%`;
    item.append(swatch, label);
    legend.append(item);
  });
}

function renderCharts() {
  drawBarChart();
  drawLineChart();
  drawPieChart();
}

function renderAll() {
  updateInputs();
  renderSummary();
  renderLedger();
  renderCharts();
}

function updateStatus(message) {
  $("#status-note").textContent = message;
}

function handleBudgetSubmit(event) {
  event.preventDefault();
  const income = toNumber($("#income").value);
  const housing = toNumber($("#housing").value);
  const food = toNumber($("#food").value);
  const transport = toNumber($("#transport").value);
  const debt = toNumber($("#debt").value);
  const savings = toNumber($("#savings").value);
  const fixed = housing + food + transport + debt + savings;

  state.income = income;
  state.categories = {
    Housing: housing,
    Food: food,
    Transport: transport,
    Joy: Math.max(0, income - fixed),
    Debt: debt,
    Savings: savings
  };

  saveState();
  renderAll();
  updateStatus("Budget saved locally");
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  const name = $("#expense-name").value.trim() || "New expense";
  const category = $("#expense-category").value;
  const amount = toNumber($("#expense-amount").value);
  if (!amount) return;

  state.categories[category] = (state.categories[category] || 0) + amount;
  state.transactions.unshift({
    name,
    category,
    amount,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" })
  });
  state.transactions = state.transactions.slice(0, 12);

  saveState();
  renderAll();
  updateStatus("Expense added locally");
}

function rebalanceBudget() {
  state.categories = {
    Housing: Math.round(state.income * .32),
    Food: Math.round(state.income * .12),
    Transport: Math.round(state.income * .06),
    Joy: Math.round(state.income * .20),
    Debt: Math.round(state.income * .10),
    Savings: Math.round(state.income * .20)
  };
  saveState();
  renderAll();
  updateStatus("Rebalanced to a 50/30/20 style split");
}

function exportCsv() {
  const rows = [
    ["Item", "Category", "Amount", "Date"],
    ...state.transactions.map((transaction) => [
      transaction.name,
      transaction.category,
      transaction.amount,
      transaction.date
    ])
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sankofa-budget.csv";
  link.click();
  URL.revokeObjectURL(url);
  updateStatus("CSV exported");
}

function resetDemo() {
  state = structuredClone(defaultState);
  saveState();
  renderAll();
  updateStatus("Demo data restored");
}

function renderNews(items, sourceLabel) {
  const feed = $("#news-feed");
  feed.replaceChildren();
  $("#news-source").textContent = sourceLabel;

  items.slice(0, 6).forEach((item) => {
    const node = item.url ? document.createElement("a") : document.createElement("article");
    node.className = "news-item";
    if (item.url) {
      node.href = item.url;
      node.target = "_blank";
      node.rel = "noopener";
    }

    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = `${item.source || "Free public source"} | ${item.date || "Recent"}`;
    node.append(title, meta);
    feed.append(node);
  });
}

async function loadFreeNews() {
  renderNews(fallbackNews.slice(0, 1), "Loading free public feed...");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2200);
  const query = '(budget OR "personal finance" OR inflation OR "cost of living")';
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: "6",
    sort: "hybridrel",
    timespan: "7d"
  });
  const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;

  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("Feed unavailable");
    const data = await response.json();
    const articles = (data.articles || []).map((article) => ({
      title: article.title,
      source: article.domain || "GDELT",
      date: article.seendate ? article.seendate.slice(0, 8) : "Recent",
      url: article.url
    })).filter((article) => article.title);

    if (!articles.length) throw new Error("No feed items");
    renderNews(articles, "Live free public feed via GDELT");
  } catch {
    renderNews(fallbackNews, "Offline fallback, no paid API needed");
  } finally {
    window.clearTimeout(timeout);
  }
}

function tickClock() {
  $("#clock").textContent = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function wireEvents() {
  $("#budget-form").addEventListener("submit", handleBudgetSubmit);
  $("#expense-form").addEventListener("submit", handleExpenseSubmit);
  $("#quick-expense").addEventListener("click", () => {
    $("#expense-name").focus();
    updateStatus("Expense form ready");
  });
  $("#rebalance").addEventListener("click", rebalanceBudget);
  $("#export-csv").addEventListener("click", exportCsv);
  $("#reset-demo").addEventListener("click", resetDemo);
  $("#refresh-news").addEventListener("click", loadFreeNews);
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(renderCharts);
  });
}

wireEvents();
renderAll();
loadFreeNews();
tickClock();
setInterval(tickClock, 15000);
