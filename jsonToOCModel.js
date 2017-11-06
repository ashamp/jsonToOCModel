//大写转换
let uppercaseFirst = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

//Objective-C关键字保护
let OCKeywordDefence = key => {
    if (typeof key === 'string') {
        if (key==='id') {
            return 'ID';
        }
        let OCKeywords = ['alloc','new','copy','mutableCopy'];
        for (var index = 0; index < OCKeywords.length; index++) {
            var keyword = OCKeywords[index];
            if (key.startsWith(keyword)) {
                return `the${uppercaseFirst(key)}`;
            }
        }
    }
    return key;
}

let shortClassName = false;

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
}
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

    if (typeof inner === 'object') {

        count--;

        initWithDictionaryLines.push(`for (NSDictionary *dict in array) {\r\n${className} *${key} = [${className} modelObjectWithDictionary:dict];\r\n[array${count} addObject:${key}];\r\n}\r\n`);
        dictionaryRepresentationLines.push(`for (NSObject *obj in array${count}) {\r\nif([obj respondsToSelector:@selector(dictionaryRepresentation)]) {\r\n// This class is a model object\r\n[mArray${count} addObject:[obj performSelector:@selector(dictionaryRepresentation)]];\r\n}\r\n}`);

        while (count) {
            initWithDictionaryLines.unshift(`for (NSObject *obj in array) {\r\nif ([obj isKindOfClass:[NSArray class]]) {\r\nNSArray *array = (NSArray *)obj;\r\nNSMutableArray *array${count} = [NSMutableArray new];`);
            initWithDictionaryLines.push(`[array${count - 1} addObject:array${count}];\r\n}\r\n}`);
            dictionaryRepresentationLines.unshift(`for (NSArray *array${count} in array${count - 1}) {\r\nNSMutableArray *mArray${count} = [NSMutableArray new];`);
            dictionaryRepresentationLines.push(`[mArray${count - 1} addObject:array${count}];\r\n}`);
            count--;
        }

        initWithDictionaryLines.unshift(`NSObject *${key} = [self objectOrNilForKey:${NSStringKey} fromDictionary:dict];\r\nif ([${key} isKindOfClass:[NSArray class]]) {\r\nNSArray *array = (NSArray *)${key};\r\nNSMutableArray *array${count} = [NSMutableArray new];`);
        initWithDictionaryLines.push(`self.${key} = [NSArray arrayWithArray:array${count}];\r\n}`);
        dictionaryRepresentationLines.unshift(`{\r\nNSArray *array0 = self.${key};\r\nNSMutableArray *mArray0 = [NSMutableArray new];`);
        dictionaryRepresentationLines.push(`[mutableDict setValue:[NSArray arrayWithArray:mArray0] forKey:${NSStringKey}];\r\n}`);
    } else {
        initWithDictionaryLines.push(`self.${key} = [self objectOrNilForKey:${NSStringKey} fromDictionary:dict];`);
        dictionaryRepresentationLines.push(``);
    }


    let initWithDictionary = initWithDictionaryLines.join('\r\n');
    let dictionaryRepresentation = dictionaryRepresentationLines.join('\r\n');
    return { initWithDictionary, dictionaryRepresentation, inner };
}

//对象转Objective-C头文件
let objToOCHeader = (jsonObj, prefix, baseClass) => {

    if (Array.isArray(jsonObj)) {
        return objToOCHeader(jsonObj[0], prefix, baseClass);
    }

    let lines = [];

    let className = `${prefix}${uppercaseFirst(baseClass)}`;

    lines.push(`@interface ${className} : NSObject <NSCoding, NSCopying>\r\n\r\n`);

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
                        lines.unshift(objToOCHeader(element, className, key));
                    }
                }
                else {
                    lines.push(`@property (nonatomic, strong) ${subClassName} *${legalKey};\r\n`);
                    lines.unshift(objToOCHeader(element, className, key));
                }
            }
        }
    }
    lines.push(`\r\n@end\r\n\r\n`);

    let linesOutput = lines.join('');

    return linesOutput;
}

//对象转Objective-C实现文件
let objToOCImplementation = (jsonObj, prefix, baseClass) => {

    if (Array.isArray(jsonObj)) {
        return objToOCImplementation(jsonObj[0], prefix, baseClass);
    }

    let lines = [];

    let NSStringKeyLines = [];
    let initWithDictionaryLines = [];
    let dictionaryRepresentationLines = [];
    let initWithCoderLines = [];
    let encodeWithCoderLines = [];
    let copyWithZoneLines = [];

    let className = `${prefix}${uppercaseFirst(baseClass)}`;

    lines.push(`@interface ${className} ()\r\n- (id)objectOrNilForKey:(id)aKey fromDictionary:(NSDictionary *)dict;\r\n@end\r\n\r\n@implementation ${className}\r\n`);
    lines.push(`+ (instancetype)modelObjectWithDictionary:(NSDictionary *)dict{\r\nreturn [[self alloc] initWithDictionary:dict];\r\n}`);

    initWithDictionaryLines.push(`- (instancetype)initWithDictionary:(NSDictionary *)dict{\r\nself = [super init];\r\nif(self && [dict isKindOfClass:[NSDictionary class]]) {\r\n`);
    dictionaryRepresentationLines.push(`- (NSDictionary *)dictionaryRepresentation{\r\nNSMutableDictionary *mutableDict = [NSMutableDictionary dictionary];`);
    initWithCoderLines.push(`- (id)initWithCoder:(NSCoder *)aDecoder{\r\nself = [super init];`);
    encodeWithCoderLines.push(`- (void)encodeWithCoder:(NSCoder *)aCoder{`);
    copyWithZoneLines.push(`- (id)copyWithZone:(NSZone *)zone{\r\n${className} *copy = [[${className} alloc] init];\r\nif (copy) {`);

    for (let key in jsonObj) {
        if (jsonObj.hasOwnProperty(key)) {
            let element = jsonObj[key];
            let legalKey = OCKeywordDefence(key);
            const NSStringKey = `k${className}${uppercaseFirst(key)}`;
            NSStringKeyLines.push(`NSString *const ${NSStringKey} = @"${key}";`);            
            if (typeof element === 'string') {
                initWithDictionaryLines.push(`self.${legalKey} = [self objectOrNilForKey:${NSStringKey} fromDictionary:dict];`);
                dictionaryRepresentationLines.push(`[mutableDict setValue:self.${legalKey} forKey:${NSStringKey}];`);
                initWithCoderLines.push(`self.${legalKey} = [aDecoder decodeObjectForKey:${NSStringKey}];`);
                encodeWithCoderLines.push(`[aCoder encodeObject:_${legalKey} forKey:${NSStringKey}];`);
                copyWithZoneLines.push(`copy.${legalKey} = [self.${legalKey} copyWithZone:zone];`);
            }
            else if (typeof element === 'number') {
                initWithDictionaryLines.push(`self.${legalKey} = [[self objectOrNilForKey:${NSStringKey} fromDictionary:dict] doubleValue];`);
                dictionaryRepresentationLines.push(`[mutableDict setValue:[NSNumber numberWithDouble:self.${legalKey}] forKey:${NSStringKey}];`);
                initWithCoderLines.push(`self.${legalKey} = [aDecoder decodeDoubleForKey:${NSStringKey}];`);
                encodeWithCoderLines.push(`[aCoder encodeDouble:_${legalKey} forKey:${NSStringKey}];`);
                copyWithZoneLines.push(`copy.${legalKey} = self.${legalKey};`);
            }
            else if (typeof element === 'boolean') {
                initWithDictionaryLines.push(`self.${legalKey} = [[self objectOrNilForKey:${NSStringKey} fromDictionary:dict] boolValue];`);
                dictionaryRepresentationLines.push(`[mutableDict setValue:[NSNumber numberWithBool:self.${legalKey}] forKey:${NSStringKey}];`);
                initWithCoderLines.push(`self.${legalKey} = [aDecoder decodeBoolForKey:${NSStringKey}];`);
                encodeWithCoderLines.push(`[aCoder encodeBool:_${legalKey} forKey:${NSStringKey}];`);
                copyWithZoneLines.push(`copy.${legalKey} = self.${legalKey};`);
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
                        lines.unshift(objToOCImplementation(element, className, key));
                    }
                    initWithCoderLines.push(`self.${legalKey} = [aDecoder decodeObjectForKey:${NSStringKey}];`);
                    encodeWithCoderLines.push(`[aCoder encodeObject:_${legalKey} forKey:${NSStringKey}];`);
                    copyWithZoneLines.push(`copy.${legalKey} = [self.${legalKey} copyWithZone:zone];`);
                }
                else {

                    initWithDictionaryLines.push(`self.${legalKey} = [${subClassName} modelObjectWithDictionary:[dict objectForKey:${NSStringKey}]];`);
                    dictionaryRepresentationLines.push(`[mutableDict setValue:[self.${legalKey} dictionaryRepresentation] forKey:${NSStringKey}];`);
                    initWithCoderLines.push(`self.${legalKey} = [aDecoder decodeObjectForKey:${NSStringKey}];`);
                    encodeWithCoderLines.push(`[aCoder encodeObject:_${legalKey} forKey:${NSStringKey}];`);
                    copyWithZoneLines.push(`copy.${legalKey} = [self.${legalKey} copyWithZone:zone];`);

                    lines.unshift(objToOCImplementation(element, className, legalKey));
                }
            }
        }
    }

    initWithDictionaryLines.push(`\r\n}\r\nreturn self;\r\n}`);
    dictionaryRepresentationLines.push(`return [NSDictionary dictionaryWithDictionary:mutableDict];\r\n}`);
    initWithCoderLines.push(`return self;\r\n}`);
    encodeWithCoderLines.push(`}`);
    copyWithZoneLines.push(`}\r\nreturn copy;\r\n}`);

    lines.unshift(NSStringKeyLines.join('\r\n'));
    lines.push(initWithDictionaryLines.join('\r\n'));
    lines.push(dictionaryRepresentationLines.join('\r\n'));
    lines.push(`\r\n- (NSString *)description{\r\nreturn [NSString stringWithFormat:@"%@", [self dictionaryRepresentation]];\r\n}\r\n\r\n#pragma mark - Helper Method\r\n- (id)objectOrNilForKey:(id)aKey fromDictionary:(NSDictionary *)dict{\r\nid object = [dict objectForKey:aKey];\r\nreturn [object isEqual:[NSNull null]] ? nil : object;\r\n}\r\n\r\n#pragma mark - NSCoding Methods\r\n`);
    lines.push(initWithCoderLines.join('\r\n'));
    lines.push(encodeWithCoderLines.join('\r\n'));
    lines.push(copyWithZoneLines.join('\r\n'));

    lines.push(`\r\n@end\r\n\r\n`);

    let linesOutput = lines.join('\r\n');

    return linesOutput;

}