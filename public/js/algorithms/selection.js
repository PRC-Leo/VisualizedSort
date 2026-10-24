// 选择排序：每轮从未排序区间中挑出最小值，放到区间起点。
export const meta = {
  id: "selection",
  zh: "选择排序",
  en: "Selection Sort",
  pseudocode: [
    "外层 i 从 0 到 n-2",
    "设最小值下标 min = i",
    "内层 j 从 i+1 到 n-1 遍历",
    "比较 array[j] 与 array[min]",
    "若 array[j] 更小，则更新 min",
    "内层结束，交换 i 与 min 两个位置",
    "标记第 i 位已就位",
    "剩余元素就位，排序完成",
  ],
  complexity: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n²)" },
    space: "O(1)",
    inPlace: "是",
    stable: "否",
  },
};

const L_COMPARE = 3;
const L_SWAP = 5;
const L_MARK = 6;
const L_DONE = 7;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];

  for (let i = 0; i < n - 1; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      steps.push({ op: "compare", a: j, b: min, line: L_COMPARE });
      if (a[j] < a[min]) min = j;
    }
    if (min !== i) {
      const t = a[i];
      a[i] = a[min];
      a[min] = t;
      steps.push({ op: "swap", a: i, b: min, line: L_SWAP });
    }
    steps.push({ op: "mark", index: i, line: L_MARK });
  }

  if (n > 0) steps.push({ op: "mark", index: n - 1, line: L_MARK });
  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
