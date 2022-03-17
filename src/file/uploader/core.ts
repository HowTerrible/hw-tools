import {
  FileUploadApiCallType,
  FileUploadStatus,
  FileUploadStatusType,
  UploaderErrorEnumType,
  UploaderErrorMap,
  UploaderParams,
  UploadFileType,
} from "./type/index.js";

/** 文件上传百分比变化时的回调 */
export type FilePercentChangedCallbackType = (params: {
  file: UploadFileType;
  percent: number;
}) => void;

/** 文件状态改变时的回调 */
export type FileStatusChangedCallbackType = (params: {
  file: UploadFileType;
  status: FileUploadStatusType;
}) => void;

/** 文件上传完成时的回调 */
export type FileUploadedCallbackType = (params: {
  uploader: FileUploader;
  file: UploadFileType;
  res: any;
}) => void;

/** 文件上传出错时的回调 */
export type FileUploadErrorCallbackType = (params: {
  errorType: UploaderErrorEnumType;
  errorMessage: string;
  uploader: FileUploader;
  file: UploadFileType | Array<UploadFileType>;
}) => void;

/**
 * 文件上传核心代码
 * 使用封装后的文件类型,
 * 上传过程中支持虚拟进度条 file.percent
 * 支持文件状态( 上传中, 上传完成等) file.status
 */
export class FileUploader {
  constructor(params: { uploadFunc: FileUploadApiCallType }) {
    if (params) {
      params.uploadFunc ? this.SetUploadFileCallback(params.uploadFunc) : null;
    }
  }
  /**
   * ANCHOR 调用接口上传文件
   * @param file 文件
   * @param params 和文件一起提交的额外参数, 上传接口目前仅接收
   * dirCode 文件所在目录
   * fileName 文件名称(无后缀)
   */
  public async doUpload(file: UploadFileType, params?: UploaderParams) {
    if (!this.uploadFile) {
      this.EmitError(UploaderErrorMap.NoUploadCallback, "未配置上传回调");
    }

    let formData = new FormData();
    formData.append("file", file.file);
    params
      ? Object.entries(params).forEach((item) => {
          item[1] ? formData.append(item[0], item[1] as any) : null;
        })
      : null;

    this.setFileStatus(file, FileUploadStatus.UPLOADING);
    this.setProgressLoop(file);

    /** 实际上是文件传给后端，后端再上传到阿里云，所以是双倍的时间 */
    let res = await this.uploadFile(formData);
    this.setFilePercent(file, 90);
    clearTimeout(this.currentTimer);

    if (res && res.fileId) {
      // 100毫秒为了等进度条动画
      setTimeout(() => {
        this.setFilePercent(file, 100);
        file.fileId = res.fileId;
        file.url = res.fileUrl;
        this.setFileStatus(file, FileUploadStatus.DONE);

        this.onFileUploadedCallback
          ? this.onFileUploadedCallback({
              uploader: this,
              file: file,
              res: res,
            })
          : null;
      }, 100);
    } else {
      this.setFilePercent(file, 95);
      this.setFileStatus(file, FileUploadStatus.FAILED);
      this.EmitError(
        UploaderErrorMap.UploadError,
        `${file.name}上传失败`,
        file
      );
    }
    this.afterUpload();
    return { file, res };
  }
  /** 由子类重写 */
  protected afterUpload() {}
  private setFilePercent(file, percent) {
    file.percent = percent;

    this.onFilePercentChangedCallback &&
    typeof this.onFilePercentChangedCallback === "function"
      ? this.onFilePercentChangedCallback({ file, percent })
      : null;
  }

  /** 循环模拟进度条的计时器 */
  private currentTimer = -1;
  /**
   * ANCHOR 设置虚拟进度条
   * 如果进度条没到90， 随机增加， 如果进度条到了90， 停止增加
   * @param file
   */
  private setProgressLoop(file: UploadFileType) {
    this.currentTimer = window.setTimeout(() => {
      if (file.percent) {
        // 如果进度百分比存在，就开始进度循环
        if (file.percent < 90) {
          const percent = Math.random() * 5;
          if (file.percent + percent > 90) {
            this.setFilePercent(file, 90);
          } else {
            this.setFilePercent(file, file.percent + percent);
            this.setProgressLoop(file);
          }
        }
      } else {
        // 如果进度百分比不存在，就设个初始值
        this.setFilePercent(file, 0);
        setTimeout(() => {
          this.setFilePercent(file, Math.random() * 10);
          this.setProgressLoop(file);
        }, 50);
      }
    }, 200);
  }
  protected setFileStatus(file, status) {
    file.status = status;
    typeof this.onFileStatueChangedCallback === "function"
      ? this.onFileStatueChangedCallback({ file, status })
      : null;
  }

  /** 通知错误 */
  protected EmitError(
    code: UploaderErrorEnumType,
    msg: string,
    file?: UploadFileType | Array<UploadFileType>
  ) {
    console.log(`Error[${code}]: ${msg}`);
    this.onFileUploadErrorCallback &&
    typeof this.onFileUploadErrorCallback === "function"
      ? this.onFileUploadErrorCallback({
          errorMessage: msg,
          errorType: code,
          uploader: this,
          file: file,
        })
      : null;
  }
  /** ANCHOR 设置上传文件回调 */
  protected uploadFile?: FileUploadApiCallType = undefined;
  SetUploadFileCallback(callback: FileUploadApiCallType) {
    this.uploadFile = callback;
  }

  /** ANCHOR 文件状态变化 回调 */
  protected onFileStatueChangedCallback?: FileStatusChangedCallbackType =
    undefined;
  onFileStatusChanged(callback: FileStatusChangedCallbackType) {
    this.onFileStatueChangedCallback = callback;
  }
  /** ANCHOR 文件上传完成的回调 */
  protected onFileUploadedCallback?: FileUploadedCallbackType | undefined =
    undefined;
  /** 设置文件上传完成的回调 */
  onFileUploaded(callback: FileUploadedCallbackType) {
    this.onFileUploadedCallback = callback;
  }
  /** ANCHOR 文件百分比变化 回调 */
  protected onFilePercentChangedCallback?: FilePercentChangedCallbackType =
    undefined;
  onFilePercentChanged(callback: FilePercentChangedCallbackType) {
    this.onFilePercentChangedCallback = callback;
  }
  /** ANCHOR 文件状态变化 回调 */
  protected onFileUploadErrorCallback?: FileUploadErrorCallbackType = undefined;
  onFileUploadError(callback: FileUploadErrorCallbackType) {
    this.onFileUploadErrorCallback = callback;
  }
}
