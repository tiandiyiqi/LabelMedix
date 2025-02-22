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
  
  // 根据公式计算当前宽度
  // W₁ = W + 0.5 × P - 3 × [P/2]
  const currentWidth = W + 0.5 * P - 3 * Math.floor(P/2);
  
  return currentWidth;
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