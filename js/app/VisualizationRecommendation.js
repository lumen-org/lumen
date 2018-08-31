/* copyright © 2018 Philipp Lucas (philipp.lucas@uni-jena.de) */

define(['./PQL', './VisMEL', './shelves', './VisMELShelfDropping',], function (PQL, VisMEL, sh, drop) {

  /**
   * Returns the modified collection of shelves where field has been added in a 'visually efficient way'.
   * @param shelves A VisMEL query as a collection of shelves.
   * @param record The record that holds field to add to the VisMEL query. Must be from the dims or measures shelf. // todo: should be allowed to be a field in the future?!
   */
  function recommend (shelves, record) {
    let field = record.content;
    if (!PQL.isField(field))
      throw TypeError("field must be a Field");

    // super simple heuristics :)
    if (shelves.column.empty()) {
      drop(shelves.column, record);
    } else if (shelves.row.empty()) {
      drop(shelves.row, record);
    } else if (shelves.color.empty()) {
      drop(shelves.color, record);
    } else if (shelves.shape.empty() && field.isDiscrete()) {
      drop(shelves.shape, record);
    } else {
      // do nothing for now :)
      return shelves;
    }

    return shelves;
  }

  /**
   * Mixin to make a shelf recommendable, i.e. on double click a record of this shelf is added to the collection of specification shelves using some visualization recommendation heuristics.
   *
   * Enables it for all current and future records of this shelf.
   */
  function _setRecommendable (record, shelves, onOffFlag=true){
    if (onOffFlag) {
      record.$visual.on('dblclick.pl-recommendation', function (ev) {
//         console.log(ev);
        recommend(shelves, record);
      });
    }
    else {
      record.$visual.off('dblclick.pl-recommendation');
    }
  }

  sh.Shelf.prototype.beRecommendable = function (shelves) {
    this.records.forEach(record => _setRecommendable(record, shelves, true));
    this.on(sh.Shelf.Event.Add, record => _setRecommendable(record, shelves, true));
    this.on(sh.Shelf.Event.Remove, record => _setRecommendable(record, shelves, false));
    return this;
  };

  return {
    recommend,
  }
});