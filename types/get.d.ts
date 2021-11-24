
namespace GMLL.get {
    export interface downloadable {

        path: string,
        url: string,
        name: string,
        unzip?: {
            exclude?: string[],
            name?: string
            path: string,
         
        }
        size?: Number,
        sha1?: String,
        executable?: boolean,
        /**Internally used to identify object: 
               * May not be constant */
        key: string
    }
}