// [PROJECT_ROOT]/src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/sartopo", // 호출하는 URL
    createProxyMiddleware({
      target: "https://sartopo.com", // 대상 URL
      changeOrigin: true,
    })
  );
};
