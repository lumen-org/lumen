/**
 * Shelves module.
 *
 * @module shelves
 * @author Philipp Lucas
 */
define(['lib/emitter', 'lib/logger', './utils', './Field', ], function(E, Logger, utils, F) {
  'use strict';

  var logger = Logger.get('pl-shelves');
  logger.setLevel(Logger.DEBUG);

  /**
   * Populates the given dimension and measure shelf with the field from the given model
   * Note: it does not make added fields {@link beVisual} or {@link beInteractable}!
   * @param model
   * @param {DimensionShelf} dimShelf
   * @param {MeasureShelf} measShelf
   */
  function populate (model, dimShelf, measShelf) {
    model.fields.forEach(
      function(field) {
        switch (field.role) {
          case F.FieldT.Role.measure:
            measShelf.append(field);
            break;
          case F.FieldT.Role.dimension:
            dimShelf.append(field);
            break;
          default:
            throw new Error('invalid value in field.role');
        }
      }
    );
  }


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

  Shelf.prototype.toString = function () {
    return this.records.reduce(function (val, elem) {
      return val + elem.content.toString() + "\n";
    }, "");
  };

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
    console.assert(content instanceof F.Field || content instanceof F.FieldUsage);
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

  Record.prototype.toString = function () {
    return this.content.toString();
  };


  /**
   * An {FieldRecord} is a {Record} that may only contain a {Field}.
   * @param obj {Field|Record} Either a {Field} (will be stored as is), or a {Record} (used to construct a new {Field}).
   * @param shelf The {Shelf} this record belongs to.
   * @constructor
   * @alias module:shelves.FieldRecord
   */
  var FieldRecord; FieldRecord = function (obj, shelf) {
    console.assert(obj instanceof Record || obj instanceof F.Field);
    Record.call(this, (obj instanceof Record ? obj.content : obj), shelf);
  };
  FieldRecord.prototype = Object.create(Record.prototype);
  FieldRecord.prototype.constructor = FieldRecord;


  /**
   * An {FUsageRecord} is a {Record} that may only contain a {FieldUsage}.
   * @param obj {FieldUsage|Field|Record} Either a {FieldUsage} (will be stored as is) or a {Field} or a {Record} (used to construct a new {FieldUsage}).
   * @param shelf The Shelf this record belongs to.
   * @constructor
   * @alias module:shelves.FUsageRecord
   */
  var FUsageRecord; FUsageRecord = function (obj, shelf) {
    console.assert(obj instanceof Record || obj instanceof F.Field || obj instanceof F.FieldUsage);
    var field;
    if (obj instanceof F.FieldUsage) {
      // if a FieldUsage is given, use that
      field = obj;
    } else {
      // otherwise create a new Field
      if (obj instanceof Record) {
        obj = obj.content;
      }
      // no effect:
      //else if (obj instanceof F.Field) {
      //  obj = obj;
      //}
      field = new F.FieldUsage(obj);
    }
    Record.call(this, field, shelf);
  };
  FUsageRecord.prototype = Object.create(Record.prototype);
  FUsageRecord.prototype.constructor = FUsageRecord;


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
    FUsageRecord.call(this, new F.FieldUsage(obj), shelf);
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
    FieldRecord.call(this, obj, shelf);
    if (this.content.role === F.FieldT.Role.measure) {
      this.content.role = F.FieldT.Role.dimension;
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
    FieldRecord.call(this, obj, shelf);
    if (this.content.role === F.FieldT.Role.dimension) {
      this.content.role = F.FieldT.Role.measure;
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
    FUsageRecord.call(this, new F.FieldUsage(obj), shelf);
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
    FUsageRecord.call(this, new F.FieldUsage(obj), shelf);
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
    FUsageRecord.call(this, new F.FieldUsage(obj), shelf);
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
    FUsageRecord.call(this, new F.FieldUsage(obj), shelf);
  };
  FilterRecord.prototype = Object.create(FUsageRecord.prototype);
  FilterRecord.prototype.constructor = FilterRecord;
  FilterRecord.prototype.toString = function () {
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
    FUsageRecord.call(this, new F.FieldUsage(obj), shelf);
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

  /**
   * Returns a new set of types of shelves.
   * @returns {{dim: (exports|module.exports|DimensionShelf|*), meas: (exports|module.exports|MeasureShelf|*), detail: (exports|module.exports|DetailShelf|*), color: (exports|module.exports|ColorShelf|*), filter: (exports|module.exports|FilterShelf|*), shape: (exports|module.exports|ShapeShelf|*), size: (exports|module.exports|SizeShelf|*), row: (exports|module.exports|RowShelf|*), column: (exports|module.exports|ColumnShelf|*), remove: (exports|module.exports|RemoveShelf|*)}}
   */
  function construct () {
    return {
      dim :  new DimensionShelf(),
      meas : new MeasureShelf(),
      detail : new DetailShelf(),
      color : new ColorShelf(),
      filter : new FilterShelf(),
      shape : new ShapeShelf(),
      size : new SizeShelf(),
      row : new RowShelf(),
      column : new ColumnShelf(),
      remove : new RemoveShelf()
    };
  }

  return {
    Shelf: Shelf,
    ShelfTypeT: ShelfTypeT,

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

    populate: populate,
    construct:  construct
  };
});