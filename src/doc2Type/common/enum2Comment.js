/** 将枚举转换成字符串(通常用于注释) */
/** 枚举类型注释转ts的Enum内容 */
(function (global) {
  'use strict';

  function Output(input) {
    if (!input || typeof input !== 'string') return '';
    input = input.replace(/,/g, '');
    /** 
      aaa = 1,
      bbb = 2,
      转换成
      1: aaa, 2: bbb,
     */

    const data = [];
    input.split('\n').forEach((item) => {
      item = item.trim();
      item
        ? data.push(
            item
              .split('=')
              .map((item) => item.trim())
              .reverse()
              .join(': ')
          )
        : null;
    });
    return data && data.length ? data.join(', ') : '';
  }

  global.doc2type
    ? (global.doc2type['enum2Comments'] = Output)
    : (global.doc2type = { enum2Comments: Output });
})(typeof window !== 'undefined' ? window : global);

typeof global !== 'undefined'
  ? console.log(
      global.doc2type.enum2Comments(
        `
    版本订单 = 1,
    增值订单 = 2,
    案件订单 = 3,
    会议订单 = 4,
    应用订单 = 5,
    三方接口 = 6,
    `
      )
    )
  : null;
