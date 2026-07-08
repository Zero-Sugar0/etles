module.exports = {
  Inflate: class Inflate {
    constructor() {
      this._ended = false;
    }
    init() {}
    push() {}
    end() {
      this._ended = true;
    }
  },
};
