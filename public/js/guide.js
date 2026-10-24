// 引导弹窗：8 页中文说明 + 翻页/圆点/Esc/遮罩关闭逻辑，不负责算法与页面装配

export const GUIDE_PAGES = [
  {
    title: "欢迎来到排序算法可视化器",
    body: [
      "这是一个把排序算法跑给你看的工具，画面里每一根柱子都是一个待排序的数字。",
      "比较、交换、归位这些抽象动作，会用颜色和动画一步步摊开演给你看，而不是只丢给你一个排好的结果。",
      "花上一分钟看完这份引导，之后页面上的每一个开关你都能自己调。",
    ],
    points: [
      "纯前端运行，打开就能用",
      "支持多种经典排序算法",
      "大约一分钟看完",
    ],
    art: "welcome",
  },
  {
    title: "排序算法到底在做什么",
    body: [
      "排序算法就是把一串无序的数字，经过一系列固定的操作，变成从小到大有序的数字。",
      "整个过程中反复发生的其实只有两件事：比较两个数字谁大谁小，必要时交换它们的位置。",
      "当一个数字确定后面再也不会有比它更小的元素时，它就「已就位」了，之后不会再被动到。",
    ],
    points: [
      "比较：判断谁大谁小，决定要不要动",
      "交换：把两个数字的位置对调",
      "已就位：位置已确定，颜色会变",
    ],
    art: "concept",
  },
  {
    title: "先挑一个初始数组",
    body: [
      "数组类型决定一开始这串数字有多乱：随机、基本有序、升序、降序。",
      "最值得先试的是「基本有序」——数据本来就差不多排好了，插入排序会以接近线性的速度跑完，而冒泡排序仍然要老老实实干完全部比较。",
      "想看算法最狼狈的样子，就选「降序」，那几乎是所有排序算法的最坏开局。",
    ],
    points: [
      "随机：最常见的测试数据",
      "基本有序：最能看出插入排序的优势",
      "升序：已经排好，算法只需确认一遍",
      "降序：绝大多数算法的最坏情况",
    ],
    art: "array-type",
  },
  {
    title: "调整数组规模",
    body: [
      "规模滑块控制柱子的数量，范围是 10 到 100 个。",
      "规模翻倍时，步骤数通常涨得更快，这正是复杂度表里 O(n²) 与 O(n log n) 的差别所在。",
      "如果想要一次震撼的体验，直接把规模拉到 100 根柱子。",
    ],
    points: [
      "10 根：适合一步步看清每个动作",
      "100 根：整个排序过程一气呵成",
      "规模越大，步骤越多、耗时越长",
    ],
    art: "size",
  },
  {
    title: "用速度滑块控制节奏",
    body: [
      "速度滑块从慢到快：越慢，每一步停留越久，越适合盯着伪代码一行一行对照。",
      "把速度拉满再配上一个 100 根柱子的数组，画面会像放烟花一样刷过去。",
      "排序进行中也可以随时改速度，不必重来。",
    ],
    points: [
      "慢速：配合伪代码学算法",
      "快速：感受整体走势和节奏",
      "速度可以边跑边调",
    ],
    art: "speed",
  },
  {
    title: "选算法，然后开始",
    body: [
      "在下拉框里选一个算法，页面会立刻载入它的中文伪代码和复杂度信息。",
      "点「开始排序」就开跑；中途想停就点「停止」，数组会停在当前状态。",
      "排序时右侧伪代码会逐行高亮，亮起的那一行就是算法此刻正在执行的动作。",
    ],
    points: [
      "下拉框：随时切换算法",
      "开始排序 / 停止：自己掌控节奏",
      "伪代码逐行高亮，跟着动画走",
    ],
    art: "algorithm",
  },
  {
    title: "读懂右侧的两块面板",
    body: [
      "伪代码面板跟着动画逐行高亮，直接告诉你「算法现在走到哪一步」，不用你猜。",
      "复杂度面板给出最差、平均、最好三种时间复杂度，再加上空间占用、是否原地、是否稳定。",
      "稳定是指相等元素的相对顺序在排序后保持不变：两根一样高的柱子，排完之后谁在前谁在后还是老样子。",
    ],
    points: [
      "最差 / 平均 / 最好：不同输入下的表现",
      "空间：排序需要多少额外内存",
      "原地：是否只在原数组内部倒腾",
      "稳定：相等元素的相对顺序是否保留",
    ],
    art: "panels",
  },
  {
    title: "认识柱子的颜色，然后开始吧",
    body: [
      "柱子的颜色就是算法的进度：还没轮到的柱子是待排序色，被算法碰到时亮起来，位置定下来就换成「已就位」的颜色。",
      "图例里的「正在写入」只有在归并排序、计数排序这类不靠交换、直接把值写回数组的算法里才会频繁出现。",
      "现在整页都归你了：调好类型、规模和速度，点「开始排序」，随便挑一个算法试试。",
    ],
    points: [
      "待排序：还没被处理到的柱子",
      "正在比较 / 正在交换：算法此刻动到的位置",
      "正在写入：把值直接写回数组（归并、计数排序）",
      "已就位：位置已确定，不会再变",
    ],
    art: "done",
  },
];

const LAST_INDEX = GUIDE_PAGES.length - 1;
const FALLBACK_NEXT_TEXT = "下一页";
const LAST_NEXT_TEXT = "开始体验";

// 每种 art 用一组固定高度的装饰柱，纯 CSS 渲染，无图片素材
const ART_BARS = {
  welcome: [34, 62, 45, 78, 54, 88, 66],
  concept: [72, 58, 50, 44, 38, 30, 22],
  "array-type": [80, 34, 66, 48, 58, 40, 28],
  size: [20, 32, 44, 56, 68, 80, 92],
  speed: [46, 88, 32, 74, 40, 62, 26],
  algorithm: [60, 20, 84, 40, 72, 30, 56],
  panels: [50, 92, 50, 92, 50, 92, 50],
  done: [100, 86, 72, 58, 44, 30, 16],
};

function normalizeIndex(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > LAST_INDEX) return LAST_INDEX;
  return numeric;
}

export function createGuide(controls = {}) {
  const { modal, body, dots, prevBtn, nextBtn, skipBtn, closeBtn, onClose } = controls;
  const doc = modal && modal.ownerDocument ? modal.ownerDocument : typeof document !== "undefined" ? document : null;
  const listeners = [];
  const dotButtons = [];
  const defaultNextText = nextBtn && typeof nextBtn.textContent === "string" && nextBtn.textContent.trim()
    ? nextBtn.textContent.trim()
    : FALLBACK_NEXT_TEXT;

  let index = -1;
  let opened = false;

  function listen(target, type, handler) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler);
    listeners.push([target, type, handler]);
  }

  function isVisible() {
    if (opened) return true;
    return Boolean(modal) && modal.hidden === false;
  }

  function buildDots() {
    if (!dots || !doc) return;
    dots.replaceChildren();
    dotButtons.length = 0;
    GUIDE_PAGES.forEach((page, pageIndex) => {
      const dot = doc.createElement("button");
      dot.type = "button";
      dot.className = "guide-dot";
      dot.dataset.index = String(pageIndex);
      dot.setAttribute("aria-label", "第 " + (pageIndex + 1) + " 页：" + page.title);
      dots.appendChild(dot);
      dotButtons.push(dot);
    });
  }

  // 装饰插图只用内联样式的柱形，不依赖图片素材；样式表仍可整体覆盖
  function renderArt(art, fragment) {
    const box = doc.createElement("div");
    box.className = "guide-art";
    box.dataset.art = art;
    box.setAttribute("aria-hidden", "true");
    box.style.display = "flex";
    box.style.alignItems = "flex-end";
    box.style.gap = "4px";
    box.style.height = "48px";
    box.style.margin = "0 0 14px";
    (ART_BARS[art] || ART_BARS.welcome).forEach((height, barIndex) => {
      const bar = doc.createElement("span");
      bar.className = "guide-art-bar";
      bar.style.flex = "1";
      bar.style.height = height + "%";
      bar.style.borderRadius = "4px 4px 0 0";
      bar.style.background = "var(--brand-1, #7c5cff)";
      bar.style.opacity = String(Math.round((0.4 + barIndex * 0.1) * 100) / 100);
      box.appendChild(bar);
    });
    fragment.appendChild(box);
  }

  function renderBody(page) {
    if (!body || !doc) return;
    body.replaceChildren();
    const fragment = doc.createDocumentFragment();

    const heading = doc.createElement("h2");
    heading.className = "guide-title";
    heading.textContent = page.title;
    fragment.appendChild(heading);

    renderArt(page.art, fragment);

    page.body.forEach((text) => {
      const paragraph = doc.createElement("p");
      paragraph.className = "guide-text";
      paragraph.textContent = text;
      fragment.appendChild(paragraph);
    });

    if (Array.isArray(page.points) && page.points.length > 0) {
      const list = doc.createElement("ul");
      list.className = "guide-points";
      page.points.forEach((text) => {
        const item = doc.createElement("li");
        item.textContent = text;
        list.appendChild(item);
      });
      fragment.appendChild(list);
    }

    body.appendChild(fragment);
  }

  function updateDots() {
    dotButtons.forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle("is-active", active);
      if (active) dot.setAttribute("aria-current", "page");
      else dot.removeAttribute("aria-current");
    });
  }

  function updateButtons() {
    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.textContent = index >= LAST_INDEX ? LAST_NEXT_TEXT : defaultNextText;
  }

  function render() {
    const page = GUIDE_PAGES[index];
    if (!page) return;
    renderBody(page);
    updateDots();
    updateButtons();
  }

  function go(target) {
    index = normalizeIndex(target);
    render();
  }

  function open(start = 0) {
    opened = true;
    index = normalizeIndex(start);
    if (modal) {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
    }
    render();
    if (nextBtn && typeof nextBtn.focus === "function") nextBtn.focus();
  }

  function close() {
    const wasVisible = isVisible();
    opened = false;
    if (modal) {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }
    if (wasVisible && typeof onClose === "function") {
      try {
        onClose();
      } catch (error) {
        console.error("guide onClose 回调出错：", error);
      }
    }
  }

  function next() {
    if (index >= LAST_INDEX) {
      close();
      return;
    }
    go(index + 1);
  }

  function prev() {
    if (index <= 0) return;
    go(index - 1);
  }

  function destroy() {
    listeners.forEach(([target, type, handler]) => {
      try {
        target.removeEventListener(type, handler);
      } catch (error) {
        console.error("guide 解绑事件失败：", error);
      }
    });
    listeners.length = 0;
    dotButtons.length = 0;
    if (dots) dots.replaceChildren();
    opened = false;
    index = -1;
  }

  buildDots();
  if (dotButtons.length > 0) updateDots();

  listen(nextBtn, "click", next);
  listen(prevBtn, "click", prev);
  listen(skipBtn, "click", close);
  listen(closeBtn, "click", close);
  listen(modal, "click", (event) => {
    if (event.target === modal) close();
  });
  listen(dots, "click", (event) => {
    const target = event.target;
    const dot = target && typeof target.closest === "function" ? target.closest(".guide-dot") : null;
    if (!dot) return;
    const requested = Number(dot.dataset ? dot.dataset.index : -1);
    if (!Number.isInteger(requested)) return;
    go(requested);
  });
  listen(doc, "keydown", (event) => {
    if (!isVisible()) return;
    if (event.key === "Escape" || event.key === "Esc") close();
  });

  return { open, close, next, prev, destroy };
}
