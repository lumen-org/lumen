/**
 * Shelves module.
 *
 * @module shelves
 * @author Philipp Lucas
 */
define(['app/utils','lib/emitter'], function(utils, E) {
  'use strict';

//  var logger = Logger.get('pl-shelves');
//  logger.setLevel(Logger.DEBUG);

  /**
   * Small helper function - see usages
   * @returns {string}
   * @private
   */
  function _concatAsPQLString (records, delim) {
    var pqlString = "";
    records.forEach( function (r) {
      pqlString += r.toPQLString() + delim;
    });
    return pqlString;
  }

  /**
   * Small helper function - see usages
   * @returns {string}
   * @private
   */
  function _concatAsPQLString4RowCol (shelf) {
    if(shelf.empty()) return false;
    var pqlString = shelf.at(0).toPQLString();
    for( var idx = 1; idx < shelf.length(); ++idx ) {
      var op = '/';
      if (shelf.at(idx).content.role === FieldT.Role.measure &&
        shelf.at(idx - 1).content.role === FieldT.Role.measure) op = '+';
      pqlString += op + shelf.at(idx).toPQLString();
    }
    return pqlString;
  }

  /**
   * ColorMap class
   * @type {{auto: Function}}
   * @alias module:shelves.ColorMap
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

  /**
   * Type definition of a Field.
   * @type {{Type: {string: string, num: string}, Role: {measure: string, dimension: string}, Kind: {cont: string, discrete: string}}}
   * @alias module:shelves.FieldT
   */
  var FieldT = {
    Type: {string: 'string', num: 'numerical'},
    Role: {measure: 'measure', dimension: 'dimension'}, //todo: ????
    Kind: {cont: 'continuous', discrete: 'discrete'}
  };

  /**
   * Type definition of a FieldUsage.
   * @type {{Aggregation: {sum: string, avg: string}, Scale: {linear: string, log: string}, Order: {ascending: string, descending: string}}}
   * @alias module:shelves.FUsageT
   */
  var FUsageT = {
    Aggregation: {sum: 'sum', avg: 'avg'},
    Scale: {
      linear: 'linear', log: 'log'
    },
    Order: {
      ascending: 'asc', descending: 'desc'
    }
  };

  /**
   * A data source
   * @param {uri} uri URI of the data source.
   * @param {string} name Some name for the data source.
   * @alias module:shelves.DataSource
   * @constructor
   */
  var DataSource; DataSource = function (uri, name) {
    this.uri = uri;
    this.name = name;
    this.fields = {};
  };

  /**
   * Populates dimShelf and measShelf with the fields of this data source.
   * @param {DimensionShelf} dimShelf
   * @param {MeasureShelf} measShelf
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
   * Enumeration on the possible shelf types.
   * @enum
   * @alias module:shelves.ShelfTypeT
   */
  var ShelfTypeT = Object.freeze({
    dimension: 'dimensionShelf',
    measure: 'measureShelf',
    row: 'rowShelf',
    column: 'columnShelf',
    filter: 'filterShelf',
    color: 'colorShelf',
    shape: 'shapeShelf',
    size: 'sizeShelf',
    aesthetic: 'aestheticShelf',
    remove: 'removeShelf'
  });

  /**
   * A Shelf is a container that holds records of type RecordConstructor.
   * Note that records are never inserted as passed, but a new record is created on base on the passed record.
   * Shelves also trigger an event Shelf.ChangedEvent, whenever its content changed. If you change the content of any records, you are responsible for triggering that event yourself.
   * @param RecordConstructor A constructor for elements that the record stores.
   * @param [opt] Other optional options.
   * @param [opt.limit] The maximum number of elements allowed in the shelf.
   * @constructor
   * @alias module:shelves.Shelf
   */
  var Shelf; Shelf = function (RecordConstructor, opt) {
    this.RecordConstructor = RecordConstructor;
    this.records = [];

    if (!opt) opt = {};
    this.limit = utils.selectValue(opt.limit, Number.MAX_SAFE_INTEGER);
  };
  Shelf.ChangedEvent = 'shelf.changed';
  E.Emitter(Shelf.prototype);

  Shelf.prototype.append = function (obj) {
    if (this.length >= this.limit) return false;
    var record = new this.RecordConstructor(obj, this);
    this.records.push(record);
    this.emit(Shelf.ChangedEvent);
    return record;
  };

  Shelf.prototype.prepend = function (obj) {
    if (this.length >= this.limit) return false;
    var record = new this.RecordConstructor(obj, this);
    this.records.unshift(record);
    this.emit(Shelf.ChangedEvent);
    return record;
  };

  Shelf.prototype.contains = function (record) {
    return (-1 != this.records.indexOf(record));
  };

  Shelf.prototype.clear = function () {
    this.records = [];
    this.emit(Shelf.ChangedEvent);
  };

  Shelf.prototype.at = function (idx) {
    return this.records[idx];
  };
  
  Shelf.prototype.contentAt = function (idx) {
	var record = this.records[idx];
	return (record ? record.content : {});
  };

  Shelf.prototype.remove = function (recordOrIdx) {
    if (this.limit === 1) recordOrIdx = 0;
    var records = this.records;
    var idx = (typeof recordOrIdx === 'number'? recordOrIdx : records.indexOf(recordOrIdx));
    records.splice(idx, 1);
    this.emit(Shelf.ChangedEvent);
  };

  Shelf.prototype.indexOf = function (record) {
    return this.records.indexOf(record);
  };

  Shelf.prototype.insert = function (obj, idx) {
    if (this.length >= this.limit) return false;
    var records = this.records;
    if (idx < 0 || idx > records.length) {
      return false;
    }
    var record = new this.RecordConstructor(obj, this);
    records.splice(idx, 0, record);
    this.emit(Shelf.ChangedEvent);
    return record;
  };

  Shelf.prototype.replace = function (oldRecordOrIdx, newRecord) {
    var records = this.records;
    var idx;
    if (this.limit === 1 && !newRecord) {
      newRecord = oldRecordOrIdx;
      idx = 0;
    } else {
      console.assert(this.limit === 1 || this.contains(oldRecordOrIdx));
      idx = (typeof oldRecordOrIdx === 'number'? oldRecordOrIdx : records.indexOf(oldRecordOrIdx));
    }
    var record = new this.RecordConstructor(newRecord, this);
    records.splice(idx, 1, record);
    this.emit(Shelf.ChangedEvent);
    return record;
  };

  Shelf.prototype.length = function () {
    return this.records.length;
  };

  Shelf.prototype.empty = function () {
    return(this.length() === 0);
  };

  /**
   * We call {@link Field} and {@link FieldUsage} both attributes.
   */

  /**
   * A {Field} represents a certain dimension in a data source.
   * @param {string|Field} nameOrField - A unique identifier of a dimension in the data source, or the {@link Field} to copy.
   * @param {DataSource|null} dataSource - The data source this is a field of, or null (if a {@link Field} is provided for name).
   * @param [args] Additional optional arguments. They will override those of a given {@link Field}.
   * @constructor
   * @alias module:shelves.Field
   */
  var Field; Field = function (nameOrField, dataSource, args) {
    var isF = nameOrField instanceof Field;
    console.assert(isF || dataSource);
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
   * It details how the data of a certain dimension of a data source is mapped to some numerical output range.
   * @param {Field|FieldUsage} base - The field or fieldUsage this field usage is based on. If  a {@link FieldUsage} is provided a copy of it will be created.
   * @param [args] Optional parameters for scale and aggregation function of the new {@link FieldUsage}. If set, it overrides the settings of base, in case base is a {@link FieldUsage}.
   * @constructor
   * @alias module:shelves.FieldUsage
   */
  var FieldUsage; FieldUsage = function (base, args) {
    console.assert(base instanceof Field || base instanceof FieldUsage);
    Field.call(this, base.name, base.dataSource, base);
    if (!args) args = {};
    var isFU = base instanceof FieldUsage;
    this.base = (isFU ? base.base : base);
    this.aggr = utils.selectValue(args.aggr, isFU, base.aggr, FUsageT.Aggregation.sum);
    this.scale = utils.selectValue(args.scale, isFU, base.scale, FUsageT.Scale.linear);
  };
  FieldUsage.prototype = Object.create(Field.prototype);
  FieldUsage.prototype.constructor = FieldUsage;

  /**
   * An {@link Record} has an attribute (i.e. a {@link Field} or {@link FieldUsage}) and is bound to a certain {@link Shelf}.
   *
   * @param {Field|FieldUsage} content - Note that content itself will be stored, not a copy of it.
   * Note: this restriction is actually unnecessary (edit: really?), but for debugging it might be useful.
   * Records do NOT emit any events.
   * @param {Shelf} shelf - A shelf that this record belongs to.
   * @constructor
   * @alias module:shelves.Record
   */
  var Record; Record = function (content, shelf) {
    console.assert(typeof content !== 'undefined');
    console.assert(typeof shelf !== 'undefined');
    console.assert(content instanceof Field || content instanceof FieldUsage);
    this.content = content;
    this.shelf = shelf;
  };

  Record.prototype.append = function (record) {
    var shelf = this.shelf;
    return shelf.insert(record, shelf.records.indexOf(this) + 1);
  };

  Record.prototype.prepend = function (record) {
    var shelf = this.shelf;
    return shelf.insert(record, shelf.records.indexOf(this));
  };

  Record.prototype.remove = function () {
    return this.shelf.remove(this);
  };

  Record.prototype.replaceBy = function (record) {
    return this.shelf.replace(this, record);
  };

  Record.prototype.index = function () {
    return this.shelf.indexOf(this);
  };

  /**
   * An {FieldRecord} is a {Record} that may only contain a {Field}.
   * @param obj {Field|Record} Either a {Field} (will be stored as is), or an {Record} (used to construct a new {Field}).
   * @param shelf The {Shelf} this record belongs to.
   * @constructor
   * @alias module:shelves.FieldRecord
   */
  var FieldRecord; FieldRecord = function (obj, shelf) {
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
  FieldRecord.prototype.toPQLString = function () {
    return this.content.name;
  };

  /**
   * An {FUsageRecord} is a {Record} that may only contain a {FieldUsage}.
   * @param obj {FieldUsage|Field|Record} Either a {FieldUsage} (will be stored as is) or a {Field} or a {Record} (used to construct a new {FieldUsage}).
   * @param shelf The Shelf this record belongs to.
   * @constructor
   * @alias module:shelves.FUsageRecord
   */
  var FUsageRecord; FUsageRecord = function (obj, shelf) {
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
  FUsageRecord.prototype.toPQLString = function () {
    var fusage = this.content;
    return (fusage.role === FieldT.Role.measure ?
      fusage.aggr + '(' + fusage.name + ')' :
      fusage.name);
  };

  /**
   * Constructors of XXXRecord should always construct new content to store and never use the object that is passed in to the constructor.
   * They can, however, rely on the constructor of FieldRecord and FUsageRecord to create new instances if not passing a {Field} or {FieldUsage} to the constructor.
   */

  /**
   * A {ColorRecord} is based on {FUsageRecord}. Constructs a {ColorRecord} based on the given obj and shelf. It maps the field usage to a color space in some way.
   * @param obj {Field|FieldUsage|Record} The object to base the new record on. It will always create a new instance of FieldUsage to store witht his Record.
   * @param shelf The {Shelf} it belongs to.
   * @constructor
   * @alias module:shelves.ColorRecord
   */
  var ColorRecord; ColorRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
    this.colorMap = (obj instanceof ColorRecord ? obj.colorMap : ColorMap.auto(obj));
  };
  ColorRecord.prototype = Object.create(FUsageRecord.prototype);
  ColorRecord.prototype.constructor = ColorRecord;

  /**
   * A {DimensionRecord} is stored in a dimension shelf and is based on a field.
   * @param obj The object the new dimension record is based on.
   * @param shelf
   * @constructor
   * @alias module:shelves.DimensionRecord
   */
  var DimensionRecord; DimensionRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FieldRecord.call(this, new Field(obj), shelf);
    if (this.content.role === FieldT.Role.measure) {
      this.content.role = FieldT.Role.dimension;
    }
  };
  DimensionRecord.prototype = Object.create(FieldRecord.prototype);
  DimensionRecord.prototype.constructor = DimensionRecord;

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.MeasureRecord
   */
  var MeasureRecord; MeasureRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FieldRecord.call(this, new Field(obj), shelf);
    if (this.content.role === FieldT.Role.dimension) {
      this.content.role = FieldT.Role.measure;
    }
  };
  MeasureRecord.prototype = Object.create(FieldRecord.prototype);
  MeasureRecord.prototype.constructor = MeasureRecord;

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.LayoutRecord
   */
  var LayoutRecord; LayoutRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
  };
  LayoutRecord.prototype = Object.create(FUsageRecord.prototype);
  LayoutRecord.prototype.constructor = LayoutRecord;

  /**
   *
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.ShapeRecord
   */
  var ShapeRecord; ShapeRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
  };
  ShapeRecord.prototype = Object.create(FUsageRecord.prototype);
  ShapeRecord.prototype.constructor = ShapeRecord;

  /**
   *
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.SizeRecord
   */
  var SizeRecord; SizeRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
  };
  SizeRecord.prototype = Object.create(FUsageRecord.prototype);
  SizeRecord.prototype.constructor = SizeRecord;

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.FilterRecord
   */
  var FilterRecord; FilterRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
  };
  FilterRecord.prototype = Object.create(FUsageRecord.prototype);
  FilterRecord.prototype.constructor = FilterRecord;
  FilterRecord.prototype.toPQLString = function () {
    return this.content.name + " IN ( ... )";
  };

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.DetailRecord
   */
  var DetailRecord; DetailRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new FieldUsage(obj), shelf);
  };
  DetailRecord.prototype = Object.create(FUsageRecord.prototype);
  DetailRecord.prototype.constructor = DetailRecord;

  /**
   * A dimension shelf holds fields dimensions
   * @constructor
   * @alias module:shelves.DimensionShelf
   */
  var DimensionShelf; DimensionShelf = function () {
    Shelf.call(this, DimensionRecord);
    this.type = ShelfTypeT.dimension;
  };
  DimensionShelf.prototype = Object.create(Shelf.prototype);
  DimensionShelf.prototype.constructor = DimensionShelf;

  /**
   * @constructor
   * @alias module:shelves.MeasureShelf
   */
  var MeasureShelf; MeasureShelf = function () {
    Shelf.call(this, MeasureRecord);
    this.type = ShelfTypeT.measure;
  };
  MeasureShelf.prototype = Object.create(Shelf.prototype);
  MeasureShelf.prototype.constructor = MeasureShelf;

  /**
   * @constructor
   * @alias module:shelves.RowShelf
   */
  var RowShelf; RowShelf = function () {
    Shelf.call(this, LayoutRecord);
    this.type = ShelfTypeT.row;
  };
  RowShelf.prototype = Object.create(Shelf.prototype);
  RowShelf.prototype.constructor = RowShelf;
  RowShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString4RowCol(this);
    return (pqlString ? pqlString + ' ON ROWS\n' : '');
  };
  /**
   * @returns Returns the table algebra expression of shelf. Note however, that there is no brackets applied yet. It's simply an array of the records
   * @untested
   */
  RowShelf.prototype.tableAlgebraExpr = function () {
    var expr = [];
    for( var idx = 0; idx < this.length(); ++idx ) {
      if (idx !== 0) {
        expr.push( (this.contentAt(idx).role === FieldT.Role.measure && this.contentAt(idx - 1).role === FieldT.Role.measure)? '+' : '/' );
      }
      expr.push( this.contentAt(idx) );
    }
    return expr;
  };

  /**
   * @constructor
   * @alias module:shelves.ColumnShelf
   */
  var ColumnShelf; ColumnShelf = function () {
    Shelf.call(this, LayoutRecord);
    this.type = ShelfTypeT.column;
  };
  ColumnShelf.prototype = Object.create(Shelf.prototype);
  ColumnShelf.prototype.constructor = ColumnShelf;
  ColumnShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString4RowCol(this);
    return (pqlString ? pqlString + ' ON COLUMNS\n' : '');
  };
  ColumnShelf.prototype.tableAlgebraExpr = RowShelf.prototype.tableAlgebraExpr;

  /**
   * A ColorShelf maps a {FieldUsage} to some color space. It can hold zero or one {ColorRecord}s.
   * @constructor
   * @alias module:shelves.ColorShelf
   */
  var ColorShelf; ColorShelf = function () {
    Shelf.call(this, ColorRecord, {limit:1});
    this.type = ShelfTypeT.color;
  };
  ColorShelf.prototype = Object.create(Shelf.prototype);
  ColorShelf.prototype.constructor = ColorShelf;
  ColorShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString(this.records, ' ');
    return (pqlString ? pqlString + ' ON COLOR\n' : '');
  };

  /**
   * @constructor
   * @alias module:shelves.ShapeShelf
   */
  var ShapeShelf; ShapeShelf = function () {
    Shelf.call(this, ShapeRecord);
    this.type = ShelfTypeT.shape;
  };
  ShapeShelf.prototype = Object.create(Shelf.prototype);
  ShapeShelf.prototype.constructor = ShapeShelf;
  ShapeShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString(this.records, ' ');
    return (pqlString ? pqlString + ' ON SHAPE\n' : '');
  };

  /**
   * @constructor
   * @alias module:shelves.SizeShelf
   */
  var SizeShelf; SizeShelf = function () {
    Shelf.call(this, SizeRecord);
    this.type = ShelfTypeT.size;
  };
  SizeShelf.prototype = Object.create(Shelf.prototype);
  SizeShelf.prototype.constructor = SizeShelf;
  SizeShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString(this.records, ' ');
    return (pqlString ? pqlString + ' ON SIZE\n' : '');
  };

  /**
   * @constructor
   * @alias module:shelves.FilterShelf
   */
  var FilterShelf; FilterShelf = function () {
    Shelf.call(this, FilterRecord);
    this.type = ShelfTypeT.filter;
  };
  FilterShelf.prototype = Object.create(Shelf.prototype);
  FilterShelf.prototype.constructor = FilterShelf;
  FilterShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString(this.records, '\n');
    return (pqlString ? 'WHERE\n' + pqlString: '');
  };

  /**
   * @constructor
   * @alias module:shelves.DetailShelf
   */
  var DetailShelf; DetailShelf = function () {
    Shelf.call(this, DetailRecord);
    this.type = ShelfTypeT.detail;
  };
  DetailShelf.prototype = Object.create(Shelf.prototype);
  DetailShelf.prototype.constructor = DetailShelf;
  DetailShelf.prototype.toPQLString = function () {
    var pqlString = _concatAsPQLString(this.records, ' ');
    return (pqlString ? pqlString + ' ON DETAILS\n' : '');
  };

  /**
   * @constructor
   * @alias module:shelves.RemoveShelf
   */
  var RemoveShelf; RemoveShelf = function () {
    Shelf.call(this, Record);
    this.type = ShelfTypeT.remove;
  };
  RemoveShelf.prototype = Object.create(Shelf.prototype);
  RemoveShelf.prototype.constructor = RemoveShelf;
  RemoveShelf.prototype.toPQLString = function () {
    return '';
  };

  return {
    ColorMap: ColorMap,
    FieldT: FieldT,
    FUsageT: FUsageT,

    Shelf: Shelf,
    ShelfTypeT: ShelfTypeT,

    Field: Field,
    FieldUsage: FieldUsage,

    Record: Record,
    FieldRecord: FieldRecord,
    FUsageRecord: FUsageRecord,

    DetailRecord: DetailRecord,
    ColorRecord: ColorRecord,
    ShapeRecord: ShapeRecord,
    SizeRecord: SizeRecord,
    FilterRecord: FilterRecord,
    DimensionRecord: DimensionRecord,
    MeasureRecord: MeasureRecord,
    LayoutRecord: LayoutRecord,

    DetailShelf: DetailShelf,
    ColorShelf: ColorShelf,
    ShapeShelf: ShapeShelf,
    SizeShelf: SizeShelf,
    FilterShelf: FilterShelf,
    DimensionShelf: DimensionShelf,
    MeasureShelf: MeasureShelf,
    RowShelf: RowShelf,
    ColumnShelf: ColumnShelf,
    RemoveShelf: RemoveShelf,

    DataSource: DataSource
  };
});