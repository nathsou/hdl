export declare function join<T>(a: Iterable<T>, b: Iterable<T>): IterableIterator<T>;
export declare const joinWithEndingSep: (strs: string[], sep: string) => string;
export declare const swapRemove: <T>(values: T[], index: number) => void;
export declare const all: <T>(as: Iterable<T>, pred: (v: T) => boolean) => boolean;
export declare const complementarySet: <T>(set: Set<T>) => {
    has: (v: T) => boolean;
};
