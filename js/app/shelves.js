/**
 * Shelves module.
 *
 * @module shelves
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
//define(['lib/emitter', 'lib/logger', './utils', './PQL',], function (E, Logger, utils, PQL) {
define(['lib/emitter', 'lib/logger', './utils', './PQL', './VisMEL',], function (Emitter, Logger, utils, PQL, VisMEL) {
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
   * @param dimShelf
   * @param measShelf
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
   * Swaps the contents of shelves A and B.
   */
  function swap(shelfA, shelfB) {
    let lenA = shelfA.length,
      lenB = shelfB.length;

    for (let i=0;i<lenA;++i) {
      shelfB.append(shelfA.at(0));
      shelfA.remove(0);
    }

    for (let i=0;i<lenB;++i) {
      shelfA.append(shelfB.at(0));
      shelfB.remove(0);
    }
  }

  /**
   * Enumeration on the possible shelf types.
   * @enum
   * @alias module:shelves.ShelfTypeT
   */
  var ShelfTypeT = Object.freeze({
    //modeldata: 'mvdShelf',
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
      this.opt = opt;
      if (!opt) opt = {};
      this.limit = utils.selectValue(opt.limit, Number.MAX_SAFE_INTEGER);
      Emitter(this);
      this.on(Shelf.Event.Add, child => {
        this.bubbleChangedEventUp(child.content);  // bubble on content, not record!
      });
      this.bubbleEventUp(this, Shelf.Event.Add, Emitter.ChangedEvent);
      this.bubbleEventUp(this, Shelf.Event.Remove, Emitter.ChangedEvent);
    }

    static _isRecordOrIdx (obj) {
      return typeof obj === 'number' || obj instanceof Record;
    }

    append(obj) {
      if (this.length >= this.limit) return false;
      var record = new Record(obj, this);
      this.records.push(record);
      this.emit(Shelf.Event.Add, record);
      return record;
    }

    prepend(obj) {
      if (this.length >= this.limit) return false;
      var record = new Record(obj, this);
      this.records.unshift(record);
      this.emit(Shelf.Event.Add, record);
      return record;
    }

    contains(record) {
      return (-1 != this.records.indexOf(record));
    }

    clear() {
      for (let idx = this.records.length-1; idx >= 0; --idx)
        this.remove(idx);
    }

    at(idx) {
      return this.records[idx];
    }

    contentAt(idx) {
      var record = this.records[idx];
      return (record ? record.content : {}); // TODO: I think that should throw instead!
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
      this.emit(Shelf.Event.Add, record);
      return record;
    }

    replace(oldRecordOrIdx, obj) {
      if(!Shelf._isRecordOrIdx(oldRecordOrIdx)) throw TypeError("argument must be a Record or an index");
      let idx = (typeof oldRecordOrIdx === 'number' ? oldRecordOrIdx : this.indexOf(oldRecordOrIdx));
      this.remove(idx);
      return this.insert(obj, idx);
    }

    get length() {
      return this.records.length;
    }

    empty() {
      return (this.length === 0);
    }

    toString() {
      return this.records.reduce(function (val, elem) {
        return val + elem.content.toString() + "\n";
      }, "");
    }

    /**
     * Returns a deep copy of this shelf. This expects that all content can be copied by a method
     * .copy() on it.
     */
    copy () {
      var copy = new Shelf(this.type, this.opt);
      for(let elem of this)
        copy.append(elem.content.copy());
      return copy;
    }

    *[Symbol.iterator]() {
      var nextIdx = 0;
      while (nextIdx < this.length)
        yield this.at(nextIdx++);
    }
  }

  // for internal usage
  Shelf.Event = Object.freeze({
    Add: 'shelf.add',
    Remove: 'shelf.remove',
    Changed: 'shelf.changed'
  });

  /**
   * Returns a new set of different types of shelves.
   */
  function construct() {
    return {
      //modeldata: new Shelf(ShelfTypeT.modeldata),
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
    Shelf,
    ShelfTypeT,
    Record,
    populate,
    swap,
    construct,
  };
});