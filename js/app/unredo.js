/**
 * A simple undo/redo manager for states.
 *
 * Note that it manages a sequence of states, not a sequence of actions (and their inverted counterpart).
 *
 * You can use the methods undo and redo to change between previous states.
 * If you commit a new state, all states _after_ the current state that has last been retrieved are lost.
 *
 * @module UnRedo
 * @author Philipp Lucas
 */
define([], function() {

  class UnRedo {

    constructor(limit = 100) {
      this._limit = limit;
      this._current = 0;
      this._present = 0;
      this._queue = [];
      this.clear();
    }

    /**
     * @returns the previous state if there is a previous state, and the current state otherwise.
     */
    undo() {
      if (this.hasPrevious) {
        this._current--;
      }
      return this.current();
    }

    /**
     * @returns the next state if there is a next state, and the current state otherwise.
     */
    redo() {
      if (this.hasNext) {
        this._current++;
      }
      return this.current();
    }

    /**
     * @returns {*} the current state.
     */
    current() {
      return this._queue[this._current];
    }

    /**
     * Commits a new state. All states after the last retrieved one are lost.
     * If the maximum number of states to store is reached the oldest one is lost.
     */
    commit(state) {
      this._current++;
      // loses all redos
      this._present = this._current;
      // add new state
      this._queue[this._current] = state;
      // truncate list to limit
      if (this._current === this._limit) {
        this._queue = this._queue.slice(1);
        this._current--;
        this._present--;
      }
    }

    /**
     * Clears the whole undo / redo queue.
     */
    clear() {
      this._current = 0;
      this._present = 0;
      this._queue = [];
    }

    /**
     * @returns the maximum number of states stored in the manager.
     */
    get limit() {
      return this._limit;
    }

    /**
     * @returns {boolean} True iff there is a previous to the current state.
     */
    get hasPrevious() {
      return this._current !== 0;
    }

    /**
     * @returns {boolean} True iff there is a next to the current state.
     */
    get hasNext() {
      return this._current === this._present;
    }

  }

  return UnRedo;
});