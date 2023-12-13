/** 枚举类型注释转ts的Enum内容 */
(function (global) {
  'use strict';

  const InlineTypeReg =
    /((\d+)[.。,，:：\s、]+)(\D[^,，.。;；:：、\(（\s\d]*)[.。,，:：\s、]?(\D*)/g;

  function Output(input) {
    let inlineData = {};
    input.replace(InlineTypeReg, function (...[a, b, dataValue, dataLabel]) {
      //console.log(dataValue, dataLabel)
      if (dataValue && dataLabel) {
        inlineData[dataLabel] = dataValue;
      }
    });
    return Object.entries(inlineData)
      .map((item) => `${item[0]} = ${item[1]},`)
      .join('\n');
  }
  const tool = { parse: Output };
  global.doc2type
    ? (global.doc2type['comments2Enum'] = tool)
    : (global.doc2type = { comments2Enum: tool });
})(typeof window !== 'undefined' ? window : global);

typeof global !== 'undefined'
  ? console.log(
      global.doc2type.comments2Enum(
        '付款渠道：1：无需支付 2：微信 3：支付宝 4：线下'
      )
    )
  : null;
