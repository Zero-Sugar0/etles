export class Inflate {
  constructor() {
    this._ended = false;
  }

  init() {}
  push() {}
  end() {
    this._ended = true;
  }
}

export default {
  Inflate,
};
