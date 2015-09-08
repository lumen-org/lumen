define(['app/utils'], function(utils) {
  'use strict';

  /**
   * ColorMap class
   * @type {{auto: Function}}
   */
  var ColorMap = {
    auto: function (item) {
      return "auto colormap :-)";
    }
  };

  /* var DataSource = function () {
   // todo: implement a method to automatically determine a default config for data dimensions
   auto: {
   Role : function () {            },
   Kind : function () {            },
   DataType : function () {            }
   }
   };*/

  var FieldT = {
    Type: {string: 'string', num: 'numerical'},
    Role: {measure: 'measure', dimension: 'dimension'},
    Kind: {cont: 'continuous', discrete: 'discrete'}
  };

  var FUsageT = {
    Aggregation: {sum: 'sum', agv: 'avg'},
    Scale: {
      linear: 'linear', log: 'log'
    },
    Order: {
      ascending: 'asc', descending: 'desc'
    }
  };

  /**
   * A data source
   * @param uri URI of the data source.
   * @param name Some name for the data source.
   * @constructor
   */
  var DataSource = function (uri, name) {
    this.uri = uri;
    this.name = name;
    this.fields = {};
  };

  /**
   * Populates dimShelf and measShelf with the fields of this data source.
   * @param dimShelf
   * @param measShelf
   */
  DataSource.prototype.populate = function (dimShelf, measShelf) {
    var fields = this.fields;
    for (var key in fields) {
      var field = fields[key];
      switch (field.role) {
        case FieldT.Role.measure:
          measShelf.append(field);
          break;
        case FieldT.Role.dimension:
          dimShelf.append(field);
          break;
        default:
          console.error('invalid value in field.role');
      }
    }
  };

  /**
   * A Shelf is a container that holds records of type RecordConstructor.
   * A shelf can be given functions to manage its elements by the mixins {asSingletonShelf} and {asMultiShelf}.
   * Note that records are never inserted as passed, but a new record is created on base on the passed record.
   * @param RecordConstructor
   * @constructor
   */
  var Shelf = function (RecordConstructor) {
    this.RecordConstructor = RecordConstructor;
  };

  var ShelfTypeT = Object.freeze({
    singletonShelf : 'singleton',
    multiShelf : 'multi'
  });

  /**
   * A mixin that makes a {Shelf} a shelf that holds only a single record.
   * That is, it requires that the target object has a property RecordConstructor which can be used to construct new records for this shelf.
   */
  var asSingletonShelf = function () {
    this.type = ShelfTypeT.singletonShelf;
    this.record = null;

    this.append = function (obj) {
      this.record = new this.RecordConstructor(obj, this);
    };

    this.prepend = this.append;

    this.contains = function (record) {
      return (this.record === record);
    };

    this.remove = function (record) {
      //if (this.contains(record)) {
        this.record = null;
      //}
    };

    this.empty = function () {
      return (this.record === null);
    };

    this.replace = this.append;
  };

  /**
   * A mixin that makes a {Shelf} a shelf that can hold multiple records in a some linear order.
   */
  var asMultiShelf = function () {
    this.records = [];
    this.type = ShelfTypeT.multiShelf;

    this.append = function (obj) {
      var record = new this.RecordConstructor(obj, this);
      this.records.push(record);
    };

    this.prepend = function (obj) {
      var record = new this.RecordConstructor(obj, this);
      this.records.unshift(record);
    };

    this.contains = function (record) {
      return (-1 != this.records.indexOf(record));
    };

    this.remove = function (record) {
      var records = this.records;
      records.splice(records.indexOf(record), 1);
    };

    this.insert = function (obj, idx) {
      var records = this.records;
      if (idx < 0 || idx > records.length) {
        return;
      }
      records.splice(idx, 0, new this.RecordConstructor(obj, this));
    };

    this.replace = function (oldRecord, newRecord) {
      var records = this.records;
      var idx = records.indexOf(oldRecord);
      records.splice(idx, 1, new this.RecordConstructor(newRecord, this));
    };

    this.length = function () {
      return this.records.length;
    };

    this.empty = function () {
      return(this.length() === 0);
    };

  };

  /**
   * We call {Field} and {FieldUsage} both attributes.
   */

  /**
   * A {Field} represents a certain dimension in a data source.
   // todo: implement interface as described!!
   * @param nameOrField {string|Field} A unique identifier of a dimension in the data source, or the {Field} to copy.
   * @param dataSource {?DataSource} The data source this is a field of, or null (if a {Field} is provided for name).
   * @param args Additional optional arguments. They will override those of a given {Field}.
   * @constructor
   */
  var Field = function (nameOrField, dataSource, args) {
    var isF = nameOrField instanceof Field;
    console.assert(isF || typeof dataSource !== 'undefined');
    if (typeof args === 'undefined') {
      args = {};
    }
    this.name = (isF ? nameOrField.name : nameOrField);
    this.dataSource = utils.selectValue(dataSource, isF, nameOrField.dataSource, {});
    this.dataType = utils.selectValue(args.dataType, isF, nameOrField.dataType, FieldT.Type.num);
    this.role = utils.selectValue(args.role, isF, nameOrField.role, FieldT.Role.measure);
    this.kind = utils.selectValue(args.kind, isF, nameOrField.kind, FieldT.Kind.cont);
  };

  /**
   * A {FieldUsage} represents a certain configuration of a {Field} for use in a PQL expression.
   * It details how the data of a certain dimension of a data set are mapped to some numerical output range.
   * @param base {Field|FieldUsage} The field or fieldUsage this field usage is based on. If  a {FieldUsage} is provided a copy of it will be created.
   * @param args Optional parameters for scale and aggregation function of the new {FieldUsage}. If set, it overrides the settings of base, in case base is a {FieldUsage}.
   * @constructor
   */
  var FieldUsage = function (base, args) {
    console.assert(base instanceof Field || base instanceof FieldUsage);
    Field.call(this, base.name, base.dataSource, base);
    if (typeof args === 'undefined') {
      args = {};
    }
    var isFU = base instanceof FieldUsage;
    this.base = (isFU ? base.base : base);
    this.aggr = utils.selectValue(args.aggr, isFU, base.aggr, FUsageT.Aggregation.sum);
    this.scale = utils.selectValue(args.scale, isFU, base.scale, FUsageT.Scale.linear);
  };
  FieldUsage.prototype = Object.create(Field.prototype);
  FieldUsage.prototype.constructor = FieldUsage;

  /**
   * An {Record} has an attribute (i.e. a {Field} or {FieldUsage}) and is bound to a certain {Shelf}.
   *
   * {Record}s can be extended using the mixins {asSingletonRecord} and {asMultiRecord}. This provides functions to manage records of a shelf "from the records itself".
   *
   * @param content {Field|FieldUsage} Note that attr itself will be stored, not a copy of it.
   * todo: this restriction is actually unnecessary (edit: really?), but for debugging it might be useful.
   * todo : Also, we can do the conversion of Field to FieldUsage here instead of having to detect it in the subclasses
   * @param shelf A shelf that this record belongs to.
   * @constructor
   */
  var Record = function (content, shelf) {
    console.assert(typeof content !== 'undefined');
    console.assert(typeof shelf !== 'undefined');
    console.assert(content instanceof Field || content instanceof FieldUsage);
    this.content = content;
    this.shelf = shelf;
  };

  /**
   * An {FieldRecord} is a {Record} that may only contain a {Field}.
   * @param obj {Field|Record} Either a {Field} (will be stored as is), or an {Record} (used to construct a new {Field}).
   * @param shelf The {Shelf} this record belongs to.
   * @constructor
   */
  var FieldRecord = function (obj, shelf) {
    console.assert(obj instanceof Record || obj instanceof Field);
    var field;
    if (obj instanceof Record) {
      // create new instance of Field if not a Field is given
      obj = obj.content;
      field = new Field(obj.name, obj.dataSource, obj);
    } else {
      // otherwise use the given Field
      field = obj;
    }
    Record.call(this, field, shelf);
  };
  FieldRecord.prototype = Object.create(Record.prototype);
  FieldRecord.prototype.constructor = FieldRecord;

  /**
   * An {FUsageRecord} is a {Record} that may only contain a {FieldUsage}.
   * @param obj {FieldUsage|Field|Record} Either a {FieldUsage} (will be stored as is) or a {Field} or a {Record} (used to construct a new {FieldUsage}).
   * @param shelf The Shelf this record belongs to.
   * @constructor
   */
  var FUsageRecord = function (obj, shelf) {
    console.assert(obj instanceof Record || obj instanceof Field || obj instanceof FieldUsage);
    var field;
    if (obj instanceof FieldUsage) {
      // if a FieldUsage is given, use that
      field = obj;
    } else {
      // otherwise create a new Field
      if (obj instanceof Record) {
        obj = obj.content;
      }
      // no effect:
      //else if (obj instanceof Field) {
      //  obj = obj;
      //}
      field = new FieldUsage(obj);
    }
    Record.call(this, field, shelf);
  };
  FUsageRecord.prototype = Object.create(Record.prototype);
  FUsageRecord.prototype.constructor = FUsageRecord;

  /**
   * A mixin that extends a {Record} such that it can manage itself in context of its shelf.
   */
  var asSingletonRecord = function () {
    this.replace = function (record) {
      this.shelf.replace(record);
    };
    this.append = this.replace;
    this.prepend = this.replace;
    this.remove = function () {
      this.shelf.remove(this);  //todo: pass this or not? there is no ambiguity
    };
  };

  /**
   * A mixin that extends a {Record} such that it can manage itself and its siblings in context of its shelf.
   */
  var asMultipleRecord = function () {
    this.append = function (record) {
      var shelf = this.shelf;
      shelf.insert(record, shelf.indexOf(this) + 1);
    };
    this.prepend = function (record) {
      var shelf = this.shelf;
      shelf.insert(record, shelf.indexOf(this));
    };
    this.remove = function (record) {
      this.shelf.remove(record);
    };
    this.replace = function (record) {
      this.shelf.replace(this, record);
    };
  };

/// it follows specific types that are actually instanciated ///

  /*
   * Generic constructor of shelf types.
   * @param RecordConstructor
   * @param multiplicity
   * @returns {Function}
   *
   var makeShelfType = function (RecordConstructor, multiplicity) {
   var NewShelfType = function () {
   Shelf.call(this, RecordConstructor);
   };
   NewShelfType.prototype = Object.create(Shelf.prototype);
   NewShelfType.prototype.constructor = NewShelfType;
   if (multiplicity == 'single') {
   asSingletonShelf.call(NewShelfType.prototype);
   } else if (multiplicity == 'multi') {
   asMultiShelf.call(NewShelfType.prototype);
   }
   return NewShelfType;
   };*/

// TODO: constructors of of *Record should always construct new attributes to store and never use the existing ones.
// todo => However, they can rely on FieldRecord and FUsageRecord to create new instances if not passing the correct object type
// todo => maybe have to restrict the constructor of FieldRecord and FUsageRecord to Fields and FieldUsages, resp.?

  /**
   * A {ColorRecord} is based on {FUsageRecord}. It maps the field usage to a color space in some way.
   * @param obj {Field|FieldUsage|Record} The object to base the new record on. It will always create a new instance of FieldUsage to store witht his Record.
   * @param shelf The {Shelf} it belongs to.
   * @constructor Constructs a {ColorRecord} based on the given obj.
   */
  var ColorRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
    this.colorMap = (obj instanceof ColorRecord ? obj.colorMap : ColorMap.auto(obj));
  };
  ColorRecord.prototype = Object.create(FUsageRecord.prototype);
  ColorRecord.prototype.constructor = ColorRecord;
  asSingletonRecord.call(ColorRecord.prototype);

  /**
   * A ColorShelf maps a {FieldUsage} to some color space. It can hold zero or one {ColorRecord}s.
   * @constructor
   */
  var ColorShelf = function () {
    Shelf.call(this, ColorRecord);
  };
  ColorShelf.prototype = Object.create(Shelf.prototype);
  ColorShelf.prototype.constructor = ColorShelf;
  asSingletonShelf.call(ColorShelf.prototype);

  /**
   * A {DimensionRecord} is stored in a dimension shelf and is based on a field.
   * @param obj The object the new dimension record is based on.
   * @param shelf
   * @constructor
   */
  var DimensionRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FieldRecord.call(this, new Field(obj), shelf);
    if (this.content.role === FieldT.Role.measure) {
      this.content.role = FieldT.Role.dimension;
      // todo: convert more!?
    }
  };
  DimensionRecord.prototype = Object.create(FieldRecord.prototype);
  DimensionRecord.prototype.constructor = DimensionRecord;
  asMultipleRecord.call(DimensionRecord.prototype);

  /**
   * A dimension shelf holds fields dimensions
   * @constructor
   */
  var DimensionShelf = function () {
    Shelf.call(this, DimensionRecord);
  };
  DimensionShelf.prototype = Object.create(Shelf.prototype);
  DimensionShelf.prototype.constructor = DimensionShelf;
  asMultiShelf.call(DimensionShelf.prototype);

  /**
   * A record that contains a measure.
   * @param obj
   * @param shelf
   * @constructor
   */
  var MeasureRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FieldRecord.call(this, new Field(obj), shelf);
    if (this.content.role === FieldT.Role.dimension) {
      this.content.role = FieldT.Role.measure;
      // todo: convert more!?
    }
  };
  MeasureRecord.prototype = Object.create(FieldRecord.prototype);
  MeasureRecord.prototype.constructor = MeasureRecord;
  asMultipleRecord.call(MeasureRecord.prototype);

  /**
   * @constructor
   */
  var MeasureShelf = function () {
    Shelf.call(this, MeasureRecord);
  };
  MeasureShelf.prototype = Object.create(Shelf.prototype);
  MeasureShelf.prototype.constructor = MeasureShelf;
  asMultiShelf.call(MeasureShelf.prototype);

  /**
   * @param obj
   * @param shelf
   * @constructor
   */
  var LayoutRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
    Record.call(this, obj, shelf);
  };
  LayoutRecord.prototype = Object.create(FUsageRecord.prototype);
  LayoutRecord.prototype.constructor = LayoutRecord;
  asMultipleRecord.call(LayoutRecord.prototype);

  /**
   * @constructor
   */
  var RowShelf = function () {
    Shelf.call(this, LayoutRecord);
  };
  RowShelf.prototype = Object.create(Shelf.prototype);
  RowShelf.prototype.constructor = RowShelf;
  asMultiShelf.call(RowShelf.prototype);

  /**
   * @constructor
   */
  var ColumnShelf = function () {
    Shelf.call(this, LayoutRecord);
  };
  ColumnShelf.prototype = Object.create(Shelf.prototype);
  ColumnShelf.prototype.constructor = ColumnShelf;
  asMultiShelf.call(ColumnShelf.prototype);

  // public part of the module
  return {
    ColorMap: ColorMap,
    FieldT: FieldT,
    FUsageT: FUsageT,

    Shelf: Shelf,
    ShelfTypeT: ShelfTypeT,
    asSingletonShelf: asSingletonShelf,
    asMultiShelf: asMultiShelf,

    Field: Field,
    FieldUsage: FieldUsage,

    Record: Record,
    FieldRecord: FieldRecord,
    FUsageRecord: FUsageRecord,
    asSingletonRecord: asSingletonRecord,
    asMultipleRecord: asMultipleRecord,

    ColorRecord: ColorRecord,
    DimensionRecord: DimensionRecord,
    MeasureRecord: MeasureRecord,
    LayoutRecord: LayoutRecord,

    ColorShelf: ColorShelf,
    DimensionShelf: DimensionShelf,
    MeasureShelf: MeasureShelf,
    RowShelf: RowShelf,
    ColumnShelf: ColumnShelf,

    DataSource: DataSource
  };
});