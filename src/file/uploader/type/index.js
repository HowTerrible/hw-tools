/** 文件上传组件中的文件状态 */
export const FileUploadStatus = {
    /** 队列中 */
    QUEUED: 1,
    STARTED: 2,
    /** 上传中 */
    UPLOADING: 2,
    FAILED: 4,
    DONE: 5,
};
/** 使用laseIndexOf从文件名中拆分出扩展名 */
export const GetFileExt = (fileName) => {
    return fileName.substr(fileName.lastIndexOf(".") + 1);
};
/**
 * 文件上传过滤器
 * 用上传文件的mime校验
 * 如需增加更多的格式，需要和后端沟通
 */
export const FileFilters = {
    image: {
        title: "Image files",
        extensions: "png,jpg,jpeg,bmp",
        // extensions: "png,jpg,jpeg,bmp,gif,webp,psd,svg,tiff"
    },
    video: {
        title: "Vedio files",
        extensions: "mp4,rmvb,avi,mkv,flv,swf,m3u8",
        // extensions: "mp4,m3u8,rmvb,avi,swf,3gp,mkv,flv"
    },
    audio: {
        title: "Audio files",
        extensions: "mp3,wav,wma,ogg",
        // extensions: "mp3,wav,wma,ogg,aac,flac"
    },
    excel: {
        title: "xls files",
        extensions: "xls,xlsx",
    },
    ppt: {
        title: "ppt files",
        extensions: "ppt,pptx",
    },
    pdf: {
        title: "pdf files",
        extensions: "pdf",
    },
    doc: {
        title: "doc files",
        extensions: "doc,docx",
    },
    zip: {
        title: "zip files",
        // extensions: "zip,rar,jar,tar,gzip"
        extensions: "zip,rar,7z",
    },
    text: {
        title: "text files",
        extensions: "txt,csv",
    },
};
export const UploaderErrorMap = {
    /** 未设置上传回调 */
    NoUploadCallback: "NoUploadCallback",
    /** 上传失败 */
    UploadError: "UploadError",
    /** 不支持的文件类型 */
    UnsupportFileType: "UnsupportFileType",
    /** 文件超过大小 */
    FileOversize: "FileOversize",
    /** 上传文件数量超过单词上传限制 */
    UploadOverSingleLimit: "UploadOverSingleLimit",
    /** 上传文件超过设置的上传总数限制 */
    UploadOverTotalLimit: "uploadOverTotalLimit",
};
//# sourceMappingURL=index.js.map