export function* join(a, b) {
    for (const x of a) {
        yield x;
    }
    for (const x of b) {
        yield x;
    }
}
export const joinWithEndingSep = (strs, sep) => {
    return strs.join(sep) + (strs.length > 0 ? sep : '');
};
export const swapRemove = (values, index) => {
    [values[index], values[values.length - 1]] = [values[values.length - 1], values[index]];
    values.pop();
};
export const all = (as, pred) => {
    for (const a of as) {
        if (!pred(a)) {
            return false;
        }
    }
    return true;
};
export const complementarySet = (set) => {
    return {
        has: (v) => !set.has(v),
    };
};
