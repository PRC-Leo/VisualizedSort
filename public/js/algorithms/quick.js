// 快速排序：Lomuto 分区，取区间末尾元素为基准。
export const meta = {
  id: "quick",
  zh: "快速排序",
  en: "Quick Sort",
  pseudocode: [
    "若区间长度 <= 1，直接返回",
    "取区间末尾元素作为基准 pivot",
    "i 指向区间起点，j 从区间起点遍历到 pivot 前一位",
    "比较 array[j] 与 pivot",
    "若 array[j] < pivot，交换 i 与 j 两位置，i 后移",
    "遍历结束，把 pivot 换到 i 位置",
    "标记 i 位置的基准元素已就位",
    "递归处理基准左右两个子区间",
    "全部区间处理完毕，排序结束",
  ],
  complexity: {
    time: { worst: "O(n²)", average: "O(nlogn)", best: "O(nlogn)" },
    space: "O(1)",
    inPlace: "是",
    stable: "否",
  },
};

const L_COMPARE = 3;
const L_SWAP = 4;
const L_PIVOT = 5;
const L_MARK = 6;
const L_DONE = 8;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];

  function partition(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) {
      // 单元素区间天然有序
      steps.push({ op: "mark", index: lo, line: L_MARK });
      return;
    }
    const pivot = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      steps.push({ op: "compare", a: j, b: hi, line: L_COMPARE });
      if (a[j] < pivot) {
        if (i !== j) {
          const t = a[i];
          a[i] = a[j];
          a[j] = t;
          steps.push({ op: "swap", a: i, b: j, line: L_SWAP });
        }
        i++;
      }
    }
    if (i !== hi) {
      const t = a[i];
      a[i] = a[hi];
      a[hi] = t;
      steps.push({ op: "swap", a: i, b: hi, line: L_PIVOT });
    }
    steps.push({ op: "mark", index: i, line: L_MARK });
    partition(lo, i - 1);
    partition(i + 1, hi);
  }

  partition(0, n - 1);
  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
