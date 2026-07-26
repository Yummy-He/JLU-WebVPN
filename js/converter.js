/**
 * converter.js - WebVPN URL 转换核心算法
 * 从 /mnt/hgfs/H/webvpn/webvpn.py 移植到 JavaScript
 *
 * 算法说明：
 * 1. 解析输入 URL，提取协议、域名、路径
 * 2. 域名长度 ≤ 16 字节：使用全局密钥 XOR 加密
 * 3. 域名长度 > 16 字节：调用短网址 API 生成短链后转写
 * 4. 输出格式：{VPN_BASE}/{protocol}/{prefix+encrypted_hex}{path}
 *
 * 如需调整加密算法，请参考 Python 原版代码及本文档中的 convert() 函数。
 */

const Converter = (() => {
  /** VPN 基础地址 - 如需更换 VPN 服务器，修改此处 */
  const VPN_BASE = 'https://vpn.jlu.edu.cn';

  /** 固定前缀（hex）- 深信服 SSL VPN 协议标识 */
  const DEFAULT_PREFIX = '48714f71342f7a336d582f7e28573737';

  /** 全局密钥（hex）- 用于 XOR 域名加密 */
  const DEFAULT_GLOBAL_KS = '3fac137a68aaaec5d1e2327874219f58';

  /**
   * 将 hex 字符串转为 Uint8Array
   * @param {string} hex
   * @returns {Uint8Array}
   */
  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * 将 Uint8Array 转为 hex 字符串
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 解析用户输入的 URL
   * 支持格式：
   *   - https://example.com/path?q=1#hash
   *   - http://example.com/path
   *   - example.com/path
   *   - example.com
   *
   * @param {string} input - 用户输入
   * @returns {{protocol: string, hostname: string, path: string}}
   */
  function parseURL(input) {
    input = input.trim();
    let protocol = 'https';
    let hostname, path;

    if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        const url = new URL(input);
        protocol = url.protocol.replace(':', '');
        hostname = url.hostname || '';
        path = url.pathname || '/';
        if (url.search) path += url.search;
        if (url.hash) path += url.hash;
      } catch {
        // URL constructor failed, fallback
        const rest = input.substring(input.indexOf('://') + 3);
        if (rest.includes('/')) {
          const idx = rest.indexOf('/');
          hostname = rest.substring(0, idx);
          path = rest.substring(idx);
        } else {
          hostname = rest;
          path = '/';
        }
      }
    } else if (input.includes('/')) {
      const idx = input.indexOf('/');
      hostname = input.substring(0, idx);
      path = '/' + input.substring(idx + 1);
    } else {
      hostname = input;
      path = '/';
    }

    // 移除端口号（如有）
    if (hostname.includes(':')) {
      hostname = hostname.split(':')[0];
    }

    return { protocol, hostname, path };
  }

  /**
   * 检查域名是否过长（域名 UTF-8 字节长度 > 16）
   * @param {string} hostname
   * @returns {boolean}
   */
  function needsExtension(hostname) {
    const encoder = new TextEncoder();
    return encoder.encode(hostname).length > 16;
  }

  /**
   * 直接转写：使用全局密钥 XOR 加密域名（仅用于短域名 ≤ 16 字节）
   *
   * @param {string} hostname - 目标域名（≤ 16 字节）
   * @returns {string} 加密后的 hex 字符串（含前缀）
   */
  function directTransform(hostname) {
    const hb = new TextEncoder().encode(hostname);
    const prefix = hexToBytes(DEFAULT_PREFIX);
    const globalKs = hexToBytes(DEFAULT_GLOBAL_KS);
    const ks = globalKs.slice(0, hb.length);

    const enc = new Uint8Array(hb.length);
    for (let i = 0; i < hb.length; i++) {
      enc[i] = hb[i] ^ ks[i];
    }

    const result = new Uint8Array(prefix.length + enc.length);
    result.set(prefix);
    result.set(enc, prefix.length);

    return bytesToHex(result);
  }

  /**
   * 构建完整的 VPN URL
   *
   * @param {string} protocol - 协议 (http/https)
   * @param {string} encHex - 加密后的 hex 字符串（含前缀）
   * @param {string} path - URL 路径
   * @returns {string} 完整的 VPN URL
   */
  function buildVpnUrl(protocol, encHex, path) {
    return `${VPN_BASE}/${protocol}/${encHex}${path}`;
  }

  /**
   * 主转换函数
   * @param {string} input - 用户输入的 URL
   * @returns {{vpnUrl: string, hostname: string, needsShort: boolean}|null}
   *   - vpnUrl: 生成的 VPN 地址
   *   - hostname: 提取的域名
   *   - needsShort: 是否需要短网址（域名过长）
   */
  function convert(input) {
    const { protocol, hostname, path } = parseURL(input);
    if (!hostname) return null;

    if (!needsExtension(hostname)) {
      // 短域名：直接转写
      const encHex = directTransform(hostname);
      return {
        vpnUrl: buildVpnUrl(protocol, encHex, path),
        hostname,
        needsShort: false
      };
    }

    // 长域名：全部走短网址 API
    return {
      vpnUrl: null,
      hostname,
      needsShort: true,
      originalUrl: input,
      protocol,
      path
    };
  }

  /**
   * 验证用户输入是否为有效 URL
   * @param {string} input
   * @returns {boolean}
   */
  function isValidInput(input) {
    if (!input || !input.trim()) return false;
    const trimmed = input.trim();
    // 纯域名格式也有效
    if (/^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      return true;
    }
    // 完整 URL
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  // 公开 API
  return {
    parseURL,
    convert,
    isValidInput,
    VPN_BASE
  };
})();
