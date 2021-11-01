 namespace GMLL.manifests {
    export interface version {
        id: string,
        type:version_type ,
        url: string,
        time?: string,
        releaseTime?: string,
        sha1?: string,
        complianceLevel?: 1 | 0,
        //These two fields are for modded version jsons 
        base?: string,
        stable?: boolean,
    }
 
}