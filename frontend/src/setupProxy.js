const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const proxy = createProxyMiddleware({
    target: "http://127.0.0.1:8001",
    changeOrigin: true,
    ws: true,
    logLevel: "warn",
    pathRewrite: (path) => "/api" + path,
  });
  app.use("/api", proxy);
};
