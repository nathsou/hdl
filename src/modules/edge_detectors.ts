import { defineModule, State } from "../core";

export const risingEdgeDetector = defineModule({
  name: 'rising_edge_detector',
  inputs: { d: 1 },
  outputs: { q: 1 },
  state: { last: State.zero },
  simulate({ d }, out, state) {
    out.q = (state.last === 0 && d === 1) ? 1 : 0;
    state.last = d;
  }
});

export const fallingEdgeDetector = defineModule({
  name: 'rising_edge_detector',
  inputs: { d: 1 },
  outputs: { q: 1 },
  state: { last: State.zero },
  simulate({ d }, out, state) {
    out.q = (state.last === 1 && d === 0) ? 1 : 0;
    state.last = d;
  }
});
