/** 从表格复制出来的文档转换成tsType */
(function (global) {
  'use strict';

  /** 目前设想的此工具和其他工具不同, 此工具在初始化的时候已经开始监听, 监听到粘贴就开始执行并尝试计算结果
   * 在外部调取Output的时候只是把算好的结果返回
   */
  let result = [];

  function PasteHandler(event) {
    result = [];
    event.clipboardData.types
      .filter((type) => type === 'text/html')
      .forEach((type) => {
        try {
          const html = event.clipboardData.getData('text/html');
          const doc = new DOMParser().parseFromString(html, 'text/html');
          // 加载所有的行
          const trs = Array.from(doc.querySelectorAll('table tr'));
          console.log(trs);
          /** td的内容分别是
           * 字段名 类型 必填 默认值 注释  */
          trs.forEach((tr) => {
            const field = tr.children[0].textContent,
              type = tr.children[1].textContent,
              required = tr.children[2].textContent,
              defaultVal = tr.children[3].textContent,
              commets = tr.children[4].textContent;
            /** 记录注释 */
            result.push(`/** ${commets} */`);
            const requiredStr = required === '必须' ? ':' : '?:';
            let typestr = '';
            switch (type) {
              case 'integer':
                typestr = 'number';
                break;
              case 'integer []':
              case 'integer[]':
                typestr = 'number[]';
                break;
              default:
                typestr = type;
                break;
            }
            result.push(`${field} ${requiredStr} ${type};`);
          });
        } catch (err) {
          console.log(err);
        }
      });
  }

  if (global.document && global.document.addEventListener) {
    global.document.removeEventListener('paste', PasteHandler);
    global.document.addEventListener('paste', PasteHandler);
  }

  function Output(input) {
    return result.join('\n');
  }

  const tool = {
    parse: Output,
    tips: '必须要从表格复制过来的内容. 如果复制的是文本框中的原表格数据, 将无法解析. 即需要粘贴板的内容type为text/html',
  };
  global.doc2type
    ? (global.doc2type['tablePaste2Type'] = tool)
    : (global.doc2type = { tablePaste2Type: tool });
})(typeof window !== 'undefined' ? window : global);

typeof global !== 'undefined'
  ? console.log(global.doc2type.docExcel2Type(``))
  : null;
