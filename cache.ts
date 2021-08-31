import NodeCache from "node-cache";

export class MemCache {
    private static _instance: NodeCache;

    private constructor()
    {
        //...
    }

    public static Instance()
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new NodeCache({stdTTL: 0,checkperiod:0}));
    }
}