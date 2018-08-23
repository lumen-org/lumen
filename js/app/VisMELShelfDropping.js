/**
 * This module allows dragging and dropping of VisMEL and PQL objects on shelves. However, this does not mean a visual,
 * mouse-style dragging and dropping, but an abstract one:
 *
 * drop(target, source, overlap=_OverlapEnum.center): drop source (a Record of another shelf)
 *
 * Exports:
 *   A single function (drop).
 *
 * Configuration:
 *   the exported function has a property `config` that lets you configure some behaviour. See the code.
 *
 *
 * @module interaction
 * @author Philipp Lucas
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define(['lib/logger', './utils', './shelves', './visuals', './PQL', './VisMEL'], function (Logger, util, sh, vis, PQL, VisMEL) {
  'use strict';

  let logger = Logger.get('pl-vismelShelfDropping');
  logger.setLevel(Logger.WARN);

  // Configuration dictionary
  let config = {
    allowMultipleFieldsInFieldUsage : false,  // Aggregations may in principle take multiple Fields into account. This enables/disables the user to add a field to a an existing FieldUsage by dropping it centrally on it.
    replaceWithCenterOverlap : false,  // A centrally overlapping drop may replace an existing record or append after it.
  };

  const _OverlapEnum = Object.freeze({
    left: 'left',
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    center: 'center',
    none: 'none'
  });
  const _OverlapEnumValueSet = new Set(Object.values(_OverlapEnum));

  function _isDimOrMeasureShelf (shelf) {
    return (shelf.type === sh.ShelfTypeT.dimension || shelf.type === sh.ShelfTypeT.measure);
  }

  /**
   * Helper function that extracts a FieldUsage from a record that contains either a BaseMap or a FieldUsage
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

  /**
   * Returns the field(s) referred to in the given record.
   * @param record A Field, a Split, a Filter, a Density or an Aggregation
   * @returns {*}
   * @private
   */
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

  /**
   * Creates a new field usage instance from the given record that suits the type of shelf it is from. Returns that new FieldUsage.
   * @param record
   * @private
   */
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

  function _lastSplitAfter (tRecord, overlap) {
    let lastSplit;
    let offset = (overlap === 'center' || overlap === 'right' || overlap === 'bottom' ? 1 : 0);
    let tShelf = tRecord.shelf;
    for (let idx = tRecord.index() + offset; idx < tShelf.length; idx++)
      if (PQL.isSplit(tShelf.contentAt(idx)))
        lastSplit = tShelf.at(idx);
    return lastSplit;
  }

  function _earlierstDensityAggrBefore (tRecord, overlap) {
    let earliestDensityAggr;
    let offset = (overlap === 'center' || overlap === 'right' || overlap === 'bottom' ? 0 : 1);
    let tShelf = tRecord.shelf;
    for (let idx = tRecord.index() - offset; idx >= 0; idx--)
      if (PQL.isAggregationOrDensity(tShelf.contentAt(idx)))
        earliestDensityAggr = tShelf.at(idx);
    return earliestDensityAggr;
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
  function drop (target, source, overlap=_OverlapEnum.center) {
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

    logger.debug("executing real drop: ");
    logger.debug("target: ");
    logger.debug(target);
    logger.debug("source: ");
    logger.debug(source);
    logger.debug("overlap: " + overlap);

    if (!(source instanceof sh.Record)) {
      throw new TypeError('source must be a Record');
    }

    if (! _OverlapEnumValueSet.has(overlap) || overlap == _OverlapEnum.none) {
      logger.warn("invalid overlap value: " + overlap.toString());
      overlap = _OverlapEnum.center
    }

    // delegate to correct handler
    if (target instanceof sh.Record) {
      // TODO: what if record is no field usage but just a field!?
      let fu = _getFieldUsage(target);
      if (config.allowMultipleFieldsInFieldUsage && PQL.isAggregationOrDensity(fu) && overlap === _OverlapEnum.center) {
        let sourceField = _getField(source),
         targetFields = fu.fields;
        if (!targetFields.names().includes(sourceField.name)) {
          // add field to list of fields for that field usage
          fu.fields = _.union(targetFields, util.listify(sourceField));
          fu.emitInternalChanged();
        }        
      } else {
        onDrop[target.shelf.type](target, target.shelf, source, source.shelf, overlap);
      }
    } else if (target instanceof sh.Shelf) {
      onDrop[target.type](undefined, target, source, source.shelf, overlap);
    }
    else
      throw new TypeError('target must be a Record or a Shelf');
  }

  drop.config = config;


  var onDrop = {};
  onDrop[sh.ShelfTypeT.dimension] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    if (sShelf.type === sh.ShelfTypeT.dimension || sShelf.type === sh.ShelfTypeT.measure) {
      // move to target shelf
      (tRecord !== undefined ? tRecord : tShelf).append(sRecord);
    }
    sRecord.remove();
  };

  onDrop[sh.ShelfTypeT.measure] = onDrop[sh.ShelfTypeT.dimension];

  onDrop[sh.ShelfTypeT.row] = function (tRecord, tShelf, sRecord, sShelf, overlap) {
    let content = _fieldUsageFromRecord(sRecord);

    if (!config.replaceWithCenterOverlap && overlap === 'center')
      overlap = 'bottom';

    // maps the "drop of shelf"-case to the "drop on record"-case
    if (tRecord === undefined) {
      if (tShelf.empty()) {
        // note that overlap remains unchanged only in this case
        tShelf.append(content);
      } else if (overlap === 'left' || overlap === 'top') {
        tRecord = tShelf.at(0);
        overlap = 'left';
      } else if (overlap === 'bottom' || overlap === 'right' || overlap === 'center') {
        tRecord = tShelf.at(tShelf.length-1);
        overlap = 'right';
      } else {
        throw new RangeError("invalid overlap = " + overlap);
      }
    }

/*    TODO: debug the lastSplitAfter, ... and the whole dropping thing
    TODO: I think this can be simplified. _lastSplit starts with the correct values thanks to overlap - hence all/some the cases are the same*/

    if (tRecord !== undefined) {
      let lastSplit = _lastSplitAfter(tRecord, overlap),
        firstAggrDensity = _earlierstDensityAggrBefore(tRecord, overlap),
        isAggrDensity = PQL.isAggregationOrDensity(content);

      // note: _lastSplitAfter and _earlierstDensityAggrBefore respect the overlap parameter. Hence we don't need to consider this again, when checking for invalid drop positions. Before we had different (but in the end identical) fixing code for overlap === 'center', overlap === 'right' || overlap == 'bottom' ...

      if (isAggrDensity && lastSplit !== undefined && lastSplit.index() >= tRecord.index())
        lastSplit.append(content);
      else if (!isAggrDensity && firstAggrDensity !== undefined && firstAggrDensity.index() <= tRecord.index())
        firstAggrDensity.prepend(content);
      else {
        // this is only reached if no fix is needed
        if (overlap === 'center')
          tRecord.replaceBy(content);
        else if (overlap === 'right' || overlap === 'bottom')
          tRecord.append(content);
        else if (overlap === 'left' || overlap === 'top')
          tRecord.prepend(content);
        else {
          throw new RangeError("invalid overlap = " + overlap);
        }
      }
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

  return drop;
});