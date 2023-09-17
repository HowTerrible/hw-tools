/** EXCEL转换后的参数字符串转tsType */
(function (global) {
  'use strict';

  function Output(input) {
    const fieldsArr = input.split('\n');

    const fields = [];
    fieldsArr.forEach((item) => {
      if (!item) return;
      const splitted = item.split('\t');

      let fieldType = '';
      switch (splitted[1].trim()) {
        case 'integer':
          fieldType = 'number';
          break;
        default:
          fieldType = splitted[1];
          break;
      }

      fields.push({
        field: splitted[0],
        type: fieldType,
        required: splitted[2] !== '非必须',
        des: splitted[4],
      });
    });

    return fields
      .map(
        (item) =>
          `/** ${item.des} */\n${item.field} ${item.required ? '' : '?'}: ${
            item.type
          };`
      )
      .join('\n');
  }

  global.doc2type
    ? (global.doc2type['docExcel2Type'] = Output)
    : (global.doc2type = { docExcel2Type: Output });
})(typeof window !== 'undefined' ? window : global);

typeof global !== 'undefined'
  ? console.log(
      global.doc2type.docExcel2Type(`orderName	string	非必须		订单名称	
effectiveScopeName	string	非必须		生效范围： 机构(/团队)	
orderType	integer	非必须		产品类型 1:版本订单 2：增值订单 3：案件订单 4：会议订单 5：应用订单 6:晓法（尽调与舆情）	
payStatus	integer	非必须		付款状态：1：待支付 2：支付成功 3：取消支付 4：已退款	
payChannel	integer	非必须		付款渠道：1：无需支付 2：微信 3：支付宝 4：线下	
orderAmount	string	非必须		订单金额	
payCode	string	非必须		付款二维码	
productSpec	string []	非必须		产品名称(购买规格)	item 类型: string
`)
    )
  : null;
