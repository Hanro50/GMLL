/**
 * An NBT reader implement in JS. 
 */
import { Dir, File } from "./objects/files.js";
export enum tagTypes {
    "TAG_End" = 0,
    "TAG_Byte" = 1,
    "TAG_Short" = 2,
    "TAG_Int" = 3,
    "TAG_Long" = 4,
    "TAG_Float" = 5,
    "TAG_Double" = 6,
    "TAG_Byte_Array" = 7,
    "TAG_String" = 8,
    "TAG_List" = 9,
    "TAG_Compound" = 10,
    "TAG_Int_Array" = 11,
    "TAG_Long_Array" = 12
}
export type typedNBT = {
    [key: string]:
    { tag: tagTypes.TAG_Compound, value: typedNBT } |
    { tag: tagTypes.TAG_Byte_Array, value: { tag: tagTypes.TAG_Byte, value: number[] } } |
    { tag: tagTypes.TAG_Int_Array, value: { tag: tagTypes.TAG_Int, value: number[] } } |
    { tag: tagTypes.TAG_Long_Array, value: { tag: tagTypes.TAG_Long, value: number[] } } |
    {
        tag: tagTypes.TAG_List, value: { tag: tagTypes.TAG_Compound, value: typedNBT[] } |
        { tag: tagTypes.TAG_Byte_Array, value: { tag: tagTypes.TAG_Byte, value: number[][] } } |
        { tag: tagTypes.TAG_Int_Array, value: { tag: tagTypes.TAG_Int, value: number[][] } } |
        { tag: tagTypes.TAG_Long_Array, value: { tag: tagTypes.TAG_Long, value: number[][] } } |
        //No...I am not enabling any more insanity then this
        { tag: tagTypes.TAG_List, value: { tag: tagTypes, value: string[][] | number[][] | typedNBT[][] } } |
        { tag: tagTypes, value: string[] | number[], }
    } |
    { tag: tagTypes, value: string | number, }
}
/**Takes in NBT data and returns a json object representation of it */
export function readNBT<T>(raw: Buffer): T
/**Takes in NBT data and returns a node based json representation of it */
export function readNBT(raw: Buffer, typed: true): typedNBT
export function readNBT<T>(raw: Buffer, typed?: true): T | typedNBT {
    //Skips the initial compound tag header
    let i = 3
    //Parse a section of the raw buffer
    function parse(size: number) {
        const buf = raw.slice(i, Math.min(i + size, raw.length))
        i += size;
        return buf;
    }
    function getString() { return parse(parse(2).readUInt16BE()).toString(); }

    function arrType(index: number) {
        const size = parse(4).readUInt32BE();
        const arr = [];
        for (let i3 = 0; i3 < size; i3++) {
            arr.push(decode(index))
        }
        return typed ? { tag: tagTypes[index], list: arr } : arr;
    }

    function decode(c: number) {
        switch (c) {
            case 0: return //end-flag
            case 1: return parse(1).readInt8(); //byte 
            case 2: return parse(2).readInt16BE();//short
            case 3: return parse(4).readInt32BE();   //int
            case 4: return Number(parse(8).readBigInt64BE());//long    
            case 5: return parse(4).readFloatBE();  //float   
            case 6: return parse(8).readDoubleBE();//double
            case 7: return arrType(1); //byte array
            case 8: return getString();   //string
            case 9: return arrType(parse(1).readInt8()); //list
            case 11: return arrType(3); //int array
            case 12: return arrType(4); //long int array
            case 10:
                //Compound tag flag
                const t = {};
                while ((c = raw[i++]) != 0) { t[getString()] = typed ? { tag: tagTypes[c], value: decode(c) } : decode(c); }
                return t;
            default:
                //Unknown flag. Due to how dat files are encoded. The decoder cannot continue if it hits an unknown flag
                console.error("Unknown type", [String.fromCharCode(c), c], " at ", i, raw[i])
                console.error([raw.slice(3, i + 10).toString()])
                throw "UNKNOWN TYPE"

        }
    }
    const c = raw[i];
    return (typed ? { tag: tagTypes[c], value: decode(c) } : decode(c)) as T;
}
/**Reads a .DAT file and returns a json object representation of it */
export async function readDat<T>(path: File): Promise<T>
/**Reads a .DAT file and returns a  node based json representation of it */
export async function readDat(path: File, typed: true): Promise<typedNBT>
export async function readDat<T>(path: File, typed?: true): Promise<T | typedNBT> {
    if (!path.sysPath().toLocaleLowerCase().endsWith(".dat")) console.warn("Potentially unsupported file extention detected!")
    const p = Dir.tmpdir().getDir("gmll", path.getHash()).mkdir();
    //We need to decompress the dat file
    await path.unzip(p);
    const file = p.ls()[0] as File;
    //We'll be working with a buffer here 
    const raw = file.readRaw();
    p.rm();
    return readNBT(raw, typed)
}