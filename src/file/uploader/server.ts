const path = require("path");
const fs = require("fs");
const express = require("express");
const formidable = require("formidable");

const fileUploaderServer = express();
const port = 3001;

/** 默认地址重定向到首页 */
fileUploaderServer.use(
  express.static(path.join(__dirname, "/"), { index: "/server/index.html" })
);

fileUploaderServer.use(function (req, res, next) {
  res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
  next();
});

fileUploaderServer.get("/", function (req, res) {
  console.log("默认地址");
  res.end();
});

fileUploaderServer.post("/uploader-file", function (req, res, next) {
  try {
    fs.mkdirSync(path.join(__dirname, "./", "temp-files"), (err) => {
      console.log("Directory created successfully!");
    });
  } catch (err) {
    //不需要错误处理
  }
  const form = formidable({
    multiples: false,
    uploadDir: path.join(__dirname, "./", "temp-files"),
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.log("err", err);

      next(err);
      return;
    }
    console.log("files", files);
    console.log("fileName", files.file.originalFilename);
    const oldpath = files.file.filepath;
    const newname = files.file.originalFilename;
    const newpath = path.join(path.dirname(oldpath), newname);
    fs.rename(oldpath, newpath, (err) => {
      if (err) throw err;
      res.end(
        JSON.stringify({
          fileId: "0123456789",
          fileUrl: `/temp-files/${newname}`,
        })
      );
    });
  });
});

fileUploaderServer.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
