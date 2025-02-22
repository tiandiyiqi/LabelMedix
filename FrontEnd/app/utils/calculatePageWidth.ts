/**
 * 计算页面宽度和边距
 * @param initialWidth 初始页面宽度
 * @param pageNumber 当前页码
 * @returns 计算后的页面宽度
 */
export function calculatePageWidth(initialWidth: number, pageNumber: number): number {
  // 基础宽度
  let W = initialWidth;
  
  // 页码转换为数字
  const P = typeof pageNumber === 'string' ? parseInt(pageNumber) : pageNumber;
  
  // 根据页码范围计算宽度调整值
  let widthAdjustment = 0;
  
  if (P <= 2) {
    widthAdjustment = 0;      // 第1/2页：W
  } else if (P <= 4) {
    widthAdjustment = 0.5;    // 第3/4页：W+0.5
  } else if (P <= 6) {
    widthAdjustment = -2;     // 第5/6页：W-2
  } else if (P <= 8) {
    widthAdjustment = -1.5;   // 第7/8页：W-1.5
  } else if (P <= 10) {
    widthAdjustment = -4;     // 第9/10页：W-4
  } else if (P <= 12) {
    widthAdjustment = -3.5;   // 第11/12页：W-3.5
  } else if (P <= 14) {
    widthAdjustment = -6;     // 第13/14页：W-6
  } else if (P <= 16) {
    widthAdjustment = -5.5;   // 第15/16页：W-5.5
  } else if (P <= 18) {
    widthAdjustment = -8;     // 第17/18页：W-8
  } else if (P <= 20) {
    widthAdjustment = -7.5;   // 第19/20页：W-7.5
  } else if (P <= 22) {
    widthAdjustment = -10;    // 第21/22页：W-10
  } else if (P <= 24) {
    widthAdjustment = -9.5;   // 第23/24页：W-9.5
  } else if (P <= 26) {
    widthAdjustment = -12;    // 第25/26页：W-12
  } else if (P <= 28) {
    widthAdjustment = -11.5;  // 第27/28页：W-11.5
  } else if (P <= 30) {
    widthAdjustment = -14;    // 第29/30页：W-14
  } else if (P <= 32) {
    widthAdjustment = -13.5;  // 第31/32页：W-13.5
  } else if (P <= 34) {
    widthAdjustment = -16;    // 第33/34页：W-16
  } else if (P <= 36) {
    widthAdjustment = -15.5;  // 第35/36页：W-15.5
  } else if (P <= 38) {
    widthAdjustment = -18;    // 第37/38页：W-18
  } else if (P <= 40) {
    widthAdjustment = -17.5;  // 第39/40页：W-17.5
  } else {
    // 超过40页的情况，使用最后一个调整值
    widthAdjustment = -17.5;
  }
  
  return W + widthAdjustment;
}

/**
 * 计算页面边距
 * @param pageNumber 当前页码
 * @returns 页面边距对象
 */
export function calculatePageMargins(pageNumber: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  // 页码转换为数字
  const P = typeof pageNumber === 'string' ? parseInt(pageNumber) : pageNumber;
  
  // 上、下、左边距固定为2
  const margins = {
    top: 2,
    bottom: 2,
    left: 2,
    right: 2
  };
  
  // 每4页右边距为5，其余页面为2
  if (P % 4 === 0) {
    margins.right = 5;
  }
  
  return margins;
} 