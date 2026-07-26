/**
 * CORS Proxy Worker for urlc.cn short URL API.
 *
 * 部署方式（Cloudflare Workers 免费套餐）：
 * 1. 打开 https://dash.cloudflare.com/ → Workers & Pages → Create Worker
 * 2. 将本文件内容粘贴到编辑器中 → Deploy
 * 3. 复制 Worker URL（如 https://webvpn-proxy.your-subdomain.workers.dev）
 * 4. 将该 URL 填入 js/config.js 的 CORS_PROXY_URL
 *
 * 也可以部署到其他支持 Web Fetch API 的平台：
 *   - Deno Deploy (https://deno.com/deploy)
 *   - Vercel Edge Functions
 *   - Netlify Edge Functions
 */

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 只接受 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const TARGET_URL = 'https://www.urlc.cn/api/url/add';

    try {
      // 转发请求到 urlc.cn
      const response = await fetch(TARGET_URL, {
        method: 'POST',
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        },
        body: request.body
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 1, msg: '代理请求失败: ' + err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
