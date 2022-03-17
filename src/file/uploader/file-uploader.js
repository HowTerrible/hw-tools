// eslint-disable-next-line
import { FileFilters, FileUploadStatus, UploaderErrorMap, GetFileExt, } from "./type/index.js";
import { FileUploader } from "./core.js";
/** 此方法用于解析用户是否自定义 过滤器,没有过滤器就使用上面的配置 */
function getFileFilters(filters) {
    let result;
    // 没有设置过滤器，就用默认的
    if (!filters || filters.length === 0) {
        result = Object.values(FileFilters);
    }
    else {
        result = filters;
    }
    return result;
}
export function GenerateFileAccept(originFilters) {
    const filters = getFileFilters(originFilters);
    const accept = filters.reduce((prev, cur) => {
        const curExt = cur.extensions
            .split(",")
            .map((item) => `.${item}`)
            .join(",");
        return prev ? `${prev},${curExt}` : `${curExt}`;
    }, "");
    return accept;
}
/** input的样式 */
const inputStyle = {
    top: "0px",
    left: "0px",
    position: "absolute",
    overflow: "hidden",
    "z-index": -1,
    opacity: 0,
};
// 文件大小除以下面的数字就是兆
const MegabyteUnit = 1048576;
let PytUploaderMap = new WeakMap();
/**
 * 接口仿照plupload，如果需要请自行添加
 * 文件大小上限200M
 */
export class PyyFileUploader extends FileUploader {
    fileInput = undefined;
    element = undefined;
    disabled = false;
    // 本实例单次最大上传数量
    singleLimit = Infinity;
    /** 本实例最大上传数量 */
    totalLimit = Infinity;
    /** 数组类型的文件过滤配置 */
    filterList = [];
    /** 上传用其他参数 */
    params;
    dropElement = undefined;
    /** 手动控制上传 */
    manual = false;
    files = [];
    currentUploadCnt = 0;
    constructor(element, params) {
        super({ uploadFunc: params.uploadFunc });
        this.bindElement(element);
        this.createFileInput();
        this.singleLimit = params.singleLimit || Infinity;
        this.totalLimit = params.totalLimit || Infinity;
        this.SetDisabled(params.disabled);
        this.SetMultiple(params.multi);
        this.SetFilters(params.filters);
        this.SetDragable(params.draggable);
        this.params = params.params;
        this.manual = params.manual || false;
        // this.collectInstance();
    }
    collectInstance() {
        PytUploaderMap.set(this.element, this);
        window["pytUploader"] = PytUploaderMap;
    }
    bindElement(element) {
        // 暂不提供区分 选择器的逻辑
        if (typeof element === "string") {
            this.element = document.getElementById(element);
        }
        else {
            this.element = element;
        }
        const self = this;
        this.element.addEventListener("click", (event) => {
            event.stopPropagation();
            const beforeResult = self.onBeforeUploaderDisplayCallback &&
                typeof self.onBeforeUploaderDisplayCallback === "function"
                ? self.onBeforeUploaderDisplayCallback()
                : true;
            if (typeof beforeResult === "boolean") {
                self.clickFileInput();
            }
            else {
                beforeResult.then(() => {
                    self.clickFileInput();
                });
            }
        });
    }
    createFileInput() {
        const elStyle = getComputedStyle(this.element);
        const input = document.createElement("input");
        input.id =
            new Date().getTime() + "uploader" + Math.floor(Math.random() * 1000);
        input.type = "file";
        input.tabIndex = -1;
        input.setAttribute("style", Object.entries({
            ...inputStyle,
            width: elStyle.width,
            height: elStyle.height,
        })
            .map((item) => `${item[0]}:${item[1]}`)
            .join(";"));
        input.addEventListener("change", () => {
            if (!this.manual) {
                this.startUpload();
            }
        });
        input.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        input.title = "";
        this.fileInput = input;
        this.element.append(input);
    }
    setArrtToFileInput(attrName, value) {
        this.fileInput ? (this.fileInput[attrName] = value) : null;
    }
    clickFileInput() {
        this.fileInput.click();
    }
    async startUpload() {
        if (this.disabled)
            return;
        const inputFiles = Array.from(this.fileInput.files || []).map((file) => ({
            lastModified: file.lastModified,
            name: file.name,
            type: file.type,
            size: file.size,
            file: file,
        }));
        let filtedFiles = this.filterFile(inputFiles);
        this.files = this.files.concat(filtedFiles);
        this.files.forEach((file) => {
            file.id = "pyt-upload-" + new Date().getTime() + Math.random() * 1000;
        });
        this.beforeFileAdded(filtedFiles);
        for (let i = 0; i < filtedFiles.length; i++) {
            const file = filtedFiles[i];
            console.log("start upload");
            await this.doUpload(file, this.params);
            console.log("upload complete");
        }
        console.log("all complete");
        if (this.files.length) {
            // 100毫秒为了等待upload中的计时器
            setTimeout(() => {
                this.onAllFileUploadCallback
                    ? this.onAllFileUploadCallback({ uploader: this, files: this.files })
                    : null;
            }, 120);
        }
    }
    /**
     * ANCHOR 过滤文件
     * @param files 新添加的文件
     * @returns 过滤后的文件
     */
    filterFile = (files) => {
        const result = [];
        files.forEach((file) => {
            if (file) {
                let success = true;
                // 判断文件是否符合过滤条件的配置
                if (success &&
                    this.filterList.indexOf(`.${GetFileExt(file.name.toLowerCase())}`) < 0) {
                    this.EmitError(UploaderErrorMap.UnsupportFileType, `暂不支持上传该类型文件`, file);
                    success = false;
                }
                // 判断文件是否符合过滤条件的配置
                if (success && file.size / MegabyteUnit > 200) {
                    this.EmitError(UploaderErrorMap.FileOversize, `文件大小超过200M`, file);
                    success = false;
                }
                if (success && this.singleLimit && result.length >= this.singleLimit) {
                    success = false;
                    // 单词上传文件数量大于singleLimit
                    this.EmitError(UploaderErrorMap.UploadOverSingleLimit, `单次最多上传${this.singleLimit}个文件，已自动选取前${this.singleLimit}个文件`, file);
                }
                if (success &&
                    this.onBeforeFileAddCallback &&
                    typeof this.onBeforeFileAddCallback === "function") {
                    success = this.onBeforeFileAddCallback({
                        uploader: this,
                        file: file,
                    });
                }
                if (success) {
                    this.setFileStatus(file, FileUploadStatus.QUEUED);
                    result.push(file);
                }
            }
        });
        return result;
    };
    /**
     * ANCHOR Before 上传
     * @param files 此次添加的文件
     * @returns 能否继续进行上传
     */
    beforeFileAdded(files) {
        // 判断文件是否达到最大上传数量
        if (this.totalLimit < this.files.length) {
            const startNum = this.files.length - files.length;
            this.files.splice(startNum, files.length);
            this.EmitError(UploaderErrorMap.UploadOverTotalLimit, `最多允许上传${this.totalLimit}个文件`, files);
        }
        this.onFilesAddedCallback
            ? this.onFilesAddedCallback({ uploader: this, files: this.files })
            : null;
    }
    /**
     * ANCHOR 设置进度条
     * @param file
     */
    afterUpload() {
        this.setArrtToFileInput("value", null); // 上传完成清空上传组件(如果不清空, 再次上传同文件会没有反应)
    }
    /** ANCHOR 设置筛选配置 */
    SetFilters(filters) {
        const accept = GenerateFileAccept(filters);
        this.setArrtToFileInput("accept", accept);
        this.filterList = accept.split(",");
    }
    /** ANCHOR 设置上传禁用 */
    SetDisabled(disabled) {
        this.setArrtToFileInput("disabled", disabled);
    }
    /** ANCHOR 设置文件多选
     * true: 表示用户可以选择多个文件 */
    SetMultiple(isMultiple) {
        this.setArrtToFileInput("multiple", isMultiple);
    }
    SetParams(params) {
        this.params = params;
    }
    /** 删除文件 */
    RemoveFile(file) {
        const index = this.files.indexOf(file);
        this.files.splice(index, 1);
    }
    Splice(start, length) {
        this.files.slice(start, length);
    }
    /** 手动模式控制开始上传的方法. */
    StartUpload() {
        this.startUpload();
    }
    /** ANCHOR 文件上传弹窗打开前的回调 */
    onBeforeUploaderDisplayCallback = null;
    /** 设置文件上传完成的回调 */
    BeforeUploaderDisplay(callback) {
        this.onBeforeUploaderDisplayCallback = callback;
    }
    onBeforeFileAddCallback = undefined;
    onBeforeFileAdd(callback) {
        this.onBeforeFileAddCallback = callback;
    }
    /** ANCHOR 文件添加到上传队列后的回调 */
    onFilesAddedCallback = undefined;
    /** 设置文件添加到上传队列后的回调 */
    onFilesAdded(callback) {
        this.onFilesAddedCallback = callback;
    }
    /** ANCHOR 全部文件上传完毕的回调 */
    onAllFileUploadCallback = undefined;
    /** 设置全部文件上传完毕的回调 */
    onAllFileUpload(callback) {
        this.onAllFileUploadCallback = callback;
    }
    // stop() {}
    // destroy() {}
    // refresh() {}
    /** 拖拽暂不支持 */
    SetDragable(dragable) {
        if (dragable) {
            this.addDragListener();
        }
        else {
            this.removeDragListener();
        }
    }
    addDragListener() {
        console.log("add eventlistener");
        if (!this.dropElement) {
            this.createDropElement();
        }
        document.addEventListener("drag", (e) => {
            this.onDrag(e);
        });
        document.addEventListener("dragend", (e) => {
            this.onDragEnd(e);
        });
        if (this.dropElement) {
            this.dropElement.addEventListener("dragenter", (e) => {
                onDragEnter(e);
            });
            this.dropElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });
            this.dropElement.addEventListener("dragleave", (e) => {
                onDragLeave(e);
            });
            this.dropElement.addEventListener("drop", (e) => {
                this.onDrop(e);
            });
        }
    }
    removeDragListener() { }
    createDropElement() {
        let dropElement = document.createElement("DIV");
        dropElement.className = dropElementClass;
        this.dropElement = dropElement;
        this.element.appendChild(dropElement);
    }
    /** 监听到dom有拖拽要爆炸 */
    onDrag(e) {
        console.log(e, e.dataTransfer);
        e.preventDefault();
        if (this.dropElement) {
            this.dropElement.className = this.dropElement.className + " show";
        }
    }
    onDragEnd(e) { }
    onDrop(e) {
        e.preventDefault();
        const target = e.target;
    }
}
const dropElementClass = "file-uploader-drop-element";
/** 被拖内容进入上传插件 要改变样式 */
function onDragEnter(e) {
    const target = e.target;
    target.className = target.className + " enter";
}
/** 被拖内容离开上传插件, 要改变样式 */
function onDragLeave(e) {
    const target = e.target;
    target.className = target.className.substring(0, 32);
}
//# sourceMappingURL=file-uploader.js.map