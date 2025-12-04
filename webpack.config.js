const path = require("path");
module.exports = {
  entry: "./src/request-rate-limiter.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "request-rate-limiter.js",
    library: "RequestRateLimiter",
    libraryTarget: "umd",
    umdNamedDefine: true,
    globalObject: 'this'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  }
};
