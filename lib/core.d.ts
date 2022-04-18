export declare type Circuit = {
    modules: CircuitModules;
    signatures: CircuitSignatures;
    nets: CircuitNets;
};
export declare type CircuitNets = Map<string, {
    in: string[];
    out: string[];
    id: ModuleId;
}>;
export declare type CircuitSignatures = Map<string, {
    inputs: Record<string, number>;
    outputs: Record<string, number>;
}>;
export declare type CircuitModules = Map<ModuleId, ModuleNode>;
export declare type Module<In extends Record<string, number>, Out extends Record<string, number>> = {
    in: MapConnections<In>;
    out: MapConnections<Out>;
};
export declare type State = 0 | 1;
export declare type Connection = RawConnection | State;
export declare type MapConnections<T extends Record<string, number>> = {
    [Pin in keyof T]: T[Pin] extends 1 ? Connection : Tuple<Connection, T[Pin]>;
};
export declare type MapStates<T extends Record<string, number>> = {
    [Pin in keyof T]: T[Pin] extends 1 ? State : Tuple<State, T[Pin]>;
};
export declare type ModuleId = number;
export declare type RawConnection = {
    componentId: ModuleId;
    pin: string;
};
export declare type ModuleNode = {
    id: ModuleId;
    subModules: ModuleNode[];
    name: string;
    pins: {
        in: Record<string, RawConnection[]>;
        out: Record<string, RawConnection[]>;
    };
    simulate?: (inputs: object, outputs: object) => void;
};
export declare type NodeStateConst = {
    type: 'const';
    value: 0 | 1;
};
export declare type NodeStateRef = {
    type: 'ref';
    ref: PinId;
};
export declare type NodeState = NodeStateConst | NodeStateRef;
export declare type PinId = `${string}:${ModuleId | string}`;
export declare type CircuitState = Record<string, NodeState>;
export declare const isRawConnection: (x: any) => x is RawConnection;
export declare const isNodeState: (x: any) => x is NodeState;
export declare const createCircuit: () => {
    circuit: Circuit;
    createPrimitiveModule: <In extends Record<string, number>, Out extends Record<string, number>>(def: Omit<PrimitiveModuleDef<In, Out>, "type">) => () => Module<In, Out>;
    createModule: <In_1 extends Record<string, number>, Out_1 extends Record<string, number>>(def: Omit<CompoundModuleDef<In_1, Out_1>, "type">) => () => Module<In_1, Out_1>;
};
export declare const createPrimitiveModule: <In extends Record<string, number>, Out extends Record<string, number>>(def: Omit<PrimitiveModuleDef<In, Out>, "type">, circuit: Circuit) => () => Module<In, Out>;
export declare const createModule: <In extends Record<string, number>, Out extends Record<string, number>>(def: Omit<CompoundModuleDef<In, Out>, "type">, circuit: Circuit) => () => Module<In, Out>;
declare type BaseModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = {
    name: string;
    inputs: In;
    outputs: Out;
};
export declare type PrimitiveModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = BaseModuleDef<In, Out> & {
    type: 'primitive';
    simulate: ((inputs: MapStates<In>, outputs: MapStates<Out>) => void) | (() => (inputs: MapStates<In>, outputs: MapStates<Out>) => void);
};
export declare type CompoundModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = BaseModuleDef<In, Out> & {
    type: 'compound';
    connect: (inputs: MapConnections<In>, outputs: MapConnections<Out>) => void;
};
export declare type ModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = PrimitiveModuleDef<In, Out> | CompoundModuleDef<In, Out>;
export declare const width: {
    readonly 1: 1;
    readonly 2: 2;
    readonly 3: 3;
    readonly 4: 4;
    readonly 5: 5;
    readonly 6: 6;
    readonly 7: 7;
    readonly 8: 8;
    readonly 9: 9;
    readonly 10: 10;
    readonly 11: 11;
    readonly 12: 12;
    readonly 13: 13;
    readonly 14: 14;
    readonly 15: 15;
    readonly 16: 16;
    readonly 17: 17;
    readonly 18: 18;
    readonly 19: 19;
    readonly 20: 20;
    readonly 21: 21;
    readonly 22: 22;
    readonly 23: 23;
    readonly 24: 24;
    readonly 25: 25;
    readonly 26: 26;
    readonly 27: 27;
    readonly 28: 28;
    readonly 29: 29;
    readonly 30: 30;
    readonly 31: 31;
    readonly 32: 32;
};
export declare const high4: <D extends [T, T, T, T, ...T[]], T>(data: D) => [T, T, T, T];
export declare const low4: <D extends [T, T, T, T, ...T[]], T>(data: D) => [T, T, T, T];
export declare const extend4: <InputPin extends string, OutputPin extends string, Comp extends Module<{ [K in InputPin]: 1; }, { [K_1 in OutputPin]: 1; }>>(baseComp: () => Comp, inputPins: InputPin[], outputPin: OutputPin, name: string, circuit: Circuit) => () => Module<Record<InputPin, 4>, { [K_2 in OutputPin]: 4; }>;
export declare const extend8: <InputPin extends string, OutputPin extends string, Comp extends Module<{ [K in InputPin]: 4; }, { [K_1 in OutputPin]: 4; }>>(baseComp: () => Comp, inputPins: InputPin[], outputPin: OutputPin, name: string, circuit: Circuit) => () => Module<Record<InputPin, 8>, { [K_2 in OutputPin]: 8; }>;
export declare const gen: <T>(count: number, factory: (n: number) => T) => T[];
export declare const rep4: <T extends Connection>(c: T) => [T, T, T, T];
export declare const rep8: <T extends Connection>(c: T) => [T, T, T, T, T, T, T, T];
export declare type Tuple<T, Len extends number> = Len extends 0 ? [] : Len extends 1 ? [T] : Len extends 2 ? [T, T] : Len extends 3 ? [T, T, T] : Len extends 4 ? [T, T, T, T] : Len extends 5 ? [T, T, T, T, T] : Len extends 6 ? [...Tuple<T, 5>, T] : Len extends 7 ? [...Tuple<T, 6>, T] : Len extends 8 ? [...Tuple<T, 7>, T] : Len extends 9 ? [...Tuple<T, 8>, T] : Len extends 10 ? [...Tuple<T, 9>, T] : Len extends 11 ? [...Tuple<T, 10>, T] : Len extends 12 ? [...Tuple<T, 11>, T] : Len extends 13 ? [...Tuple<T, 12>, T] : Len extends 14 ? [...Tuple<T, 13>, T] : Len extends 15 ? [...Tuple<T, 14>, T] : Len extends 16 ? [...Tuple<T, 15>, T] : Len extends 17 ? [...Tuple<T, 16>, T] : Len extends 18 ? [...Tuple<T, 17>, T] : Len extends 19 ? [...Tuple<T, 18>, T] : Len extends 20 ? [...Tuple<T, 19>, T] : Len extends 21 ? [...Tuple<T, 20>, T] : Len extends 22 ? [...Tuple<T, 21>, T] : Len extends 23 ? [...Tuple<T, 22>, T] : Len extends 24 ? [...Tuple<T, 23>, T] : Len extends 25 ? [...Tuple<T, 24>, T] : Len extends 26 ? [...Tuple<T, 25>, T] : Len extends 27 ? [...Tuple<T, 26>, T] : Len extends 28 ? [...Tuple<T, 27>, T] : Len extends 29 ? [...Tuple<T, 28>, T] : Len extends 30 ? [...Tuple<T, 29>, T] : Len extends 31 ? [...Tuple<T, 30>, T] : Len extends 32 ? [...Tuple<T, 31>, T] : T[];
export declare const bin: <W extends number>(n: number, width: W) => Tuple<State, W>;
export {};
