/**
 * Shelves module.
 *
 * @module shelves
 * @author Philipp Lucas
 */
define(['lib/emitter', 'lib/logger', './utils', './PQL', ], function(E, Logger, utils, PQL) {
  'use strict';

  var logger = Logger.get('pl-shelves');
  logger.setLevel(Logger.DEBUG);

   /**
   * An {@link Record} stores some content and is bound to a certain {@link Shelf}.
   *
   * In particular a record 'knows' which shelf it belongs to by means of its '.shelf' attribute. The content can be
   * accessed by the '.content' attribute.
   *
   * Records do NOT emit any events.
   */
  class Record {
    /**
     * Note that Records can never store other records. Instead the first non-Record-content will be stored.
     * @param content - Note that content itself will be stored, not a copy of it.
     * @param {Shelf} shelf - The shelf that this record belongs to.
     * @constructor
     * @alias module:shelves.Record
     */
    constructor (content, shelf) {
      while (content instanceof Record)
        content = content.content;
      this.content = content;
      this.shelf = shelf;
    }

    append (record) {
      var shelf = this.shelf;
      return shelf.insert(record, shelf.records.indexOf(this) + 1);
    }

    prepend(record) {
      var shelf = this.shelf;
      return shelf.insert(record, shelf.records.indexOf(this));
    }

    remove() {
      return this.shelf.remove(this);
    }

    replaceBy(record) {
      return this.shelf.replace(this, record);
    }

    index() {
      return this.shelf.indexOf(this);
    }

    toString() {
      return this.content.toString();
    }
  }

  /**
   * Populates the given dimension and measure shelf with the field from the given model. Note that references to the fields are added, not copies of them.
   * Note: it does not make added fields {@link beVisual} or {@link beInteractable}!
   * @param model
   * @param {DimensionShelf} dimShelf
   * @param {MeasureShelf} measShelf
   */
  function populate (model, dimShelf, measShelf) {
    for (let field of model.fields.values()) {
      if (field.dataType === PQL.FieldT.DataType.num)
        measShelf.append(field);
      else if (field.dataType === PQL.FieldT.DataType.string)
        dimShelf.append(field);
      else
        throw new RangeError('invalid value in field.dataType: ' + field.dataType);
    }
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
    detail: 'detailShelf',
    remove: 'removeShelf'
  });

  /**
   * A Shelf is a container that holds records of type RecordConstructor.
   *
   * Note that records are never inserted as passed, but a new record is created on base of the passed record.
   * Shelves also trigger an event Shelf.ChangedEvent, whenever its content changed.
   *
   * If you change the content of any records, you are responsible for triggering that event!
   */
  class Shelf {

    /**
     * @param type - The type/name/id of this Shelf.
     * @param [opt.limit] The maximum number of elements allowed in the shelf.
     * @constructor
     * @alias module:shelves.Shelf
     */
    constructor (type, opt) {   
      //this.RecordConstructor = RecordConstructor;
      this.records = [];
      if (!type) throw new RangeError("parameter 'type' missing");
      this.type = type;
      if (!opt) opt = {};
      this.limit = utils.selectValue(opt.limit, Number.MAX_SAFE_INTEGER);
    }

    append (obj) {
      if (this.length >= this.limit) return false;
      var record = new Record(obj, this);
      this.records.push(record);
      this.emit(Shelf.ChangedEvent);
      return record;
    }

    prepend (obj) {
      if (this.length >= this.limit) return false;
      var record = new Record(obj, this);
      this.records.unshift(record);
      this.emit(Shelf.ChangedEvent);
      return record;
    }

    contains (record) {
      return (-1 != this.records.indexOf(record));
    }

    clear () {
      this.records = [];
      this.emit(Shelf.ChangedEvent);
    }

    at (idx) {
      return this.records[idx];
    }

    contentAt (idx) {
      var record = this.records[idx];
      return (record ? record.content : {});
    }

    remove (recordOrIdx) {
      if (this.limit === 1 && recordOrIdx === undefined) recordOrIdx = 0;
      var records = this.records;
      var idx = (typeof recordOrIdx === 'number'? recordOrIdx : records.indexOf(recordOrIdx));
      records.splice(idx, 1);
      this.emit(Shelf.ChangedEvent);
    }

    indexOf (record) {
      return this.records.indexOf(record);
    }

    insert (obj, idx) {
      if (this.length >= this.limit) return false;
      var records = this.records;
      if (idx < 0 || idx > records.length) {
        return false;
      }
      var record = new Record(obj, this);
      records.splice(idx, 0, record);
      this.emit(Shelf.ChangedEvent);
      return record;
    }

    replace (oldRecordOrIdx, newRecord) {
      var records = this.records;
      var idx;
      if (this.limit === 1 && !newRecord) {
        newRecord = oldRecordOrIdx;
        idx = 0;
      } else {
        console.assert(this.limit === 1 || this.contains(oldRecordOrIdx));
        idx = (typeof oldRecordOrIdx === 'number'? oldRecordOrIdx : records.indexOf(oldRecordOrIdx));
      }
      var record = new Record(newRecord, this);
      records.splice(idx, 1, record);
      this.emit(Shelf.ChangedEvent);
      return record;
    }

    length () {
      return this.records.length;
    }

    empty () {
      return(this.length() === 0);
    }

    toString () {
      return this.records.reduce(function (val, elem) {
        return val + elem.content.toString() + "\n";
      }, "");
    }
  }

  Shelf.ChangedEvent = 'shelf.changed';
  E.Emitter(Shelf.prototype);

  /**
   * An {FieldRecord} is a {Record} that may only contain a {Field}.
   * @param obj {Field|Record} Either a {Field} (will be stored as is), or a {Record} that contains a {@link Field}.
   * @param shelf The {Shelf} this record belongs to.
   * @constructor
   * @alias module:shelves.FieldRecord
   *
  var FieldRecord; FieldRecord = function (obj, shelf) {
    console.assert(obj instanceof Record && obj.content instanceof PQL.Field || obj instanceof PQL.Field);
    Record.call(this, (obj instanceof Record ? obj.content : obj), shelf);
  };
  FieldRecord.prototype = Object.create(Record.prototype);
  FieldRecord.prototype.constructor = FieldRecord;
*/

  /**
   * An {FUsageRecord} is a {Record} that may only contain {FieldUsage}s.
   * @param obj {FieldUsage|Field|Record} Either a {FieldUsage} (will be stored as is) or a {Field} or a {Record} (used to construct a new {FieldUsage}).
   * @param shelf The Shelf this record belongs to.
   * @constructor
   * @alias module:shelves.FUsageRecord
   *
  var FUsageRecord; FUsageRecord = function (obj, shelf) {
    //console.assert(obj instanceof Record || obj instanceof PQL.Field || obj instanceof PQL.FieldUsage);
    var field;
    if (obj instanceof PQL.FieldUsage) {
      // if a FieldUsage is given, use that
      field = obj;
    } else {
      // otherwise create a new Field
      if (obj instanceof Record) {
        obj = obj.content;
      }
      // no effect:
      //else if (obj instanceof PQL.Field) {
      //  obj = obj;
      //}
      field = new PQL.FieldUsage(obj);
    }
    Record.call(this, field, shelf);
  };
  FUsageRecord.prototype = Object.create(Record.prototype);
  FUsageRecord.prototype.constructor = FUsageRecord;*/


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
   *
  class ColorRecord extends Record {
    constructor (obj, shelf) {
      super(obj, shelf);
    }
  }
/*  var ColorRecord; ColorRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new PQL.FieldUsage(obj), shelf);
  };
  ColorRecord.prototype = Object.create(FUsageRecord.prototype);
  ColorRecord.prototype.constructor = ColorRecord;*/

  /**
   * A {DimensionRecord} is stored in a dimension shelf and is based on a field.
   * @param obj The object the new dimension record is based on.
   * @param shelf
   * @constructor
   * @alias module:shelves.DimensionRecord
   *
  var DimensionRecord; DimensionRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FieldRecord.call(this, obj, shelf);
    if (this.content.role === PQL.FieldT.Role.measure) {
      this.content.role = PQL.FieldT.Role.dimension;
    }
  };
  DimensionRecord.prototype = Object.create(FieldRecord.prototype);
  DimensionRecord.prototype.constructor = DimensionRecord;

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.MeasureRecord
   *
  var MeasureRecord; MeasureRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FieldRecord.call(this, obj, shelf);
    if (this.content.role === PQL.FieldT.Role.dimension) {
      this.content.role = PQL.FieldT.Role.measure;
    }
  };
  MeasureRecord.prototype = Object.create(FieldRecord.prototype);
  MeasureRecord.prototype.constructor = MeasureRecord;

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.LayoutRecord
   *
  var LayoutRecord; LayoutRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new PQL.FieldUsage(obj), shelf);
  };
  LayoutRecord.prototype = Object.create(FUsageRecord.prototype);
  LayoutRecord.prototype.constructor = LayoutRecord;

  /**
   *
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.ShapeRecord
   *
  var ShapeRecord; ShapeRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new PQL.FieldUsage(obj), shelf);
  };
  ShapeRecord.prototype = Object.create(FUsageRecord.prototype);
  ShapeRecord.prototype.constructor = ShapeRecord;

  /**
   *
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.SizeRecord
   *
  var SizeRecord; SizeRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new PQL.FieldUsage(obj), shelf);
  };
  SizeRecord.prototype = Object.create(FUsageRecord.prototype);
  SizeRecord.prototype.constructor = SizeRecord;

  /**
   * @param obj
   * @param shelf
   * @constructor
   * @alias module:shelves.FilterRecord
   *
  var FilterRecord; FilterRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new PQL.FieldUsage(obj), shelf);
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
   *
  var DetailRecord; DetailRecord = function (obj, shelf) {
    if (obj instanceof Record) {
      obj = obj.content;
    }
    FUsageRecord.call(this, new PQL.FieldUsage(obj), shelf);
  };
  DetailRecord.prototype = Object.create(FUsageRecord.prototype);
  DetailRecord.prototype.constructor = DetailRecord;

  /**
   * A dimension shelf holds fields dimensions
   * @constructor
   * @alias module:shelves.DimensionShelf
   *
  var DimensionShelf; DimensionShelf = function () {
    Shelf.call(this, DimensionRecord);
    this.type = ShelfTypeT.dimension;
  };
  DimensionShelf.prototype = Object.create(Shelf.prototype);
  DimensionShelf.prototype.constructor = DimensionShelf;


  /**
   * @constructor
   * @alias module:shelves.MeasureShelf
   *
  var MeasureShelf; MeasureShelf = function () {
    Shelf.call(this, MeasureRecord);
    this.type = ShelfTypeT.measure;
  };
  MeasureShelf.prototype = Object.create(Shelf.prototype);
  MeasureShelf.prototype.constructor = MeasureShelf;

  /**
   * @constructor
   * @alias module:shelves.RowShelf
   *
  var RowShelf; RowShelf = function () {
    Shelf.call(this, LayoutRecord);
    this.type = ShelfTypeT.row;
  };
  RowShelf.prototype = Object.create(Shelf.prototype);
  RowShelf.prototype.constructor = RowShelf;

  /**
   * @constructor
   * @alias module:shelves.ColumnShelf
   *
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
   *
  class ColorShelf extends Shelf {
    constructor () {
      super(ColorRecord, {limit: 1});
      this.type = ShelfTypeT.color;
    }
  }

  /**
   * @constructor
   * @alias module:shelves.ShapeShelf
   *
  var ShapeShelf; ShapeShelf = function () {
    Shelf.call(this, ShapeRecord);
    this.type = ShelfTypeT.shape;
  };
  ShapeShelf.prototype = Object.create(Shelf.prototype);
  ShapeShelf.prototype.constructor = ShapeShelf;

  /**
   * @constructor
   * @alias module:shelves.SizeShelf
   *
  var SizeShelf; SizeShelf = function () {
    Shelf.call(this, SizeRecord);
    this.type = ShelfTypeT.size;
  };
  SizeShelf.prototype = Object.create(Shelf.prototype);
  SizeShelf.prototype.constructor = SizeShelf;

  /**
   * @constructor
   * @alias module:shelves.FilterShelf
   *
  var FilterShelf; FilterShelf = function () {
    Shelf.call(this, FilterRecord);
    this.type = ShelfTypeT.filter;
  };
  FilterShelf.prototype = Object.create(Shelf.prototype);
  FilterShelf.prototype.constructor = FilterShelf;

  /**
   * @constructor
   * @alias module:shelves.DetailShelf
   *
  var DetailShelf; DetailShelf = function () {
    Shelf.call(this, DetailRecord);
    this.type = ShelfTypeT.detail;
  };
  DetailShelf.prototype = Object.create(Shelf.prototype);
  DetailShelf.prototype.constructor = DetailShelf;

  /**
   * @constructor
   * @alias module:shelves.RemoveShelf
   *
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
      dim :  new Shelf(ShelfTypeT.dimension),
      meas : new Shelf(ShelfTypeT.measure),
      detail : new Shelf(ShelfTypeT.detail),
      color : new Shelf(ShelfTypeT.color),
      filter : new Shelf(ShelfTypeT.filter),
      shape : new Shelf(ShelfTypeT.shape),
      size : new Shelf(ShelfTypeT.size),
      row : new Shelf(ShelfTypeT.row),
      column : new Shelf(ShelfTypeT.column),
      remove : new Shelf(ShelfTypeT.remove)
    };
  }

  return {
    Shelf: Shelf,
    ShelfTypeT: ShelfTypeT,

    Record: Record,
    /*FieldRecord: FieldRecord,
    FUsageRecord: FUsageRecord,

    DetailRecord: DetailRecord,
    ColorRecord: ColorRecord,
    ShapeRecord: ShapeRecord,
    SizeRecord: SizeRecord,
    FilterRecord: FilterRecord,
    DimensionRecord: DimensionRecord,
    MeasureRecord: MeasureRecord,
    LayoutRecord: LayoutRecord,*/

    /*DetailShelf: DetailShelf,
    ColorShelf: ColorShelf,
    ShapeShelf: ShapeShelf,
    SizeShelf: SizeShelf,
    FilterShelf: FilterShelf,
    DimensionShelf: DimensionShelf,
    MeasureShelf: MeasureShelf,
    RowShelf: RowShelf,
    ColumnShelf: ColumnShelf,
    RemoveShelf: RemoveShelf,*/

    populate: populate,
    construct:  construct
  };
});