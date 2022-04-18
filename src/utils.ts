
export function* join<T>(a: Iterable<T>, b: Iterable<T>): IterableIterator<T> {
  for (const x of a) {
    yield x;
  }

  for (const x of b) {
    yield x;
  }
}

export const joinWithEndingSep = (strs: string[], sep: string): string => {
  return strs.join(sep) + (strs.length > 0 ? sep : '');
};

export const swapRemove = <T>(values: T[], index: number): void => {
  [values[index], values[values.length - 1]] = [values[values.length - 1], values[index]];
  values.pop();
};

export const all = <T>(as: Iterable<T>, pred: (v: T) => boolean): boolean => {
  for (const a of as) {
    if (!pred(a)) {
      return false;
    }
  }

  return true;
};

export const complementarySet = <T>(set: Set<T>) => {
  return {
    has: (v: T) => !set.has(v),
  };
};