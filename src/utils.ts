import { Connection, Module, State, Tuple } from "./core";

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

export const pushRecord = <T extends Record<K, V[]>, K extends string, V>(record: T, key: K, value: V) => {
  if (record[key] === undefined) {
    record[key] = [value] as T[K];
  } else {
    record[key].push(value);
  }
};

export const gen = <N extends number, T>(count: N, factory: (n: number) => T): Tuple<T, N> => {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(factory(i));
  }

  return result as Tuple<T, N>;
};

export const mapTuple = <N extends number, T, U>(values: Tuple<T, N>, f: (v: T) => U): Tuple<U, N> => {
  return values.map(f) as Tuple<U, N>;
};

export const genConnections = <N extends number, T>(count: N, factory: (n: number) => T): N extends 1 ? T : Tuple<T, N> => {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(factory(i));
  }

  if (count === 1) {
    return result[0] as N extends 1 ? T : Tuple<T, N>;
  }

  return result as N extends 1 ? T : Tuple<T, N>;
};

export const rep4 = <T extends Connection>(c: T): Tuple<T, 4> => {
  return [c, c, c, c];
};

export const rep8 = <T extends Connection>(c: T): Tuple<T, 8> => {
  return [c, c, c, c, c, c, c, c];
};

export const high4 = <D extends [...Tuple<T, 4>, ...T[]], T>(data: D): Tuple<T, 4> => {
  return [data[0], data[1], data[2], data[3]];
};

export const low4 = <D extends [...Tuple<T, 4>, ...T[]], T>(data: D): Tuple<T, 4> => {
  const len = data.length;
  return [data[len - 4], data[len - 3], data[len - 2], data[len - 1]];
};

export const bin = <W extends number>(n: number, width: W): Tuple<State, W> => {
  return n
    .toString(2)
    .slice(0, width)
    .padStart(width, '0')
    .split('')
    .map(x => x === '1' ? 1 : 0) as Tuple<State, W>;
};

export const forwardInputs = <
  Pins extends keyof Mapping,
  Mapping extends Record<Pins, Connection>,
  In extends Record<Pins, 1>
>(
  mapping: Mapping,
  modules: Module<In, any>[]
): void => {
  const entries = Object.entries(mapping);

  for (const mod of modules) {
    for (const [pin, connection] of entries) {
      /// @ts-ignore
      mod.in[pin] = connection;
    }
  }
};