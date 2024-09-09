const path = require("path");
module.exports = {
  entry: "./src/request-rate-limiter.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "request-rate-limiter.js",
    library: "RequestRateLimiter",
    libraryTarget: "umd",
    umdNamedDefine: true,
    globalObject: 'this'
  }
};
