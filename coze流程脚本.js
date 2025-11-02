async function main({ params }: Args): Promise<Output> {
  try {
    // 解析输入的JSON字符串
    const inputData =
      typeof typeof params.input === "string"
        ? JSON.parse(params.input)
        : params.input;

    // 提取language和translation
    const language = inputData.language;
    const translation = inputData.translation;
    const original = inputData.original;

    const iv = params.iv || {}; // 确保iv是对象

    // 如果iv[language]不存在，则创建一个新对象
    if (!iv[language]) {
      iv[language] = {};
    }

    // 合并translation
    iv[language].translation = mergeUnique(
      translation || [],
      iv[language].translation || []
    );

    // 合并original
    iv[language].original = mergeUnique(
      original || [],
      iv[language].original || []
    );

    // 构建输出对象
    const ret = {
      language: language,
      translation: translation,
      original: original,
      iv: iv,
    };

    return ret;
  } catch (error) {
    console.error("提取过程中出现错误:", error);
    throw new Error("无法从输入中提取language和translation");
  }
}

function mergeUnique(arr1, arr2) {
  // 确保输入是数组
  arr1 = Array.isArray(arr1) ? arr1 : [];
  arr2 = Array.isArray(arr2) ? arr2 : [];

  // 创建一个Set用于快速快速判断元素是否存在
  const arr2Set = new Set(arr2);

  // 遍历arr1，将不在arr2中的元素添加到arr2
  arr1.forEach((item) => {
    if (!arr2Set.has(item)) {
      arr2.push(item);
      // 更新Set以包含新添加的元素
      arr2Set.add(item);
    }
  });

  return arr2;
}
