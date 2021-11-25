    ram?: Number,
    /**Custom data your launcher can use */
    meta?: any
}

function combine(ob1, ob2) {
    Object.keys(ob2).forEach(e => {
        if (!ob1[e]) {
            ob1[e] = ob2[e]
        }
        else if (typeof ob1[e] == typeof ob2[e]) {
            if (ob1[e] instanceof Array) {
                ob1[e] = [...ob2[e], ...ob1[e]]
            }
            else if (typeof ob1[e] == "string") {
                ob1[e] = ob2[e];
            }
            else if (ob1[e] instanceof Object) {
                ob1[e] = combine(ob1[e], ob2[e]);
            }
        } else {
            ob1[e] = ob2[e];
        }
