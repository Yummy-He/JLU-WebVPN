/**
 * learner.js - "重新学习"模块
 *
 * 当用户反馈生成的 VPN 链接无法访问时，用户手动通过 VPN 获取
 * 实际可用的 URL 后，通过此模块保存原始网址 → VPN 网址的映射。
 *
 * 存储方案：localStorage，键名为 "webvpn_mappings"
 * 格式：{"originalUrl": "vpnUrl", ...}
 */

const Learner = (() => {
  const STORAGE_KEY = 'webvpn_mappings';

  /**
   * 保存原始网址到 VPN 网址的映射
   * @param {string} originalUrl - 原始目标网址
   * @param {string} vpnUrl - 从浏览器复制的实际可用 VPN 网址
   */
  function saveMapping(originalUrl, vpnUrl) {
    const all = getAllMappings();
    // 以完整原始网址为键
    all[originalUrl] = vpnUrl;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      throw new Error('localStorage 存储空间不足');
    }
  }

  /**
   * 根据原始网址查找已保存的 VPN 网址
   * @param {string} originalUrl
   * @returns {string|null}
   */
  function getMapping(originalUrl) {
    const all = getAllMappings();
    return all[originalUrl] || null;
  }

  /**
   * 获取所有映射
   * @returns {Object}
   */
  function getAllMappings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * 执行重新学习：保存原始网址与 VPN 网址的直接映射
   *
   * @param {string} originalUrl - 用户原始目标网址
   * @param {string} vpnUrl - 用户从浏览器复制的实际可用 VPN URL
   * @returns {{originalUrl: string, vpnUrl: string}}
   * @throws {Error} 保存失败时抛出
   */
  function relearn(originalUrl, vpnUrl) {
    // 基本验证
    try { new URL(originalUrl); } catch { throw new Error('无法解析原始网址，请确认网址格式正确'); }
    try { new URL(vpnUrl); } catch { throw new Error('无法解析 VPN 网址，请确认是从浏览器地址栏复制的完整 URL'); }

    saveMapping(originalUrl, vpnUrl);
    return { originalUrl, vpnUrl };
  }

  return {
    saveMapping,
    getMapping,
    getAllMappings,
    relearn,
    STORAGE_KEY
  };
})();
