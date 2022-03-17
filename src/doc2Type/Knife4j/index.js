(function (window, document) {
  /**
   * 此文件用于根据接口文档生成type（简易版
   * https://goshenbao.cn/doc.html#/%E5%BC%93%E7%94%B3%E8%B1%B9-%E5%80%BA%E6%9D%83%E4%BA%BA%E6%9C%8D%E5%8A%A1(gsb-creditor)/%E5%80%BA%E6%9D%83%E7%94%B3%E6%8A%A5%E7%AE%A1%E7%90%86/getDeclareDetailsUsingPOST
   * 点击接口文档中的复制文档
   * 只要响应参数的 |&emsp;那一大段 类似表头表尾的都不需要， 放入下面的 responseDeclare 中
   */

  const FieldTypeMap = {
    string: 'string',
    'string(date)': 'string',
    'string(date-time)': 'string',
    'integer(int32)': 'number',
    'integer(int64)': 'number',
    integer: 'number',
    array: 'Array<>',
  };

  function javaType2JSType(javaType) {
    return FieldTypeMap[javaType] || javaType;
  }

  const DataTypeMap = {
    Response: 'response',
    Request: 'request',
  };
  /** 用于猜测此响应值 是不是code:value的形式， 如果是，提出类型 */
  const InlineTypeReg =
    /((\d+)[.。,，:：\s、]+)(\D[^,，.。;；:：、\(（\s\d]*)[.。,，:：\s、]?(\D*)/g,
    // 分组【tab, fieldName, fileComment,require, fieldType, otherComment 】
    RequestReg = /\|&emsp;(&emsp;)*(.+)\|(.*)\|\|(.+)\|(.*)\|(.*)(\|\s)/g,
    ResponseReg = /\|&emsp;(&emsp;)*(.+)\|(.+)\|(.+)\|(.*)(\|\s)/g;

  let
    prevTabCnt = null,
    /** 用于暂存当前字段是哪一级的栈 */
    tempClassStack = [];


  function RequestHandler(
    wholeString,
    filedName,
    fieldComment,
    fieldType,
    required,
    subType,
    fieldMoreInfo,
    currentClass,
    dataTypeResult,
    inlineDataTypeResult,
  ) {
    curTabCnt = wholeString.split('&emsp').length - 1;
    currentItem = {
      name: filedName,
      upperName: filedName[0].toUpperCase() + filedName.slice(1),
      // 目前看，请求的表格里 如果是类，他的fieldComment是没有内容的, 类的描述在fieldType的位置上
      // 所以判断类的条件和响应的略有不同
      comment: fieldComment || fieldType,
      isClass: Boolean(!fieldComment),
      moreCommont: `require: ${required}`,
      type: javaType2JSType(fieldType),
      tabCount: curTabCnt,
      required: required === "true" ? true : false
    };
    if (prevTabCnt !== null && prevTabCnt > curTabCnt) {
      tempClassStack.pop();
      currentClass = tempClassStack[tempClassStack.length - 1];
    }
    /** 如果当前是在根， 直接添加到结果中 */
    if (!currentClass) {
      dataTypeResult.push(currentItem);
      currentItem.isRoot = true;
    } else {
      currentItem.isRoot = false;
      currentClass.children
        ? currentClass.children.push(currentItem)
        : (currentClass.children = [currentItem]);
    }
    /** 暂定类型后面的单元格还有内容的是类 */
    if (Boolean(!fieldComment)) {
      tempClassStack.push(currentItem);
      currentClass = currentItem;
    }

    if (subType) {
      switch (currentItem.type) {
        case FieldTypeMap.array:
          currentItem.type = `Array<${javaType2JSType(subType)}>`;
          break;
      }
    }
    analysisInlineType(currentItem, inlineDataTypeResult);
    prevTabCnt = curTabCnt;
  }

  function ResponseHandler(
    wholeString,
    filedName,
    fieldComment,
    fieldType,
    fieldMoreInfo,
    currentClass,
    dataTypeResult,
    inlineDataTypeResult,
  ) {
    // console.log(filedName);
    // resultArray.push(wholeString, "-", filedName, "-", fieldComment, "-", javaType2JSType(fieldType), "-",);
    curTabCnt = wholeString.split('&emsp').length - 1;
    currentItem = {
      upperName: filedName[0].toUpperCase() + filedName.slice(1),
      name: filedName,
      comment: fieldComment,
      moreCommont: fieldMoreInfo,
      isClass: Boolean(fieldMoreInfo),
      type: javaType2JSType(fieldType),
      tabCount: curTabCnt,
    };
    if (prevTabCnt !== null && prevTabCnt > curTabCnt) {
      tempClassStack.pop();
      currentClass = tempClassStack[tempClassStack.length - 1];
    }
    /** 如果当前是在根， 直接添加到结果中 */
    if (!currentClass) {
      dataTypeResult.push(currentItem);
      currentItem.isRoot = true;
    } else {
      currentItem.isRoot = false;
      currentClass.children
        ? currentClass.children.push(currentItem)
        : (currentClass.children = [currentItem]);
    }
    /** 暂定类型后面的单元格还有内容的是类 */
    if (Boolean(fieldMoreInfo)) {
      tempClassStack.push(currentItem);
      currentClass = currentItem;
    }

    // 分析注释，看是否需要提出单独的type(仅针对 code:label这种)
    analysisInlineType(currentItem, inlineDataTypeResult);
    prevTabCnt = curTabCnt;
  }

  /**  {
      name: string,
      comment: string,
      moreCommont: string,
      isClass: boolean,
      type: string,
      tabCount: number
    } */
  /**
   * 分析注释
   * @param {*} dataTypeItem
   * @returns
   */
  function analysisInlineType(dataTypeItem, inlineDataTypeResult) {
    const comment = dataTypeItem.comment;
    if (!InlineTypeReg.test(comment)) return;
    let inlineData = {};
    comment.replace(InlineTypeReg, function (...[a, b, dataValue, dataLabel]) {
      //console.log(dataValue, dataLabel)
      if (dataValue && dataLabel) {
        inlineData[dataLabel] = dataValue;
      }
    });
    dataTypeItem.inlineData = inlineData;
    dataTypeItem.inlineTypeResult = Object.values(inlineData).join(' | ');

    dataTypeItem.inlineTypeName = dataTypeItem.upperName + 'EnumType';
    inlineDataTypeResult.push(dataTypeItem);
  }

  function renderIfTypeIsRequire(required) {
    return required ? ':' : '?:';
  }
  /**
   * 渲染普通的数据类型
   * @param {*} dataTypeResult
   */
  function renderResult(dataTypeResult, resultArray) {
    console.log("renderResult", dataTypeResult);
    dataTypeResult.forEach((item) => {
      // 在根节点
      if (item.isRoot) {
        if (item.isClass) {
          renderClassType(item, resultArray)
        } else {
          resultArray.push(`/** ${item.comment} */`);
          resultArray.push(
            `${item.name}${renderIfTypeIsRequire(item.required)} ${item.inlineTypeName || item.type
            }`,
          );
        }
      }
      // 不在根节点
      else {
        if (item.isClass) {
          renderClassType(item, resultArray)
        } else {
          resultArray.push(`/** ${item.comment} */`);
          resultArray.push(`${item.name}: ${item.inlineTypeName || item.type};`);
        }

      }
    });
  }

  /** 
   * 渲染类类型的数据
   *  现在行内加一条，然后再在后面增加类的声明
   */
  function renderClassType(item, resultArray) {
    setTimeout(() => {
      console.log("renderClassType");
      resultArray.push(`/** ${item.comment} - ${item.moreCommont} */`);
      resultArray.push(`${item.name}: ${item.name}Type`);
      resultArray.push(`\n`);
      resultArray.push(`/** ${item.comment} - ${item.moreCommont} */`);
      resultArray.push(`export type ${item.upperName}Type = {`);
      item.children ? renderResult(item.children, resultArray) : null;
      resultArray.push(`};`);
    })
  }

  /**
   * 渲染注释类型
   */
  function renderInlineDataType(inlineDataTypeResult, resultArray) {
    setTimeout(() => {
      console.log("renderInlineDataType");
      inlineDataTypeResult.forEach((item) => {
        resultArray.push(`/** ${item.comment} */`);
        resultArray.push(
          `export type ${item.inlineTypeName} = ${item.inlineTypeResult};`,
        );

        if (generateObjectType) {
          resultArray.push(`export const ${item.upperName}Map: {`);
          Object.entries(item.inlineData).forEach((item) => {
            resultArray.push(`  ${item[0]}: ${item[1]};`);
          });
          resultArray.push('} = {');
          Object.entries(item.inlineData).forEach((item) => {
            resultArray.push(`  ${item[0]}: ${item[1]},`);
          });
          resultArray.push(`};`);
        }
      });
    })
  }
  const generateObjectType = true;


  function renderResultPre(type, result) {
    /** 因为上面渲染类类型字段和行内都是使用setTimeout宏任务处理，这里也得把最终渲染排在宏任务的末尾
     */
    setTimeout(() => {
      console.log("renderResultPre", result, type);
      let resultPre = document.getElementById(type + "result");
      if (!resultPre || resultPre.tagName !== "PRE") {
        resultPre = document.createElement("pre");
        resultPre.id = type + "result"
        document.body.append(resultPre);
      }
      resultPre.innerHTML = result.join("\n");
    });
  }

  /**
   * 
   * @param {string} doc 
   * @param {string} type 'resposne' | 'request'
   */
  const generateType = async (doc, type) => {
    console.log("generate type", type);
    /**
    * 解析后的类型项目Type Array<dataTypeItem>
    * name 字段名称
    * comment 字段注释
    * moreComment 更多注释， 就是IsClass的判断标准， 此字段有值就是Class-----Boolean(fieldMoreInfo)
    * isClass 此字段数据结构是不是类----判断是类的标准： 类型后面的单元格还有内容 Boolean(fieldMoreInfo)
    * type 字段的类型----判断类结束的标准： 当前列比上一列的tab少
    * tabCount 即表格的缩进，用来判断是不是类型中的类型
    * isRoot 判断字段是不是根类型，决定了是否输出export type等内容
    * children 此类型里面的类型
    *
    * inlineData 从注释中解析出来的潜在类型。目前仅能识别 1.aa， 2.bb 分隔符支持【,，.。;；:：、】
    * inlineTypeName 注释中解析出来的潜在类型，会在字段名后拼接【EnumType】
    * UpperName 将字段名的第一个字母大写，备用
    *
    */
    let dataTypeResult = [],
      /** 注释解析出来需要单独输出的类型,里面的每个内容都是 dataTypeItem */
      inlineDataTypeResult = [],
      resultArray = [],
      /** 暂存处理中的类型 */
      currentClass = null;

    // dataType = DataTypeMap.Request;
    // dataType = DataTypeMap.Response;
    switch (type) {
      case DataTypeMap.Request:
        doc.replace(
          RequestReg,
          /**
           * 判断是类的标准： 类型后面的单元格还有内容 Boolean(fieldMoreInfo)
           * 判断类结束的标准： 当前列比上一列的tab少
           */
          function (
            ...[
              wholeString,
              ,
              filedName,
              fieldComment,
              required,
              fieldType,
              subType,
            ]
          ) {
            RequestHandler(
              wholeString,
              filedName,
              fieldComment,
              fieldType,
              required,
              subType,
              null,
              currentClass,
              dataTypeResult,
              inlineDataTypeResult,
            );
          },
        );
        workRegExp = RequestReg;
        break;
      case DataTypeMap.Response:
        doc.replace(
          ResponseReg,
          /**
           * 判断是类的标准： 类型后面的单元格还有内容 Boolean(fieldMoreInfo)
           * 判断类结束的标准： 当前列比上一列的tab少
           */
          function (
            ...[wholeString, , filedName, fieldComment, fieldType, fieldMoreInfo]
          ) {

            ResponseHandler(
              wholeString,
              filedName,
              fieldComment,
              fieldType,
              fieldMoreInfo,
              currentClass,
              dataTypeResult,
              inlineDataTypeResult,
            );
          },
        );
        break;
    }
    renderResult(dataTypeResult, resultArray);
    renderInlineDataType(inlineDataTypeResult, resultArray);
    renderResultPre(type, resultArray);
  }

  window.generateType = generateType
})(window, document)