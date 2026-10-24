// 归并排序：自顶向下二分，再用临时数组把两段有序区间合并回去。
export const meta = {
  id: "merge",
  zh: "归并排序",
  en: "Merge Sort",
  pseudocode: [
    "若区间长度 <= 1，直接返回",
    "取中点 mid，把区间 [lo, hi] 分成左右两段",
    "递归排序左段与右段",
    "把当前区间的元素复制到临时数组",
    "比较左右两段的当前元素，取较小者",
    "把较小者写回原数组，对应指针前移",
    "把剩余未比完的元素依次写回原数组",
    "标记区间内元素已就位",
    "整个数组合并完成，排序结束",
  ],
  complexity: {
    time: { worst: "O(nlogn)", average: "O(nlogn)", best: "O(nlogn)" },
    space: "O(n)",
    inPlace: "否",
    stable: "是",
  },
};

const L_COMPARE = 4;
const L_WRITE = 5;
const L_WRITE_REST = 6;
const L_MARK = 7;
const L_DONE = 8;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];
  const buffer = new Array(n);

  function mergeRange(lo, hi) {
    if (hi - lo < 1) return;
    const mid = (lo + hi) >> 1;
    mergeRange(lo, mid);
    mergeRange(mid + 1, hi);

    for (let k = lo; k <= hi; k++) buffer[k] = a[k];

    let i = lo;
    let j = mid + 1;
    let k = lo;
    while (i <= mid && j <= hi) {
      steps.push({ op: "compare", a: i, b: j, line: L_COMPARE });
      if (buffer[i] <= buffer[j]) {
        steps.push({ op: "write", index: k, value: buffer[i], line: L_WRITE });
        a[k++] = buffer[i++];
      } else {
        steps.push({ op: "write", index: k, value: buffer[j], line: L_WRITE });
        a[k++] = buffer[j++];
      }
    }
    while (i <= mid) {
      steps.push({ op: "write", index: k, value: buffer[i], line: L_WRITE_REST });
      a[k++] = buffer[i++];
    }
    while (j <= hi) {
      steps.push({ op: "write", index: k, value: buffer[j], line: L_WRITE_REST });
      a[k++] = buffer[j++];
    }

    // 只有覆盖整个区间的合并完成后，元素才真正落到最终位置
    if (lo === 0 && hi === n - 1) {
      for (let x = lo; x <= hi; x++) steps.push({ op: "mark", index: x, line: L_MARK });
    }
  }

  mergeRange(0, n - 1);
  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
