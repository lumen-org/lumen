/**
 * This module allows dragging and dropping of VisMEL and PQL objects on shelves. However, this does not mean a visual,
 * mouse-style dragging and dropping, but an abstract one:
 *
 * drop(target, source, overlap=_OverlapEnum.center): drop source (a Record of another shelf)
 *   d
 *
 * @module interaction
 * @author Philipp Lucas
 */
define(['lib/logger', './shelves', './visuals', './PQL', './VisMEL'], function (Logger, sh, vis, PQL, VisMEL) {
  'use strict';

  var logger = Logger.get('pl-vismelShelfDropping');
  logger.setLevel(Logger.WARN);

  var _OverlapEnum = Object.freeze({
    left: 'left',
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    center: 'center',
    none: 'none'
  });

  function _isDimOrMeasureShelf (shelf) {
    return (shelf.type === sh.ShelfTypeT.dimension || shelf.type === sh.ShelfTypeT.measure);
  }

  /**
   * Helper function that extracts a Field from a record that contains either a Field, a BaseMap or a FieldUsage
   */
  function _getFieldUsage (record) {
    let content = record.content;
    if (content instanceof VisMEL.BaseMap)
      return content.fu;
    else if (PQL.isFieldUsage(content))
      return content;
    else
      throw new RangeError("unsupported type of content of record: " + content);
  }

  function _getField (record) {
    let content = record.content;
    if (PQL.isField(content))
      return content;
    else {
      if (content instanceof VisMEL.BaseMap)
        content = content.fu;
      if (PQL.isSplit(content) || PQL.isFilter(content))
        return content.field;
      else if (PQL.isAggregationOrDensity(content))
        return content.fields[0];
    }
    throw new RangeError('invalid record content: ' + content);
  }

  function _fieldUsageFromRecord (record) {
    let shelf = record.shelf;
    if (shelf.type === sh.ShelfTypeT.dimension)
      return PQL.Split.DefaultSplit(_getField(record));
    else if (shelf.type === sh.ShelfTypeT.measure)
      return PQL.Aggregation.DefaultAggregation(_getField(record));
    else if (shelf.type === sh.ShelfTypeT.filter) {
      let field = _getField(record);
      return field.isDiscrete() ? PQL.Split.DefaultSplit(field) : PQL.Aggregation.DefaultAggregation(field);
    } else
      return _getFieldUsage(record);
  }

  /**
   * Drag source record to target. The effect depends on ... many things but in particular the shelf type of the source and target.
   * This function encapsulates the logic of how Fields, FieldUsages and FieldUsageMaps can be converted to each other.
   *
   * TODO: I guess I should document this logic at some point...
   *
   * @param target A Record or a Shelf.
   * @param source A Record
   * @param overlap How they overlap, on of 'left', 'right', 'center', 'top', 'bottom', 'none'.
   */
  var onDrop = function (target, source, overlap=_OverlapEnum.center) {
    /*
     * Primary onDrop function. It will forward to appropriate subhandlers, there is one handler for each value in
     * {@link module:shelves.ShelfTypeT}, hence one for each type of shelf.
     *
     * abbreviations are as follows:
     *  * tRecord: target record
     *  * sRecord: source record
     *  * tShelf: target shelf
     *  * sShelf: source shelf
     */
    if (!(source instanceof sh.Record)) {
      throw new TypeError('source must be a Record');
    }
    // delegate to correct handler
    if (target instanceof sh.Record) {
      let fu = _getFieldUsage(target);
      if (PQL.isAggregationOrDensity(fu) && _isDimOrMeasureShelf(source.shelf)) {
        // add field to list of fields for that field usage
        let field = source.content;
        fu.fields.push(field);
        fu.emitInternalChanged();
      } else {
        onDrop[target.shelf.type](target, target.shelf, source, source.shelf, overlap);
      }
    } else if (target instanceof sh.Shelf)
      onDrop[target.type](undefined, target, source, source.shelf, overlap);
    else
      throw new TypeError('target must be a Record or a Shelf');
  };

  onDrop[sh.ShelfTypeT.dimension] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (sShelf.type === sh.ShelfTypeT.dimension || sShelf.type === sh.ShelfTypeT.measure) {
      // move to target shelf
      (tRecord !== undefined ? tRecord : tShelf).append(sRecord);
    }
    sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.measure] = onDrop[sh.ShelfTypeT.dimension];

  onDrop[sh.ShelfTypeT.row] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // general rule: measures always come after dimensions
    let content;
    // reuse existing or construct new aggregation or split usage
    if (sShelf.type === sh.ShelfTypeT.dimension)
      content = PQL.Split.DefaultSplit(_getField(sRecord));
    else if (sShelf.type === sh.ShelfTypeT.measure)
      content = PQL.Aggregation.DefaultAggregation(_getField(sRecord));
    else if (sShelf.type === sh.ShelfTypeT.filter) {
      let field = _getField(sRecord);
      content = field.isDiscrete() ? PQL.Split.DefaultSplit(field) : PQL.Aggregation.DefaultAggregation(field);
    } else
      content = _getFieldUsage(sRecord);

    // todo: fix for invalid drop positions,i.e.: dropping dimensions _after_ measures, or measures _before_ dimensions
    // alternative: do reorder after the element has been dropped
    if (tRecord !== undefined) {
      switch (overlap) {
        case _OverlapEnum.left:
        case _OverlapEnum.top:
          // insert before element
          tRecord.prepend(content);
          break;
        case _OverlapEnum.right:
        case _OverlapEnum.bottom:
          // insert after target element
          tRecord.append(content);
          break;
        case _OverlapEnum.center:
          // replace
          tRecord.remove();
          tRecord.replaceBy(content);
          break;
        default:
          console.error("Dropping on item, but overlap = " + overlap);
      }
    } else {
      tShelf.append(content);
    }
    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.column] = onDrop[sh.ShelfTypeT.row];

  onDrop[sh.ShelfTypeT.detail] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    let content = PQL.Split.DefaultSplit(_getField(sRecord));
    (tRecord !== undefined ? tRecord : tShelf).append(content);
    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.filter] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (sShelf === sh.ShelfTypeT.filter) {
      // do nothing if just moving filters
      // todo: allow reordering
      return;
    }

    let filter = PQL.Filter.DefaultFilter(_getField(sRecord));
    if (tRecord !== undefined)
      tRecord.replaceBy(filter);
    else
      tShelf.append(filter);

    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.color] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // remove any existing record in this shelf
    if (!tShelf.empty()) tShelf.at(0).remove();
    // build new color map
    let fu = _fieldUsageFromRecord(sRecord);
    let content = VisMEL.ColorMap.DefaultMap(fu);
    // add new color map
    tShelf.append(content);
    // remove source record
    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.shape] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // remove any existing record in this shelf
    if (!tShelf.empty()) tShelf.at(0).remove();
    // build new color map
    let fu = _fieldUsageFromRecord(sRecord);
    let content = VisMEL.ShapeMap.DefaultMap(fu);
    // add new color map
    tShelf.append(content);
    // remove source record
    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.size] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    // remove any existing record in this shelf
    if (!tShelf.empty()) tShelf.at(0).remove();
    // build new color map
    let fu = _fieldUsageFromRecord(sRecord);
    let content = VisMEL.SizeMap.DefaultMap(fu);
    // add new color map
    tShelf.append(content);
    // remove source record
    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.remove] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (!_isDimOrMeasureShelf(sShelf)) sRecord.remove();
  };

  return onDrop;
});