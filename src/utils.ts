
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

export const some = <T>(as: Iterable<T>, pred: (v: T) => boolean): boolean => {
  for (const a of as) {
    if (pred(a)) {
      return true;
    }
  }

  return false;
};

export const find = <T>(as: Iterable<T>, pred: (v: T) => boolean): T | undefined => {
  for (const a of as) {
    if (pred(a)) {
      return a;
    }
  }
};

export function* map<T, U>(as: Iterable<T>, f: (x: T) => U): IterableIterator<U> {
  for (const a of as) {
    yield f(a);
  }
}

export function* filter<T>(as: Iterable<T>, pred: (x: T) => boolean): IterableIterator<T> {
  for (const a of as) {
    if (pred(a)) {
      yield a;
    }
  }
}

export const complementarySet = <T>(set: Set<T>) => {
  return {
    has: (v: T) => !set.has(v),
  };
};

export const last = <T>(values: T[]): T => values[values.length - 1];

export const uniq = <T>(values: T[]): T[] => [...new Set(values)];

export const pushUnique = <T>(values: T[], value: T): void => {
  if (!values.includes(value)) {
    values.push(value);
  }
};

export const compact = <T>(values: (T | null | undefined)[]): T[] => {
  return values.filter(v => v != null) as T[];
};
