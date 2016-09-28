/**
 * Shelves module.
 *
 * @module shelves
 * @author Philipp Lucas
 */
//define(['lib/emitter', 'lib/logger', './utils', './PQL',], function (E, Logger, utils, PQL) {
define(['lib/emitter', 'lib/logger', './utils', './PQL', './VisMEL',], function (E, Logger, utils, PQL, VisMEL) {
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
    constructor(content, shelf) {
      while (content instanceof Record)
        content = content.content;

      if (! (content instanceof PQL.Field || PQL.isFieldUsage(content) || content instanceof VisMEL.BaseMap ))
        throw TypeError("content must be Field, FieldUsage or a BaseMap");

      this.content = content;
      this.shelf = shelf;
    }

    append(obj) {
      var shelf = this.shelf;
      return shelf.insert(obj, shelf.indexOf(this) + 1);
    }

    prepend(obj) {
      var shelf = this.shelf;
      return shelf.insert(obj, shelf.indexOf(this));
    }

    remove() {
      return this.shelf.remove(this);
    }

    replaceBy(obj) {
      return this.shelf.replace(this, obj);
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
  function populate(model, dimShelf, measShelf) {
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
   * A Shelf is a container that holds Records.
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
    constructor(type, opt) {
      this.records = [];
      if (!type) throw new RangeError("parameter 'type' missing");
      this.type = type;
      if (!opt) opt = {};
      this.limit = utils.selectValue(opt.limit, Number.MAX_SAFE_INTEGER);
    }

    static _isRecordOrIdx (obj) {
      return typeof obj === 'number' || obj instanceof Record;
    }

    append(obj) {
      if (this.length >= this.limit) return false;
      var record = new Record(obj, this);
      this.records.push(record);
      //this.emit(Shelf.ChangedEvent);
      this.emit(Shelf.Event.Add, record);
      return record;
    }

    prepend(obj) {
      if (this.length >= this.limit) return false;
      var record = new Record(obj, this);
      this.records.unshift(record);
      //this.emit(Shelf.ChangedEvent);
      this.emit(Shelf.Event.Add, record);
      return record;
    }

    contains(record) {
      return (-1 != this.records.indexOf(record));
    }

    clear() {
      for (let idx = this.records.length; idx > 0; --idx)
        this.remove(idx);
      //this.records = [];
    }

    at(idx) {
      return this.records[idx];
    }

    contentAt(idx) {
      var record = this.records[idx];
      return (record ? record.content : {});
    }

    content() {
      return this.records.map(record => record.content);
    }

    remove(recordOrIdx) {
      if(!Shelf._isRecordOrIdx(recordOrIdx)) throw TypeError("argument must be a Record or an index");
      if (this.limit === 1 && recordOrIdx === undefined) recordOrIdx = 0;
      var records = this.records;
      var idx = (typeof recordOrIdx === 'number' ? recordOrIdx : records.indexOf(recordOrIdx));
      var record = records[idx];
      records.splice(idx, 1);
      this.emit(Shelf.Event.Remove, record);
      //this.emit(Shelf.ChangedEvent);
    }

    indexOf(record) {
      return this.records.indexOf(record);
    }

    insert(obj, idx) {
      if (this.length >= this.limit) return false;
      var records = this.records;
      if (idx < 0 || idx > records.length)
        throw RangeError("invalid value for idx");
      var record = new Record(obj, this);
      records.splice(idx, 0, record);
      //this.emit(Shelf.ChangedEvent);
      this.emit(Shelf.Event.Add, record);
      return record;
    }

    replace(oldRecordOrIdx, obj) {
      // var records = this.records;
      // var idx;
      // if (this.limit === 1 && !newRecord) {
      //   newRecord = oldRecordOrIdx;
      //   idx = 0;
      // } else {
      //   console.assert(this.limit === 1 || this.contains(oldRecordOrIdx));
      //   idx = (typeof oldRecordOrIdx === 'number'? oldRecordOrIdx : records.indexOf(oldRecordOrIdx));
      // }
      // var record = new Record(newRecord, this);
      // records.splice(idx, 1, record);
      // this.emit(Shelf.ChangedEvent);
      // return record;
      if(!Shelf._isRecordOrIdx(oldRecordOrIdx)) throw TypeError("argument must be a Record or an index");
      let idx = (typeof oldRecordOrIdx === 'number' ? oldRecordOrIdx : this.indexOf(oldRecordOrIdx));
      this.remove(idx);
      return this.insert(obj, idx);
    }

    length() {
      return this.records.length;
    }

    empty() {
      return (this.length() === 0);
    }

    toString() {
      return this.records.reduce(function (val, elem) {
        return val + elem.content.toString() + "\n";
      }, "");
    }
  }

  Shelf.ChangedEvent = 'shelf.changed';
  Shelf.Event = Object.freeze({
    Add: 'shelf.add',
    Remove: 'shelf.remove',
    Changed: 'shelf.changed'
  });
  E.Emitter(Shelf.prototype);

  /**
   * Returns a new set of types of shelves.
   * @returns {{dim: (exports|module.exports|DimensionShelf|*), meas: (exports|module.exports|MeasureShelf|*), detail: (exports|module.exports|DetailShelf|*), color: (exports|module.exports|ColorShelf|*), filter: (exports|module.exports|FilterShelf|*), shape: (exports|module.exports|ShapeShelf|*), size: (exports|module.exports|SizeShelf|*), row: (exports|module.exports|RowShelf|*), column: (exports|module.exports|ColumnShelf|*), remove: (exports|module.exports|RemoveShelf|*)}}
   */
  function construct() {
    return {
      dim: new Shelf(ShelfTypeT.dimension),
      meas: new Shelf(ShelfTypeT.measure),
      detail: new Shelf(ShelfTypeT.detail),
      color: new Shelf(ShelfTypeT.color),
      filter: new Shelf(ShelfTypeT.filter),
      shape: new Shelf(ShelfTypeT.shape),
      size: new Shelf(ShelfTypeT.size),
      row: new Shelf(ShelfTypeT.row),
      column: new Shelf(ShelfTypeT.column),
      remove: new Shelf(ShelfTypeT.remove)
    };
  }

  return {
    Shelf: Shelf,
    ShelfTypeT: ShelfTypeT,
    Record: Record,
    populate: populate,
    construct: construct
  };
});