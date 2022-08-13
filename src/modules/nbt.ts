import { dir, file } from "./objects/files.js";

const tagTypes = {
    0: "TAG_End",
    1: "TAG_Byte",
    2: "TAG_Short",
    3: "TAG_Int",
    4: "TAG_Long",
    5: "TAG_Float",
    6: "TAG_Double",
    7: "TAG_Byte_Array",
    8: "TAG_String",
    9: "TAG_List",
    10: "TAG_Compound",
    11: "TAG_Int_Array",
    12: "TAG_Long_Array"
}

export async function readNBT(path: file, typed?: boolean): Promise<any> {
    const p = dir.tmpdir().getDir("gmll", path.getHash()).mkdir();
    //We need to uncompress the dat file
    await path.unzip(p);

    const file = p.ls()[0] as file;
    //We'll be working with a buffer here 
    let raw = file.readRaw();
    //Skips the initial compound tag header
    let i = 3
    //Parse a section of the raw buffer
    function parse(size: number) {
        let buf = raw.slice(i, Math.min(i + size, raw.length))
        i += size;
        return buf;
    }
    function getName() {
        i += 1;
        const l = parse(2).readUInt16BE();
        return parse(l).toString();
    }

    function arrType(index: number) {
        const size = parse(4).readUInt32BE();
        let arr = [];
        for (let i3 = 0; i3 < size; i3++) {
            arr.push(decode(index))
        }
        return typed ? { type: tagTypes[index], list: arr } : arr;
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
            case 8: const ps = parse(2).readUInt16BE(); return parse(ps).toString();   //string
            case 9: const index = parse(1).readInt8(); return arrType(index); //list
            case 11: return arrType(3); //int array
            case 12: return arrType(4); //long int array
            case 10: {
                //Compount tag flag
                let code = Number(c);
                let t = {};
                try {
                    do {
                        code = raw[i];
                        if (code == 0) { i++; break; };
                        t[getName()] = typed ? { tag: tagTypes[code], value: decode(code) } : decode(code);
                    } while (true);
                } catch (e) {
                    //@ts-ignore
                    console.log(JSON.stringify(t, "\n", "\t"))
                    throw e
                }
                return t;
            }
            default: {
                //Unknown flag. Due to how dat files are encoded. The decoder cannot continue if it hits an unknown flag
                console.error("Unknown type", [String.fromCharCode(c), c], " at ", i, raw[i])
                console.error([raw.slice(3, i + 10).toString()])
                throw "UNKNOWN TYPE"
            }
        }
    }
    let c = raw[i];
    p.rm();
    return typed ? { tag: tagTypes[c], value: decode(c) } : decode(c);
}