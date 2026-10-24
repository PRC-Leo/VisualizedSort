// 鸡尾酒排序（双向冒泡）：一轮内先从左向右冒泡，再从右向左冒泡。
export const meta = {
  id: "cocktail",
  zh: "鸡尾酒排序",
  en: "Cocktail Sort",
  pseudocode: [
    "left 与 right 分别指向未排序区间的两端",
    "从左向右扫描：比较相邻两元素",
    "若左元素 > 右元素则交换",
    "从右向左扫描：比较相邻两元素",
    "若左元素 > 右元素则交换",
    "一轮结束，两端各有一个元素就位，区间向内收缩",
    "标记已就位的一端",
    "区间收缩到不足两个元素，排序完成",
  ],
  complexity: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
};

const L_COMPARE_FWD = 1;
const L_SWAP_FWD = 2;
const L_COMPARE_BWD = 3;
const L_SWAP_BWD = 4;
const L_MARK = 6;
const L_DONE = 7;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];
  let left = 0;
  let right = n - 1;

  while (left < right) {
    let swapped = false;
    for (let i = left; i < right; i++) {
      steps.push({ op: "compare", a: i, b: i + 1, line: L_COMPARE_FWD });
      if (a[i] > a[i + 1]) {
        const t = a[i];
        a[i] = a[i + 1];
        a[i + 1] = t;
        steps.push({ op: "swap", a: i, b: i + 1, line: L_SWAP_FWD });
        swapped = true;
      }
    }
    steps.push({ op: "mark", index: right, line: L_MARK });
    right--;
    if (left >= right) break;

    for (let i = right; i > left; i--) {
      steps.push({ op: "compare", a: i - 1, b: i, line: L_COMPARE_BWD });
      if (a[i - 1] > a[i]) {
        const t = a[i - 1];
        a[i - 1] = a[i];
        a[i] = t;
        steps.push({ op: "swap", a: i - 1, b: i, line: L_SWAP_BWD });
        swapped = true;
      }
    }
    steps.push({ op: "mark", index: left, line: L_MARK });
    left++;
    if (!swapped) break;
  }

  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
