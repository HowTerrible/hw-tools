// eslint-disable-next-line
import {
  FileFilters,
  FileFilterType,
  FileUploadStatus,
  PyyUploaderConfig,
  UploaderErrorMap,
  UploaderParams,
  UploadFileType,
  GetFileExt,
} from "./type/index.js";
import { FileUploader } from "./core.js";

/** 此方法用于解析用户是否自定义 过滤器,没有过滤器就使用上面的配置 */
function getFileFilters(
  filters?: Array<FileFilterType>
): Array<FileFilterType> {
  let result;
  // 没有设置过滤器，就用默认的
  if (!filters || filters.length === 0) {
    result = Object.values(FileFilters);
  } else {
    result = filters;
  }
  return result;
}

export function GenerateFileAccept(
  originFilters?: Array<FileFilterType>
): string {
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
const inputStyle: { [propName: string]: string | number } = {
  top: "0px",
  left: "0px",
  position: "absolute",
  overflow: "hidden",
  "z-index": -1,
  opacity: 0,
};

type FileFilterMethodType = (
  files: Array<UploaderFileType>
) => Array<UploaderFileType>;

type UploaderFileType = {
  fileId?: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  file: File;
  percent?: number;
};

// 文件大小除以下面的数字就是兆
const MegabyteUnit = 1048576;

let PytUploaderMap = new WeakMap();

export type FileUploadedCallbackType = (params: {
  uploader: PyyFileUploader;
  files: Array<UploadFileType>;
}) => void;

/** 文件筛选完成后, 上传之前 参数为通过筛选的文件列表 */
export type BeforeFileAddedCallbackType = (params: {
  uploader: PyyFileUploader;
  file: UploadFileType;
}) => boolean;

/** 文件筛选完成后, 上传之前 参数为通过筛选的文件列表 */
export type FilesAddedCallbackType = (params: {
  uploader: PyyFileUploader;
  files: Array<UploadFileType>;
}) => void;

export type BeforeUploaderDisplayCallbackType = () =>
  | boolean
  | Promise<boolean>;

/**
 * 接口仿照plupload，如果需要请自行添加
 * 文件大小上限200M
 */
export class PyyFileUploader extends FileUploader {
  private fileInput?: HTMLInputElement = undefined;
  private element?: HTMLElement = undefined;
  private disabled: boolean = false;
  // 本实例单次最大上传数量
  private singleLimit: number = Infinity;
  /** 本实例最大上传数量 */
  private totalLimit: number = Infinity;
  /** 数组类型的文件过滤配置 */
  private filterList: Array<string> = [];
  /** 上传用其他参数 */
  private params?: UploaderParams;
  private dropElement?: HTMLElement = undefined;
  /** 手动控制上传 */
  private manual: boolean = false;

  files: Array<UploadFileType> = [];

  private currentUploadCnt: number = 0;
  constructor(element: string | HTMLElement, params: PyyUploaderConfig) {
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
  private collectInstance() {
    PytUploaderMap.set(this.element as HTMLElement, this);
    window["pytUploader"] = PytUploaderMap;
  }
  private bindElement(element: string | HTMLElement) {
    // 暂不提供区分 选择器的逻辑
    if (typeof element === "string") {
      this.element = document.getElementById(element) as HTMLInputElement;
    } else {
      this.element = element;
    }
    const self = this;
    this.element.addEventListener("click", (event) => {
      event.stopPropagation();

      const beforeResult =
        self.onBeforeUploaderDisplayCallback &&
        typeof self.onBeforeUploaderDisplayCallback === "function"
          ? self.onBeforeUploaderDisplayCallback()
          : true;
      if (typeof beforeResult === "boolean") {
        self.clickFileInput();
      } else {
        beforeResult.then(() => {
          self.clickFileInput();
        });
      }
    });
  }
  private createFileInput() {
    const elStyle = getComputedStyle(this.element as HTMLElement);
    const input = document.createElement("input");
    input.id =
      new Date().getTime() + "uploader" + Math.floor(Math.random() * 1000);
    input.type = "file";
    input.tabIndex = -1;
    input.setAttribute(
      "style",
      Object.entries({
        ...inputStyle,
        width: elStyle.width,
        height: elStyle.height,
      })
        .map((item) => `${item[0]}:${item[1]}`)
        .join(";")
    );
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
    (this.element as HTMLElement).append(input);
  }

  private setArrtToFileInput(attrName: string, value: any) {
    this.fileInput ? (this.fileInput[attrName] = value) : null;
  }

  private clickFileInput() {
    (this.fileInput as HTMLInputElement).click();
  }

  private async startUpload() {
    if (this.disabled) return;

    const inputFiles: Array<UploaderFileType> = Array.from(
      (this.fileInput as HTMLInputElement).files || []
    ).map((file) => ({
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
  private filterFile: FileFilterMethodType = (
    files: Array<UploaderFileType>
  ) => {
    const result: Array<UploaderFileType> = [];

    files.forEach((file, index) => {
      if (file) {
        let success = true;

        /** 校验文件类型 */
        if (
          success &&
          this.filterList.indexOf(`.${GetFileExt(file.name.toLowerCase())}`) < 0
        ) {
          this.EmitError(
            UploaderErrorMap.UnsupportFileType,
            `暂不支持上传该类型文件`,
            file
          );
          success = false;
        }
        /** 校验文件大小 */
        if (success && file.size / MegabyteUnit > 200) {
          this.EmitError(
            UploaderErrorMap.FileOversize,
            `文件大小超过200M`,
            file
          );
          success = false;
        }

        /** 校验单次上传文件数量 */
        if (success && this.singleLimit && index >= this.singleLimit) {
          success = false;
          // 单词上传文件数量大于singleLimit
          this.EmitError(
            UploaderErrorMap.UploadOverSingleLimit,
            `单次最多上传${this.singleLimit}个文件，已自动选取前${this.singleLimit}个文件`,
            file
          );
        }

        /** 调用上传前回调 */
        if (
          success &&
          this.onBeforeFileAddCallback &&
          typeof this.onBeforeFileAddCallback === "function"
        ) {
          success = this.onBeforeFileAddCallback({
            uploader: this,
            file: file,
          });
        }

        /** 将筛选通过的文件添加到队列中 */
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
  private beforeFileAdded(files) {
    // 判断文件是否达到最大上传数量
    if (this.totalLimit < this.files.length) {
      const startNum = this.files.length - files.length;
      this.files.splice(startNum, files.length);
      this.EmitError(
        UploaderErrorMap.UploadOverTotalLimit,
        `最多允许上传${this.totalLimit}个文件`,
        files
      );
    }

    this.onFilesAddedCallback
      ? this.onFilesAddedCallback({ uploader: this, files: this.files })
      : null;
  }
  /**
   * ANCHOR 设置进度条
   * @param file
   */
  protected afterUpload() {
    this.setArrtToFileInput("value", null); // 上传完成清空上传组件(如果不清空, 再次上传同文件会没有反应)
  }

  /** ANCHOR 设置筛选配置 */
  public SetFilters(filters?: Array<FileFilterType>) {
    const accept = GenerateFileAccept(filters);
    this.setArrtToFileInput("accept", accept);
    this.filterList = accept.split(",");
  }
  /** ANCHOR 设置上传禁用 */
  public SetDisabled(disabled?: boolean) {
    this.setArrtToFileInput("disabled", disabled);
  }
  /** ANCHOR 设置文件多选
   * true: 表示用户可以选择多个文件 */
  public SetMultiple(isMultiple?: boolean) {
    this.setArrtToFileInput("multiple", isMultiple);
  }
  public SetParams(params: UploaderParams) {
    this.params = params;
  }

  /** 删除文件 */
  public RemoveFile(file) {
    const index = this.files.indexOf(file);
    this.files.splice(index, 1);
  }
  public Splice(start: number, length: number) {
    this.files.slice(start, length);
  }

  /** 手动模式控制开始上传的方法. */
  public StartUpload() {
    this.startUpload();
  }

  /** ANCHOR 文件上传弹窗打开前的回调 */
  private onBeforeUploaderDisplayCallback?: BeforeUploaderDisplayCallbackType =
    null;
  /** 设置文件上传完成的回调 */
  BeforeUploaderDisplay(callback?: BeforeUploaderDisplayCallbackType) {
    this.onBeforeUploaderDisplayCallback = callback;
  }

  private onBeforeFileAddCallback?: BeforeFileAddedCallbackType = undefined;
  public onBeforeFileAdd(callback: BeforeFileAddedCallbackType) {
    this.onBeforeFileAddCallback = callback;
  }

  /** ANCHOR 文件添加到上传队列后的回调 */
  private onFilesAddedCallback?: FilesAddedCallbackType = undefined;
  /** 设置文件添加到上传队列后的回调 */
  public onFilesAdded(callback: FilesAddedCallbackType) {
    this.onFilesAddedCallback = callback;
  }

  /** ANCHOR 全部文件上传完毕的回调 */
  private onAllFileUploadCallback?: FileUploadedCallbackType = undefined;
  /** 设置全部文件上传完毕的回调 */
  public onAllFileUpload(callback?: FileUploadedCallbackType) {
    this.onAllFileUploadCallback = callback;
  }
  // stop() {}
  // destroy() {}
  // refresh() {}

  /** 拖拽暂不支持 */
  private SetDragable(dragable?: boolean) {
    if (dragable) {
      this.addDragListener();
    } else {
      this.removeDragListener();
    }
  }

  private addDragListener() {
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
  private removeDragListener() {}
  private createDropElement() {
    let dropElement = document.createElement("DIV");
    dropElement.className = dropElementClass;
    this.dropElement = dropElement;

    (this.element as HTMLLIElement).appendChild(dropElement);
  }

  /** 监听到dom有拖拽要爆炸 */
  private onDrag(e: DragEvent) {
    console.log(e, e.dataTransfer);
    e.preventDefault();
    if (this.dropElement) {
      this.dropElement.className = this.dropElement.className + " show";
    }
  }
  private onDragEnd(e) {}
  private onDrop(e: DragEvent) {
    e.preventDefault();
    const target = e.target;
  }
}
const dropElementClass = "file-uploader-drop-element";

/** 被拖内容进入上传插件 要改变样式 */
function onDragEnter(e: DragEvent) {
  const target = e.target as HTMLElement;
  target.className = target.className + " enter";
}
/** 被拖内容离开上传插件, 要改变样式 */
function onDragLeave(e: DragEvent) {
  const target = e.target as HTMLElement;
  target.className = target.className.substring(0, 32);
}
