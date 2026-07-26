/**
 * shortener.js - 短网址 API 封装
 *
 * 使用 urlc.cn 的短网址服务，将长 URL 转换为短网址。
 * 主要用于域名长度 ≥ 16 字节的场景。
 *
 * API 密钥和代理地址从 window.WebVPNConfig 读取（由 js/config.js 注入）。
 * 由于 urlc.cn API 不返回 CORS 头，默认通过 proxy.cors.sh 代理转发请求。
 */

const Shortener = (() => {
  /** 短网址 API 地址 */
  const SHORTENER_API_URL = 'https://www.urlc.cn/api/url/add';

  /** 默认 CORS 代理地址 - proxy.cors.sh 是免费公共代理，也可替换为自建的 Cloudflare Worker */
  const DEFAULT_PROXY_URL = 'https://proxy.cors.sh/';

  /** 请求超时时间（毫秒） */
  const REQUEST_TIMEOUT_MS = 5000;

  /**
   * 获取 API 密钥
   */
  function getApiKey() {
    if (window.WebVPNConfig && window.WebVPNConfig.SHORTENER_API_KEY) {
      return window.WebVPNConfig.SHORTENER_API_KEY;
    }
    throw new Error('未配置 API 密钥，请检查 js/config.js');
  }

  /**
   * 获取 CORS 代理地址
   */
  function getProxyUrl() {
    if (window.WebVPNConfig && window.WebVPNConfig.CORS_PROXY_URL) {
      return window.WebVPNConfig.CORS_PROXY_URL;
    }
    return DEFAULT_PROXY_URL;
  }

  /**
   * 调用短网址 API 生成长 URL 的短网址
   *
   * @param {string} longUrl - 原始长 URL
   * @returns {Promise<string>} 短网址（如 http://i8c.cn/xxx）
   * @throws {Error} 网络错误、超时或 API 返回错误时抛出
   */
  async function shorten(longUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const apiKey = getApiKey();
    const proxyUrl = getProxyUrl();

    const targetUrl = SHORTENER_API_URL;
    const requestUrl = proxyUrl + targetUrl;

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: longUrl }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API 请求失败 (HTTP ${response.status})`);
      }

      const data = await response.json();

      if (data.error === 1) {
        throw new Error(data.msg || '短网址生成失败');
      }

      if (!data.short) {
        throw new Error('API 未返回短网址');
      }

      return data.short;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('API 请求超时，请稍后重试');
      }
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('无法连接到短网址服务，请检查网络连接或 CORS_PROXY_URL 配置');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { shorten };
})();
