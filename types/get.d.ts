
namespace GMLL.get {
    export interface downloadable {
        path: string,
        url: string,
        name: string,
        unzip: {
            exclude: string[],
            path: string,
            name?: string
        }
        size?: Number,
        sha1?: String,
        executable?: boolean,
        /**Internally used to identify object */
        key: string
    }
}