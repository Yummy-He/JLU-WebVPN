/**
 * config.example.js - 配置文件模板
 *
 * 使用方式：
 * 1. 复制此文件并命名为 config.js
 * 2. 在 config.js 中填入实际的 API 密钥和 CORS 代理地址
 *    （默认代理 proxy.cors.sh 可直接使用，无需修改）
 * 3. 或通过 GitHub Actions Secrets 在部署时自动生成 config.js
 *
 * GitHub Actions 部署配置：
 *   仓库 Settings → Secrets and variables → Actions → New repository secret
 *   添加两个 secret：
 *     - SHORTENER_API_KEY：你的 urlc.cn API 密钥
 *     - CORS_PROXY_URL：CORS 代理地址（可选，默认使用 proxy.cors.sh）
 */

window.WebVPNConfig = {
  /** 短网址 API 密钥 (urlc.cn) - 替换为你的实际密钥 */
  SHORTENER_API_KEY: '你的urlc.cn_API密钥',

  /**
   * CORS 代理地址（末尾不要加斜杠）
   * 默认使用 proxy.cors.sh 免费公共代理。
   * 如需更高可靠性，可部署自己的代理（proxy/worker.js）并替换此地址。
   */
  CORS_PROXY_URL: 'https://proxy.cors.sh/'
};
