import { Circuit, Connection, CoreUtils, isRawConnection, Num, State, Subtract, Successor } from "./core";

export const Iter = {
  join: function* <T>(a: Iterable<T>, b: Iterable<T>): IterableIterator<T> {
    for (const x of a) {
      yield x;
    }

    for (const x of b) {
      yield x;
    }
  },
  all: <T>(as: Iterable<T>, pred: (v: T) => boolean): boolean => {
    for (const a of as) {
      if (!pred(a)) {
        return false;
      }
    }

    return true;
  },
  some: <T>(as: Iterable<T>, pred: (v: T) => boolean): boolean => {
    for (const a of as) {
      if (pred(a)) {
        return true;
      }
    }

    return false;
  },
  find: <T>(as: Iterable<T>, pred: (v: T) => boolean): T | undefined => {
    for (const a of as) {
      if (pred(a)) {
        return a;
      }
    }
  },
  map: function* map<T, U>(as: Iterable<T>, f: (x: T) => U): IterableIterator<U> {
    for (const a of as) {
      yield f(a);
    }
  },
  filter: function* filter<T>(as: Iterable<T>, pred: (x: T) => boolean): IterableIterator<T> {
    for (const a of as) {
      if (pred(a)) {
        yield a;
      }
    }
  },
  max: (as: Iterable<number>): number => {
    let currentMax = -Infinity;

    for (const a of as) {
      if (a > currentMax) {
        currentMax = a;
      }
    }

    return currentMax;
  },
};

export const joinWithEndingSep = (strs: string[], sep: string): string => {
  return strs.join(sep) + (strs.length > 0 ? sep : '');
};

export const swapRemove = <T>(values: T[], index: number): void => {
  [values[index], values[values.length - 1]] = [values[values.length - 1], values[index]];
  values.pop();
};

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

export const mapObject = <K extends string, V, T>(obj: Record<K, V>, f: (v: V, k: K) => T) => {
  return Object.fromEntries(
    (Object.entries<V>(obj) as [K, V][]).map(([k, v]) => [k, f(v, k)])
  ) as Record<K, T>;
};

export const shallowEqualObject = <V>(a: Record<string, V>, b: Record<string, V>): boolean => {
  const keysa = Object.keys(a);
  const keysb = Object.keys(b);

  return keysa.length === keysb.length && keysa.every(k => a[k] === b[k]);
};

type Assert = (condition: unknown, message?: string) => asserts condition;

export const assert: Assert = (condition, msg) => {
  if (!condition) {
    throw new Error(`Assertion error: ${msg}`);
  }
};

export const Tuple = {
  map: <N extends number, T, U>(values: Tuple<T, N>, f: (v: T, index: number) => U): Tuple<U, N> => {
    return values.map(f) as Tuple<U, N>;
  },
  gen: <N extends number, T>(count: N, factory: (n: number) => T): Tuple<T, N> => {
    const result = Array<T>();
    for (let i = 0; i < count; i++) {
      result[i] = factory(i);
    }

    return result as Tuple<T, N>;
  },
  repeat: <T, N extends number>(count: N, c: T): Tuple<T, N> => {
    return Tuple.gen(count, () => c);
  },
  low: <T, N extends number>(count: N, values: Tuple<T, Num>): Tuple<T, N> => {
    return Tuple.gen(count, i => values[values.length - count - i]);
  },
  high: <T, N extends number>(count: N, values: Tuple<T, Num>): Tuple<T, N> => {
    return Tuple.gen(count, i => values[i]);
  },
  slice: <T, A extends number, B extends number>(start: A, end: B, tuple: Tuple<T, Num>): Tuple<T, Subtract<B, A>> => {
    return tuple.slice(start, end) as any;
  },
  bin: <W extends number>(n: number | bigint, width: W): Tuple<State, W> => {
    return n
      .toString(2)
      .slice(0, width)
      .padStart(width, '0')
      .split('')
      .map(x => x === '1' ? 1 : 0) as Tuple<State, W>;
  },
  proxify: <N extends Num>(circuit: Circuit, connections: Tuple<Connection, N>): Tuple<Connection, N> => {
    return new Proxy(connections, {
      set(_, index, value) {
        const connection = CoreUtils.rawFrom(value);
        const target = connections[Number(index)];
        const dir = CoreUtils.pinDirection(circuit, connection.modId, connection.pin);

        console.log('set', { index, target, dir, connection });

        if (isRawConnection(target)) {
          CoreUtils.connect(circuit, target.modId, dir, target.pin, connection);
        } else {
          throw new Error(`A constant state connection is not assignable`);
        }

        return true;
      },
    });
  },
};

export type Range<A extends number, B extends number, Acc = never> = A extends B ? Acc : Range<Successor<A>, B, A | Acc>;

export const Range = {
  iter: <A extends Num, B extends Num>(from: A, to: B, f: (n: Range<A, B>) => void): void => {
    for (let i = from; i < to; i++) {
      f(i as Range<A, B>);
    }
  },
  map: <A extends Num, B extends Num, T>(from: A, to: B, f: (n: Range<A, B>) => T): Tuple<T, Subtract<B, A>> => {
    const values: T[] = [];

    Range.iter(from, to, i => {
      values.push(f(i));
    });

    return values as any;
  },
};

export type Tuple<T, Len extends number> =
  Len extends 0 ? [] :
  Len extends 1 ? [T] :
  Len extends 2 ? [T, T] :
  Len extends 3 ? [T, T, T] :
  Len extends 4 ? [T, T, T, T] :
  Len extends 5 ? [T, T, T, T, T] :
  Len extends 6 ? [...Tuple<T, 5>, T] :
  Len extends 7 ? [...Tuple<T, 6>, T] :
  Len extends 8 ? [...Tuple<T, 7>, T] :
  Len extends 9 ? [...Tuple<T, 8>, T] :
  Len extends 10 ? [...Tuple<T, 9>, T] :
  Len extends 11 ? [...Tuple<T, 10>, T] :
  Len extends 12 ? [...Tuple<T, 11>, T] :
  Len extends 13 ? [...Tuple<T, 12>, T] :
  Len extends 14 ? [...Tuple<T, 13>, T] :
  Len extends 15 ? [...Tuple<T, 14>, T] :
  Len extends 16 ? [...Tuple<T, 15>, T] :
  Len extends 17 ? [...Tuple<T, 16>, T] :
  Len extends 18 ? [...Tuple<T, 17>, T] :
  Len extends 19 ? [...Tuple<T, 18>, T] :
  Len extends 20 ? [...Tuple<T, 19>, T] :
  Len extends 21 ? [...Tuple<T, 20>, T] :
  Len extends 22 ? [...Tuple<T, 21>, T] :
  Len extends 23 ? [...Tuple<T, 22>, T] :
  Len extends 24 ? [...Tuple<T, 23>, T] :
  Len extends 25 ? [...Tuple<T, 24>, T] :
  Len extends 26 ? [...Tuple<T, 25>, T] :
  Len extends 27 ? [...Tuple<T, 26>, T] :
  Len extends 28 ? [...Tuple<T, 27>, T] :
  Len extends 29 ? [...Tuple<T, 28>, T] :
  Len extends 30 ? [...Tuple<T, 29>, T] :
  Len extends 31 ? [...Tuple<T, 30>, T] :
  Len extends 32 ? [...Tuple<T, 31>, T] :
  Len extends 33 ? [...Tuple<T, 32>, T] :
  Len extends 34 ? [...Tuple<T, 33>, T] :
  Len extends 35 ? [...Tuple<T, 34>, T] :
  Len extends 36 ? [...Tuple<T, 35>, T] :
  Len extends 37 ? [...Tuple<T, 36>, T] :
  Len extends 38 ? [...Tuple<T, 37>, T] :
  Len extends 39 ? [...Tuple<T, 38>, T] :
  Len extends 40 ? [...Tuple<T, 39>, T] :
  Len extends 41 ? [...Tuple<T, 40>, T] :
  Len extends 42 ? [...Tuple<T, 41>, T] :
  Len extends 43 ? [...Tuple<T, 42>, T] :
  Len extends 44 ? [...Tuple<T, 43>, T] :
  Len extends 45 ? [...Tuple<T, 44>, T] :
  Len extends 46 ? [...Tuple<T, 45>, T] :
  Len extends 47 ? [...Tuple<T, 46>, T] :
  Len extends 48 ? [...Tuple<T, 47>, T] :
  Len extends 49 ? [...Tuple<T, 48>, T] :
  Len extends 50 ? [...Tuple<T, 49>, T] :
  Len extends 51 ? [...Tuple<T, 50>, T] :
  Len extends 52 ? [...Tuple<T, 51>, T] :
  Len extends 53 ? [...Tuple<T, 52>, T] :
  Len extends 54 ? [...Tuple<T, 53>, T] :
  Len extends 55 ? [...Tuple<T, 54>, T] :
  Len extends 56 ? [...Tuple<T, 55>, T] :
  Len extends 57 ? [...Tuple<T, 56>, T] :
  Len extends 58 ? [...Tuple<T, 57>, T] :
  Len extends 59 ? [...Tuple<T, 58>, T] :
  Len extends 60 ? [...Tuple<T, 59>, T] :
  Len extends 61 ? [...Tuple<T, 60>, T] :
  Len extends 62 ? [...Tuple<T, 61>, T] :
  Len extends 63 ? [...Tuple<T, 62>, T] :
  Len extends 64 ? [...Tuple<T, 63>, T] :
  T[];