// 冒泡排序：相邻两两比较，较大值逐轮沉到末尾。
export const meta = {
  id: "bubble",
  zh: "冒泡排序",
  en: "Bubble Sort",
  pseudocode: [
    "外层 i 从 0 到 n-2，逐轮收缩未排序区间",
    "内层 j 从 0 到 n-2-i，相邻两两比较",
    "比较 array[j] 与 array[j+1]",
    "若左元素 > 右元素则交换二者",
    "若一轮中没有发生交换，说明已有序，提前结束",
    "标记本轮末尾元素已就位",
    "全部元素就位，排序完成",
  ],
  complexity: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
};

const L_COMPARE = 2;
const L_SWAP = 3;
const L_MARK = 5;
const L_DONE = 6;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];

  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      steps.push({ op: "compare", a: j, b: j + 1, line: L_COMPARE });
      if (a[j] > a[j + 1]) {
        const t = a[j];
        a[j] = a[j + 1];
        a[j + 1] = t;
        steps.push({ op: "swap", a: j, b: j + 1, line: L_SWAP });
        swapped = true;
      }
    }
    steps.push({ op: "mark", index: n - 1 - i, line: L_MARK });
    if (!swapped) break;
  }

  if (n > 0) steps.push({ op: "mark", index: 0, line: L_MARK });
  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
