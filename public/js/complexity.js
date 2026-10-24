// 复杂度面板：把算法 meta 里的复杂度信息渲染成标题 + 三列表 + 一行属性

const EMPTY_TEXT = "请先选择排序算法";
const DASH = "—";

const TIME_COLUMNS = [
  { label: "最差", keys: ["worst", "worstCase", "worst_case", "最差"] },
  { label: "平均", keys: ["average", "avg", "averageCase", "average_case", "平均"] },
  { label: "最好", keys: ["best", "bestCase", "best_case", "最好"] },
];

const SPACE_KEYS = ["space", "spaceComplexity", "space_complexity", "空间"];
const IN_PLACE_KEYS = ["inPlace", "in_place", "inplace", "原地"];
const STABLE_KEYS = ["stable", "isStable", "is_stable", "稳定"];

function pick(source, keys) {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

// 兼容 { worst, average, best } 与 { time: { worst, ... } } 两种写法
function normalize(meta) {
  if (!meta || typeof meta !== "object") return null;
  const complexity = meta.complexity && typeof meta.complexity === "object" ? meta.complexity : {};
  const time = complexity.time && typeof complexity.time === "object" ? complexity.time : complexity;
  return {
    worst: pick(time, TIME_COLUMNS[0].keys),
    average: pick(time, TIME_COLUMNS[1].keys),
    best: pick(time, TIME_COLUMNS[2].keys),
    space: pick(complexity, SPACE_KEYS),
    inPlace: pick(complexity, IN_PLACE_KEYS),
    stable: pick(complexity, STABLE_KEYS),
  };
}

// "1" -> "O(1)"；已是 "O(n log n)" 则原样保留
function formatBigO(value) {
  if (value === undefined || value === null || value === "") return DASH;
  const text = String(value).trim();
  if (/^[OΘΩ]\s*\(/.test(text)) return text;
  return "O(" + text + ")";
}

function formatYesNo(value) {
  if (value === true) return "是";
  if (value === false) return "否";
  if (value === undefined || value === null || value === "") return DASH;
  return String(value);
}

function createElement(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEmpty(container) {
  container.replaceChildren();
  container.appendChild(createElement(container.ownerDocument, "p", "complexity-empty", EMPTY_TEXT));
  container.setAttribute("data-empty", "true");
}

function buildTitle(meta) {
  const zh = meta && typeof meta.zh === "string" && meta.zh.trim() ? meta.zh.trim() : "";
  const en = meta && typeof meta.en === "string" && meta.en.trim() ? meta.en.trim() : "";
  if (!zh && !en) return "复杂度";
  if (!en) return "复杂度 · " + zh;
  if (!zh) return "复杂度 · " + en;
  return "复杂度 · " + zh + " （" + en + "）";
}

export function renderComplexity(container, meta) {
  if (!container) return;
  const doc = container.ownerDocument;
  const data = normalize(meta);
  if (!data) {
    renderEmpty(container);
    return;
  }

  const fragment = doc.createDocumentFragment();
  fragment.appendChild(createElement(doc, "h3", "complexity-title", buildTitle(meta)));

  const timeBlock = createElement(doc, "div", "complexity-time");
  timeBlock.appendChild(createElement(doc, "h4", "complexity-subtitle", "时间复杂度"));

  const table = createElement(doc, "table", "complexity-table");
  const head = createElement(doc, "thead");
  const headRow = createElement(doc, "tr");
  TIME_COLUMNS.forEach((column) => headRow.appendChild(createElement(doc, "th", "", column.label)));
  head.appendChild(headRow);
  table.appendChild(head);

  const bodyRow = createElement(doc, "tr");
  [data.worst, data.average, data.best].forEach((value) => {
    bodyRow.appendChild(createElement(doc, "td", "", formatBigO(value)));
  });
  const tbody = createElement(doc, "tbody");
  tbody.appendChild(bodyRow);
  table.appendChild(tbody);
  timeBlock.appendChild(table);
  fragment.appendChild(timeBlock);

  // 三项属性沿用样式表里的行式结构：.complexity-row > .complexity-label + .complexity-value
  const facts = createElement(doc, "div", "complexity-facts");
  [
    ["空间", formatBigO(data.space)],
    ["是否原地", formatYesNo(data.inPlace)],
    ["是否稳定", formatYesNo(data.stable)],
  ].forEach(([label, value]) => {
    const row = createElement(doc, "div", "complexity-row");
    row.appendChild(createElement(doc, "span", "complexity-label", label));
    row.appendChild(createElement(doc, "b", "complexity-value", value));
    facts.appendChild(row);
  });
  fragment.appendChild(facts);

  container.replaceChildren(fragment);
  container.removeAttribute("data-empty");
}
