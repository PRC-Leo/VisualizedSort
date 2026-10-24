// 伪代码面板：只负责把给定行渲染进容器，并切换高亮行

const EMPTY_TEXT = "请先选择排序算法";

function requireList(olElement) {
  return olElement || null;
}

function appendEmptyState(olElement) {
  olElement.textContent = EMPTY_TEXT;
  olElement.setAttribute("data-empty", "true");
}

// 重建整个列表；activeLine 为 0-based 行号，-1 表示不高亮
export function renderPseudocode(olElement, lines, activeLine = -1) {
  const list = requireList(olElement);
  if (!list) return;

  list.replaceChildren();
  list.removeAttribute("data-empty");

  const rows = Array.isArray(lines) ? lines : [];
  if (rows.length === 0) {
    appendEmptyState(list);
    return;
  }

  const active = Number.isInteger(activeLine) ? activeLine : -1;
  const fragment = list.ownerDocument.createDocumentFragment();
  rows.forEach((line, index) => {
    const item = list.ownerDocument.createElement("li");
    item.className = index === active ? "code-line is-active" : "code-line";
    item.textContent = String(line ?? "");
    fragment.appendChild(item);
  });
  list.appendChild(fragment);
}

// 只切换 is-active，不重建 DOM
export function setActiveLine(olElement, activeLine) {
  if (!olElement || typeof olElement.querySelectorAll !== "function") return;
  const active = Number.isInteger(activeLine) ? activeLine : -1;
  olElement.querySelectorAll(".code-line").forEach((item, index) => {
    item.classList.toggle("is-active", index === active);
  });
}

export function clearPseudocode(olElement) {
  if (!olElement) return;
  olElement.replaceChildren();
  olElement.removeAttribute("data-empty");
}
