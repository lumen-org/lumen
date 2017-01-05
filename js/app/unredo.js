/**
 * A simple undo/redo manager for states.
 *
 * Note that it manages a sequence of states, not a sequence of actions (and their inverted counterpart).
 *
 * You can use the methods undo and redo to change between previous states.
 * If you commit a new state, all states _after_ the current state that has last been retrieved are lost.
 *
 * @module UnRedo
 * @author Philipp Lucas, Matthias Mitterreiter
 * @copyright © 2016 Philipp Lucas (philipp.lucas@uni-jena.de)
 */
define([], function() {

  class UnRedo {

    constructor(/*limit = 100*/) {
      // this._limit = limit;
      this._undo = [];
      this._redo = [];
      this._current = undefined;
      this.clear();
    }

    /**
     * @returns the previous state if there is a previous state, and the current state otherwise.
     */
    undo() {
      if (!this.hasUndo)
        throw new RangeError("no undo left");
      this._redo.push(this._current);
      this._current = this._undo.pop();
      return this._current;
    }

    /**
     * @returns the next state if there is a next state, and throws a RangeError otherwise.
     */
    redo() {
      if (!this.hasRedo)
        throw new RangeError("no redo left");
      this._undo.push(this._current);
      this._current = this._redo.pop();
      return this._current;
    }

    /**
     * Commits a new state. All states after the last retrieved one are lost.
     * If the maximum number of states to store is reached the oldest one is lost.
     */
    commit(state) {
      // push (old) current state to undo stack
      this._undo.push(this._current);

      this._current = state;

      // loses all redos
      //this._redo = [];
      //
      // // truncate list to limit
      // if (this._current === this._limit) {
      //   this._queue = this._queue.slice(1);
      //   this._current--;
      //   this._present--;
      // }
    }

    /**
     * Clears the whole undo / redo queue.
     */
    clear() {
      this._undo = [];
      this._redo = [];
      this._current = undefined;
    }

    /**
     * @returns the maximum number of states stored in the manager.
     */
    /*get limit() {
      return this._limit;
    }*/

    /**
     * @returns {boolean} True iff there is a previous to the current state.
     */
    get hasRedo() {
      return !this._redo.empty();
    }

    /**
     * @returns {boolean} True iff there is a next to the current state.
     */
    get hasUndo() {
      return !this._undo.empty();
    }

  }

  return UnRedo;
});