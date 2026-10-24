// 奇偶排序：交替比较 (奇数位, 奇数位+1) 与 (偶数位, 偶数位+1) 两组相邻对。
export const meta = {
  id: "oddEven",
  zh: "奇偶排序",
  en: "Odd-Even Sort",
  pseudocode: [
    "开始一轮奇偶遍历",
    "奇数轮：比较 (1,2)、(3,4)… 这些相邻对",
    "若左元素 > 右元素则交换",
    "偶数轮：比较 (0,1)、(2,3)… 这些相邻对",
    "若左元素 > 右元素则交换",
    "若一轮中没有任何交换，说明数组已有序",
    "标记全部元素已就位",
    "奇偶排序结束",
  ],
  complexity: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
};

const L_COMPARE_ODD = 1;
const L_SWAP_ODD = 2;
const L_COMPARE_EVEN = 3;
const L_SWAP_EVEN = 4;
const L_MARK = 6;
const L_DONE = 7;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];
  let swapped = true;

  while (swapped) {
    swapped = false;
    // 奇数轮
    for (let i = 1; i + 1 < n; i += 2) {
      steps.push({ op: "compare", a: i, b: i + 1, line: L_COMPARE_ODD });
      if (a[i] > a[i + 1]) {
        const t = a[i];
        a[i] = a[i + 1];
        a[i + 1] = t;
        steps.push({ op: "swap", a: i, b: i + 1, line: L_SWAP_ODD });
        swapped = true;
      }
    }
    // 偶数轮
    for (let i = 0; i + 1 < n; i += 2) {
      steps.push({ op: "compare", a: i, b: i + 1, line: L_COMPARE_EVEN });
      if (a[i] > a[i + 1]) {
        const t = a[i];
        a[i] = a[i + 1];
        a[i + 1] = t;
        steps.push({ op: "swap", a: i, b: i + 1, line: L_SWAP_EVEN });
        swapped = true;
      }
    }
  }

  for (let i = 0; i < n; i++) steps.push({ op: "mark", index: i, line: L_MARK });
  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
