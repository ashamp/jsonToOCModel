
$(function () {
  //初始化
  (function init() {

    let objcHerderStr = '';
    let objcImplStr = '';

    let jsonTestCase = `{
"someStr": "Input Your JSON In This Textarea",
"someNumber": 1.2,
"someBool": false,
"someObj": {
"someObj": "xyz"
},
"someObjArray": [[
{
  "someObj": "xyz"
},
{
  "someObj": "xyz"
}
]],
"someStrArray": [
"a",
"b"
],
"someMultiDimensionalArray": [
[
  [
    [
      {
        "someObj": "xyz"
      },
      {
        "someObj": "xyz"
      }
    ]
  ]
]
],
"id": "illegalName",
"new": "illegalName"
}`;

    function tryParseJSON(jsonString) {
      try {
        var o = JSON.parse(jsonString);
        if (o && typeof o === "object") {
          return o;
        }
      }
      catch (e) { }
      return false;
    }

    function generate() {

      let jsonStr = $('#origJsonTextarea').val();

      if (jsonStr.length === 0) {
        $('#formatedJson').text('请输入json');
      } else {
        let jsonObj = tryParseJSON(jsonStr);
        if (jsonObj) {

          let shortClassName = false;
          //去除重复元素
          let removeSurplusElement = (obj) => {
            if (Array.isArray(obj)) {
              obj.length = 1;
              removeSurplusElement(obj[0]);
            }
            else if (typeof obj === 'object') {
              for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                  removeSurplusElement(obj[key])
                }
              }
            }
          };
          //大写转换
          let uppercaseFirst = (string) => {
            return string.charAt(0).toUpperCase() + string.slice(1);
          };
          //头部注释
          let makeComment = (suffix, prefix, baseClass, _company, _user) => {
            const user = _user || '__username__';
            const company = _company || '__company__';
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
            const comment = `//
//  ${prefix}${baseClass}.${suffix}
//
//  Created by ${user} on ${date}.
//  Copyright © ${date.slice(0, 4)}年 ${company}. All rights reserved.
//
//  Code generated by jsonToOCModel https://ashamp.github.io/jsonToOCModel/
//

`;
            return comment;
          };
          //Objective-C关键字保护
          let OCKeywordDefence = key => {
            if (typeof key === 'string') {
              if (key === 'id') {
                return 'ID';
              }
              let OCKeywords = ['alloc', 'new', 'copy', 'mutableCopy'];
              for (var index = 0; index < OCKeywords.length; index++) {
                var keyword = OCKeywords[index];
                if (key.startsWith(keyword)) {
                  return `the${uppercaseFirst(key)}`;
                }
              }
            }
            return key;
          };
          //获取数组泛型字符串和最内层对象
          let getGenericStringAndInnerObjWithArr = (arr, className) => {
            let count = 0;
            let getInnerObj = (arr) => {
              if (Array.isArray(arr)) {
                let first = arr[0];
                count++;
                return getInnerObj(first);
              }
              else {
                return arr;
              }
            }

            let inner = getInnerObj(arr);

            let innerClass = className;
            if (typeof inner === 'string') {
              innerClass = 'NSString';
            }
            else if (typeof inner === 'number') {
              innerClass = 'NSNumber /*double*/';
            }
            else if (typeof inner === 'boolean') {
              innerClass = 'NSNumber /*bool*/';
            }

            let genericStrings = [innerClass];
            while (count) {
              genericStrings.unshift('NSArray <');
              genericStrings.push(' *>');
              count--;
            }
            let genericString = genericStrings.join('');
            return { genericString, inner };
          };
          //获取数组循环语句和最内层对象
          let getIterateLinesAndInnerObjWithArr = (arr, className, key, NSStringKey) => {
            let count = 0;
            let getInnerObj = (arr) => {
              if (Array.isArray(arr)) {
                let first = arr[0];
                count++;
                return getInnerObj(first);
              }
              else {
                return arr;
              }
            }

            let inner = getInnerObj(arr);

            let initWithDictionaryLines = [];
            let dictionaryRepresentationLines = [];

            function makeBlank(count) {
              let str = '';
              for (let index = 0; index < count + 1; index++) {
                str += '    ';
              }
              return str;
            };

            if (typeof inner === 'object') {

              count--;

              initWithDictionaryLines.push(`${makeBlank(count * 2 + 2)}for (NSDictionary *dict in array) {\r\n${makeBlank(count * 2 + 3)}${className} *${key} = [${className} modelObjectWithDictionary:dict];\r\n${makeBlank(count * 2 + 3)}[array${count} addObject:${key}];\r\n${makeBlank(count * 2 + 2)}}`);
              dictionaryRepresentationLines.push(`${makeBlank(count + 1)}for (NSObject *obj in array${count}) {\r\n${makeBlank(count + 2)}if([obj respondsToSelector:@selector(dictionaryRepresentation)]) {\r\n${makeBlank(count + 3)}// This class is a model object\r\n${makeBlank(count + 3)}[mArray${count} addObject:[obj performSelector:@selector(dictionaryRepresentation)]];\r\n${makeBlank(count + 2)}}\r\n${makeBlank(count + 1)}}`);

              while (count) {
                initWithDictionaryLines.unshift(`${makeBlank(count * 2)}for (NSObject *obj in array) {\r\n${makeBlank(count * 2 + 1)}if ([obj isKindOfClass:[NSArray class]]) {\r\n${makeBlank(count * 2 + 2)}NSArray *array = (NSArray *)obj;\r\n${makeBlank(count * 2 + 2)}NSMutableArray *array${count} = [NSMutableArray new];`);
                initWithDictionaryLines.push(`${makeBlank(count * 2 + 2)}[array${count - 1} addObject:array${count}];\r\n${makeBlank(count * 2 + 1)}}\r\n${makeBlank(count * 2)}}`);
                dictionaryRepresentationLines.unshift(`${makeBlank(count)}for (NSArray *array${count} in array${count - 1}) {\r\n${makeBlank(count + 1)}NSMutableArray *mArray${count} = [NSMutableArray new];`);
                dictionaryRepresentationLines.push(`${makeBlank(count + 1)}[mArray${count - 1} addObject:mArray${count}];\r\n${makeBlank(count)}}`);
                count--;
              }

              initWithDictionaryLines.unshift(`${makeBlank(count + 1)}NSObject *${key} = [self objectOrNilForKey:${NSStringKey} fromDictionary:dict];\r\n${makeBlank(count + 1)}if ([${key} isKindOfClass:[NSArray class]]) {\r\n${makeBlank(count + 2)}NSArray *array = (NSArray *)${key};\r\n${makeBlank(count * 2 + 2)}NSMutableArray *array${count} = [NSMutableArray new];`);
              initWithDictionaryLines.push(`${makeBlank(count + 2)}self.${key} = [NSArray arrayWithArray:array${count}];\r\n${makeBlank(count + 1)}}`);
              dictionaryRepresentationLines.unshift(`    if (self.${key}) {\r\n${makeBlank(count + 1)}NSArray *array0 = self.${key};\r\n${makeBlank(count + 1)}NSMutableArray *mArray0 = [NSMutableArray new];`);
              dictionaryRepresentationLines.push(`${makeBlank(count + 1)}[mutableDict setValue:[NSArray arrayWithArray:mArray0] forKey:${NSStringKey}];\r\n${makeBlank(count)}}`);
            } else {
              initWithDictionaryLines.push(`${makeBlank(count)}self.${key} = [self objectOrNilForKey:${NSStringKey} fromDictionary:dict];`);
              dictionaryRepresentationLines.push(`${makeBlank(count - 1)}[mutableDict setValue:self.${key} forKey:${NSStringKey}];`);
            }


            let initWithDictionary = initWithDictionaryLines.join('\r\n');
            let dictionaryRepresentation = dictionaryRepresentationLines.join('\r\n');
            return { initWithDictionary, dictionaryRepresentation, inner };
          };
          //对象转Objective-C头文件
          let objToOCHeader = (jsonObj, prefix, baseClass, shouldNSCoding, shouldNSCopying) => {

            if (Array.isArray(jsonObj)) {
              return objToOCHeader(jsonObj[0], prefix, baseClass, shouldNSCoding, shouldNSCopying);
            }

            let lines = [];

            let className = `${prefix}${uppercaseFirst(baseClass)}`;

            let protocal = '';
            if (shouldNSCoding) {
              protocal = '<NSCoding>';
            }
            if (shouldNSCopying) {
              protocal = '<NSCopying>';
            }
            if (shouldNSCoding && shouldNSCopying) {
              protocal = '<NSCoding, NSCopying>';
            }

            lines.push(`@interface ${className} : NSObject ${protocal}\r\n\r\n`);

            lines.push(`/*\r\n ${JSON.stringify(jsonObj, null, 2)} \r\n*/\r\n`);

            for (let key in jsonObj) {
              if (jsonObj.hasOwnProperty(key)) {
                let element = jsonObj[key];

                let legalKey = OCKeywordDefence(key);

                if (typeof element === 'string') {
                  lines.push(`@property (nonatomic, strong) NSString *${legalKey};\r\n`);
                }
                else if (typeof element === 'number') {
                  lines.push(`@property (nonatomic, assign) double ${legalKey};\r\n`);
                }
                else if (typeof element === 'boolean') {
                  lines.push(`@property (nonatomic, assign) BOOL ${legalKey};\r\n`);
                }
                else if (typeof element === 'object') {

                  if (shortClassName) {
                    className = prefix;
                  }
                  let subClassName = `${className}${uppercaseFirst(key)}`;
                  if (Array.isArray(element)) {
                    let { genericString, inner } = getGenericStringAndInnerObjWithArr(element, subClassName);
                    lines.push(`@property (nonatomic, strong) ${genericString} *${legalKey};\r\n`);
                    if (typeof inner === 'object') {
                      lines.unshift(objToOCHeader(element, className, key, shouldNSCoding, shouldNSCopying));
                    }
                  }
                  else {
                    lines.push(`@property (nonatomic, strong) ${subClassName} *${legalKey};\r\n`);
                    lines.unshift(objToOCHeader(element, className, key, shouldNSCoding, shouldNSCopying));
                  }
                }
              }
            }
            lines.push(`\r\n+ (instancetype)modelObjectWithDictionary:(NSDictionary *)dict;\r\n- (instancetype)initWithDictionary:(NSDictionary *)dict;\r\n- (NSDictionary *)dictionaryRepresentation;\r\n\r\n@end\r\n\r\n`);

            let linesOutput = lines.join('');

            return linesOutput;
          }
          let objToOCHeaderLines = (jsonObj, prefix, baseClass, haveComment, shouldNSCoding, shouldNSCopying, company, user) => {
            removeSurplusElement(jsonObj);
            const headerLines = objToOCHeader(jsonObj, prefix, baseClass, shouldNSCoding, shouldNSCopying);

            const comment = haveComment ? makeComment('h', prefix, baseClass, company, user) : '\r';
            return comment + '#import <Foundation/Foundation.h>\r\n\r\n' + headerLines;
          };
          //对象转Objective-C实现文件
          let objToOCImplementation = (jsonObj, prefix, baseClass, shouldNSCoding, shouldNSCopying) => {

            if (Array.isArray(jsonObj)) {
              return objToOCImplementation(jsonObj[0], prefix, baseClass, shouldNSCoding, shouldNSCopying);
            }

            let lines = [];

            let NSStringKeyLines = [];
            let initWithDictionaryLines = [];
            let dictionaryRepresentationLines = [];
            let initWithCoderLines = [];
            let encodeWithCoderLines = [];
            let copyWithZoneLines = [];

            let className = `${prefix}${uppercaseFirst(baseClass)}`;

            lines.push(`\r\n@interface ${className} ()\r\n\r\n- (id)objectOrNilForKey:(id)aKey fromDictionary:(NSDictionary *)dict;\r\n\r\n@end\r\n\r\n\r\n\r\n@implementation ${className}\r\n`);
            lines.push(`+ (instancetype)modelObjectWithDictionary:(NSDictionary *)dict{\r\n    return [[self alloc] initWithDictionary:dict];\r\n}\r\n`);

            initWithDictionaryLines.push(`- (instancetype)initWithDictionary:(NSDictionary *)dict{\r\n    self = [super init];\r\n    if(self && [dict isKindOfClass:[NSDictionary class]]) {`);
            dictionaryRepresentationLines.push(`- (NSDictionary *)dictionaryRepresentation{\r\n    NSMutableDictionary *mutableDict = [NSMutableDictionary dictionary];`);
            initWithCoderLines.push(`- (id)initWithCoder:(NSCoder *)aDecoder{\r\n    self = [super init];`);
            encodeWithCoderLines.push(`- (void)encodeWithCoder:(NSCoder *)aCoder{`);
            copyWithZoneLines.push(`- (id)copyWithZone:(NSZone *)zone{\r\n    ${className} *copy = [[${className} alloc] init];\r\n    if (copy) {`);

            for (let key in jsonObj) {
              if (jsonObj.hasOwnProperty(key)) {
                let element = jsonObj[key];
                let legalKey = OCKeywordDefence(key);
                const NSStringKey = `k${className}${uppercaseFirst(key)}`;
                NSStringKeyLines.push(`NSString *const ${NSStringKey} = @"${key}";`);
                if (typeof element === 'string') {
                  initWithDictionaryLines.push(`        self.${legalKey} = [self objectOrNilForKey:${NSStringKey} fromDictionary:dict];`);
                  dictionaryRepresentationLines.push(`    [mutableDict setValue:self.${legalKey} forKey:${NSStringKey}];`);
                  initWithCoderLines.push(`    self.${legalKey} = [aDecoder decodeObjectForKey:${NSStringKey}];`);
                  encodeWithCoderLines.push(`    [aCoder encodeObject:_${legalKey} forKey:${NSStringKey}];`);
                  copyWithZoneLines.push(`        copy.${legalKey} = [self.${legalKey} copyWithZone:zone];`);
                }
                else if (typeof element === 'number') {
                  initWithDictionaryLines.push(`        self.${legalKey} = [[self objectOrNilForKey:${NSStringKey} fromDictionary:dict] doubleValue];`);
                  dictionaryRepresentationLines.push(`    [mutableDict setValue:[NSNumber numberWithDouble:self.${legalKey}] forKey:${NSStringKey}];`);
                  initWithCoderLines.push(`    self.${legalKey} = [aDecoder decodeDoubleForKey:${NSStringKey}];`);
                  encodeWithCoderLines.push(`    [aCoder encodeDouble:_${legalKey} forKey:${NSStringKey}];`);
                  copyWithZoneLines.push(`        copy.${legalKey} = self.${legalKey};`);
                }
                else if (typeof element === 'boolean') {
                  initWithDictionaryLines.push(`        self.${legalKey} = [[self objectOrNilForKey:${NSStringKey} fromDictionary:dict] boolValue];`);
                  dictionaryRepresentationLines.push(`    [mutableDict setValue:[NSNumber numberWithBool:self.${legalKey}] forKey:${NSStringKey}];`);
                  initWithCoderLines.push(`    self.${legalKey} = [aDecoder decodeBoolForKey:${NSStringKey}];`);
                  encodeWithCoderLines.push(`    [aCoder encodeBool:_${legalKey} forKey:${NSStringKey}];`);
                  copyWithZoneLines.push(`        copy.${legalKey} = self.${legalKey};`);
                }
                else if (typeof element === 'object') {

                  if (shortClassName) {
                    className = prefix;
                  }
                  let subClassName = `${className}${uppercaseFirst(key)}`;
                  if (Array.isArray(element)) {
                    let { initWithDictionary, dictionaryRepresentation, inner } = getIterateLinesAndInnerObjWithArr(element, subClassName, key, NSStringKey);

                    initWithDictionaryLines.push(initWithDictionary);
                    dictionaryRepresentationLines.push(dictionaryRepresentation);
                    if (typeof inner === 'object') {
                      lines.unshift(objToOCImplementation(element, className, key, shouldNSCoding, shouldNSCopying));
                    }
                    initWithCoderLines.push(`    self.${legalKey} = [aDecoder decodeObjectForKey:${NSStringKey}];`);
                    encodeWithCoderLines.push(`    [aCoder encodeObject:_${legalKey} forKey:${NSStringKey}];`);
                    copyWithZoneLines.push(`        copy.${legalKey} = [self.${legalKey} copyWithZone:zone];`);
                  }
                  else {

                    initWithDictionaryLines.push(`        self.${legalKey} = [${subClassName} modelObjectWithDictionary:[dict objectForKey:${NSStringKey}]];`);
                    dictionaryRepresentationLines.push(`    [mutableDict setValue:[self.${legalKey} dictionaryRepresentation] forKey:${NSStringKey}];`);
                    initWithCoderLines.push(`    self.${legalKey} = [aDecoder decodeObjectForKey:${NSStringKey}];`);
                    encodeWithCoderLines.push(`    [aCoder encodeObject:_${legalKey} forKey:${NSStringKey}];`);
                    copyWithZoneLines.push(`        copy.${legalKey} = [self.${legalKey} copyWithZone:zone];`);

                    lines.unshift(objToOCImplementation(element, className, legalKey, shouldNSCoding, shouldNSCopying));
                  }
                }
              }
            }

            initWithDictionaryLines.push(`    }\r\n    return self;\r\n}\r\n`);
            dictionaryRepresentationLines.push(`    return [NSDictionary dictionaryWithDictionary:mutableDict];\r\n}`);
            initWithCoderLines.push(`    return self;\r\n}\r\n`);
            encodeWithCoderLines.push(`}\r\n`);
            copyWithZoneLines.push(`    }\r\n    return copy;\r\n}`);

            lines.unshift(NSStringKeyLines.join('\r\n'));
            lines.push(initWithDictionaryLines.join('\r\n'));
            lines.push(dictionaryRepresentationLines.join('\r\n'));
            lines.push(`\r\n- (NSString *)description{\r\n    return [NSString stringWithFormat:@"%@", [self dictionaryRepresentation]];\r\n}\r\n\r\n#pragma mark - Helper Method\r\n\r\n- (id)objectOrNilForKey:(id)aKey fromDictionary:(NSDictionary *)dict{\r\n    id object = [dict objectForKey:aKey];\r\n    return [object isEqual:[NSNull null]] ? nil : object;\r\n}\r\n\r\n`);
            if (shouldNSCoding) {
              lines.push('#pragma mark - NSCoding Methods\r\n');
              lines.push(initWithCoderLines.join('\r\n'));
              lines.push(encodeWithCoderLines.join('\r\n'));
            }
            if (shouldNSCopying) {
              lines.push(copyWithZoneLines.join('\r\n'));
            }

            lines.push(`\r\n@end\r\n\r\n`);

            let linesOutput = lines.join('\r\n');

            return linesOutput;
          };
          //对象转Objective-C实现文件
          let objToOCImplementationLines = (jsonObj, prefix, baseClass, haveComment, shouldNSCoding, shouldNSCopying, company, user) => {
            const implementationLines = objToOCImplementation(jsonObj, prefix, baseClass, shouldNSCoding, shouldNSCopying);

            const comment = haveComment ? makeComment('m', prefix, baseClass, company, user) : '\r';
            return comment + `#import "${prefix}${baseClass}.h"\r\n\r\n` + implementationLines;
          };

          //是合法json字符串
          //去除重复元素
          removeSurplusElement(jsonObj);
          //美化
          let prettyJson = JSON.stringify(jsonObj, null, 2);
          //生成JSON
          let highlightJson = hljs.highlight('json', prettyJson);
          $('#formatedJson').html(highlightJson.value);

          //取公司名
          let company = $('#componyTextField').val();
          //取用户名
          let user = $('#userTextField').val();
          //取是否有头部注释
          let haveComment = $('#commentCheckbox').prop('checked');
          //取是否NSCoding
          let shouldNSCoding = $('#NSCodingCheckbox').prop('checked');
          let shouldNSCopying = $('#NSCopyingCheckbox').prop('checked');
          //生成头文件
          let rootClass = $('#classNameTextField').val();
          let surfix = $('#suffixTextField').val();
          let objcHeaderCode = objToOCHeaderLines(jsonObj, rootClass, surfix, haveComment, shouldNSCoding, shouldNSCopying, company, user);
          objcHerderStr = objcHeaderCode;
          let highlightObjcHeader = hljs.highlight('objectivec', objcHeaderCode);
          $('#objcHeaderCode').html(highlightObjcHeader.value);

          //生成实现文件
          let objcImplCode = objToOCImplementationLines(jsonObj, rootClass, surfix, haveComment, shouldNSCoding, shouldNSCopying, company, user);
          objcImplStr = objcImplCode;
          let highlightObjcImpl = hljs.highlight('objectivec', objcImplCode);
          $('#objcImplCode').html(highlightObjcImpl.value);
        } else {
          $('#formatedJson').text('json解析失败');
        }
      }
    }

    function textFieldBinding(tfID, defaultValue) {
      let selector = '#' + tfID;
      let strFromCookie = $.cookie(tfID);
      if ((strFromCookie === undefined || strFromCookie.length === 0) && defaultValue) {
        $.cookie(tfID, defaultValue);
      }
      $(selector).val($.cookie(tfID));
      $(selector).on('input', function (e) {
        let text = $(this).val();
        $.cookie(tfID, text);
        generate();
      });
    }

    textFieldBinding('origJsonTextarea', jsonTestCase);
    textFieldBinding('classNameTextField', 'XYZTestCase');
    textFieldBinding('suffixTextField', 'Model');
    textFieldBinding('componyTextField');
    textFieldBinding('userTextField');

    function checkBoxBinding(checkBoxID, checked) {
      let defaultValue = checked ? '1' : '0';
      let selector = '#' + checkBoxID;
      let strFromCookie = $.cookie(checkBoxID);
      if (strFromCookie === undefined || strFromCookie.length === 0) {
        $.cookie(checkBoxID, defaultValue);
      }
      checked = $.cookie(checkBoxID) === '1';
      $(selector).prop('checked', checked);
      $(selector).on('change', function (e) {
        let checked = $(this).prop('checked') ? '1' : '0';
        $.cookie(checkBoxID, checked);
        generate();
      });
    }

    checkBoxBinding('NSCodingCheckbox', true);
    checkBoxBinding('NSCopyingCheckbox', true);
    checkBoxBinding('commentCheckbox', true);

    generate();

    function copyToClipboard(text) {
      var $temp = $("<textarea>");
      $("body").append($temp);
      $temp.val(text).select();
      document.execCommand("copy");
      $temp.remove();
    }

    $('#copyHeaderFileBtn').click(function () {
      copyToClipboard(objcHerderStr);
    });
    $('#copyImplFileBtn').click(function () {
      copyToClipboard(objcImplStr);
    });

  })();
});