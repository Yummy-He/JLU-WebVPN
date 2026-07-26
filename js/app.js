/**
 * app.js - 主应用 UI 控制器
 *
 * 负责：
 * - DOM 元素引用与事件绑定
 * - 转换流程编排（输入验证 → 短域名直接转写 / 长域名调短网址 API）
 * - 结果展示与控制
 * - Toast 通知
 * - "重新学习" 交互流程
 *
 * UI 调整提示：
 * - 主题色修改：css/style.css 中的 --color-primary 变量
 * - VPN 基础地址修改：converter.js 中的 VPN_BASE 常量
 * - 短网址 API 代理修改：shortener.js 中的 DEFAULT_PROXY_URL
 * - "重新学习"存储键名：learner.js 中的 STORAGE_KEY
 */

(function () {
  // --- DOM 引用 ---
  const urlInput = document.getElementById('urlInput');
  const inputError = document.getElementById('inputError');
  const convertBtn = document.getElementById('convertBtn');
  const convertBtnText = convertBtn.querySelector('.btn-text');
  const convertSpinner = convertBtn.querySelector('.spinner');
  const resultArea = document.getElementById('resultArea');
  const resultLink = document.getElementById('resultLink');
  const copyBtn = document.getElementById('copyBtn');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  const toastIcon = document.getElementById('toastIcon');
  const troubleshootSection = document.getElementById('troubleshootSection');
  const troubleshootToggle = document.getElementById('troubleshootToggle');
  const troubleshootContent = document.getElementById('troubleshootContent');
  const startRelearnBtn = document.getElementById('startRelearnBtn');
  const relearnForm = document.getElementById('relearnForm');
  const relearnSubmitBtn = document.getElementById('relearnSubmitBtn');
  const relearnSubmitText = relearnSubmitBtn.querySelector('.btn-text');
  const relearnSpinner = relearnSubmitBtn.querySelector('.spinner');
  const relearnError = document.getElementById('relearnError');
  const relearnSuccess = document.getElementById('relearnSuccess');

  // --- 状态 ---
  let isConverting = false;
  let currentConvertedUrl = '';
  let toastTimer = null;

  // --- Toast ---
  /** 显示 Toast 通知 - type 支持 'success' | 'error' | '' */
  function showToast(message, type) {
    if (toastTimer) clearTimeout(toastTimer);

    toastText.textContent = message;
    toast.className = 'toast ' + (type || '');
    toast.style.display = 'flex';

    // 更新图标
    if (type === 'success') {
      toastIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
    } else if (type === 'error') {
      toastIcon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
    }

    // 强制回流后触发动画
    toast.offsetHeight;
    toast.style.animation = 'none';
    toast.offsetHeight;
    toast.style.animation = 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  }

  // --- Loading 状态 ---
  function setLoading(loading) {
    isConverting = loading;
    if (loading) {
      convertBtn.disabled = true;
      convertBtnText.style.display = 'none';
      convertSpinner.style.display = 'inline-block';
      urlInput.disabled = true;
      hideResult();
      hideInputError();
    } else {
      convertBtn.disabled = false;
      convertBtnText.style.display = '';
      convertSpinner.style.display = 'none';
      urlInput.disabled = false;
    }
  }

  function setRelearnLoading(loading) {
    if (loading) {
      relearnSubmitBtn.disabled = true;
      relearnSubmitText.style.display = 'none';
      relearnSpinner.style.display = 'inline-block';
      relearnError.style.display = 'none';
      relearnSuccess.style.display = 'none';
    } else {
      relearnSubmitBtn.disabled = false;
      relearnSubmitText.style.display = '';
      relearnSpinner.style.display = 'none';
    }
  }

  // --- Error Display ---
  function showInputError(message) {
    inputError.textContent = message;
    inputError.style.display = 'block';
    urlInput.classList.add('has-error');
  }

  function hideInputError() {
    inputError.style.display = 'none';
    urlInput.classList.remove('has-error');
  }

  // --- Result Display ---
  function showResult(vpnUrl) {
    currentConvertedUrl = vpnUrl;
    resultLink.href = vpnUrl;
    resultLink.textContent = vpnUrl;
    resultArea.style.display = 'block';
    // 触发动画
    resultArea.style.animation = 'none';
    resultArea.offsetHeight;
    resultArea.style.animation = 'fadeInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    // 滚动到结果区域
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideResult() {
    resultArea.style.display = 'none';
    currentConvertedUrl = '';
  }

  // --- Copy ---
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板', 'success');
    } catch {
      // Fallback: 使用旧版 API
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板', 'success');
      } catch {
        showToast('复制失败，请手动复制', 'error');
      }
    }
  }

  // --- 主转换流程 ---
  async function handleConvert() {
    if (isConverting) return;

    const input = urlInput.value;

    // 验证
    if (!input || !input.trim()) {
      showInputError('请输入网址');
      urlInput.focus();
      return;
    }

    if (!Converter.isValidInput(input)) {
      showInputError('请输入有效的网址（如 https://example.com 或 example.com/path）');
      urlInput.focus();
      return;
    }

    hideInputError();
    setLoading(true);

    try {
      const result = Converter.convert(input);

      if (!result) {
        showInputError('转换失败，请检查网址格式是否正确');
        setLoading(false);
        return;
      }

      if (!result.needsShort) {
        // 短域名 → 直接显示结果
        showResult(result.vpnUrl);
        setLoading(false);
        return;
      }

      // 长域名 → 先检查是否有已保存的映射，否则调用短网址 API
      convertBtnText.style.display = '';
      convertSpinner.style.display = 'none';
      const statusEl = document.createElement('span');
      statusEl.className = 'converting-status';
      statusEl.style.cssText = 'font-size:0.85rem;color:#6e6e73;margin-top:8px;display:block;text-align:center;';
      convertBtn.parentNode.appendChild(statusEl);

      try {
        // 检查是否有已学习的映射
        const savedMapping = Learner.getMapping(input);
        if (savedMapping) {
          statusEl.remove();
          showResult(savedMapping);
          showToast('已使用本地缓存的可用链接', 'success');
          setLoading(false);
          return;
        }

        statusEl.textContent = '正在生成短网址...';
        const shortUrl = await Shortener.shorten(input);
        statusEl.remove();

        // 对短网址的域名进行转写
        const shortResult = Converter.convert(shortUrl);
        if (!shortResult || shortResult.needsShort) {
          throw new Error('短网址转换失败');
        }

        showResult(shortResult.vpnUrl);
        showToast('已通过短网址服务生成，链接有效', 'success');
      } catch (shortErr) {
        statusEl.remove();
        const msg = shortErr.message || '短网址服务不可用';
        showInputError(`${msg}。您也可以使用"重新学习"功能手动添加可用链接`);
      }
    } catch (err) {
      showInputError('转换过程发生错误，请稍后重试');
      console.error('Convert error:', err);
    } finally {
      setLoading(false);
      // 清理可能残留的 status 元素
      const status = document.querySelector('.converting-status');
      if (status) status.remove();
    }
  }

  // --- 故障排查 / 重新学习 ---
  function toggleTroubleshoot() {
    const isExpanded = troubleshootSection.classList.contains('expanded');
    if (isExpanded) {
      troubleshootSection.classList.remove('expanded');
    } else {
      troubleshootSection.classList.add('expanded');
    }
  }

  function showRelearnForm() {
    relearnForm.style.display = 'block';
    startRelearnBtn.style.display = 'none';
    relearnError.style.display = 'none';
    relearnSuccess.style.display = 'none';
  }

  async function handleRelearn(e) {
    e.preventDefault();

    let originalUrl = document.getElementById('originalUrl').value.trim();
    let vpnUrl = document.getElementById('vpnUrl').value.trim();

    if (!originalUrl) {
      relearnError.textContent = '请输入原始目标网址';
      relearnError.style.display = 'block';
      return;
    }
    if (!vpnUrl) {
      relearnError.textContent = '请粘贴从浏览器地址栏复制的 VPN 网址';
      relearnError.style.display = 'block';
      return;
    }

    // 自动补全协议前缀
    if (!/^https?:\/\//i.test(originalUrl)) {
      originalUrl = 'https://' + originalUrl;
    }
    if (!/^https?:\/\//i.test(vpnUrl)) {
      vpnUrl = 'https://' + vpnUrl;
    }

    setRelearnLoading(true);

    try {
      const result = Learner.relearn(originalUrl, vpnUrl);
      relearnError.style.display = 'none';
      relearnSuccess.style.display = 'block';
      relearnSuccess.textContent = `学习成功！已保存 "${result.originalUrl || originalUrl}" 的可用链接，请重新尝试转换`;
      showToast('学习成功！', 'success');

      // 如果用户之前输入了原始 URL，自动重试转换
      if (urlInput.value.trim()) {
        // 不自动触发，让用户手动重试，避免困惑
      }
    } catch (err) {
      relearnError.textContent = err.message || '学习失败，请重试';
      relearnError.style.display = 'block';
      relearnSuccess.style.display = 'none';
    } finally {
      setRelearnLoading(false);
    }
  }

  // --- 事件绑定 ---
  convertBtn.addEventListener('click', handleConvert);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConvert();
    }
  });

  // 输入时清除错误
  urlInput.addEventListener('input', () => {
    hideInputError();
  });

  copyBtn.addEventListener('click', () => {
    if (currentConvertedUrl) {
      copyToClipboard(currentConvertedUrl);
    }
  });

  troubleshootToggle.addEventListener('click', toggleTroubleshoot);

  startRelearnBtn.addEventListener('click', showRelearnForm);

  relearnForm.addEventListener('submit', handleRelearn);

  // 点击 Toast 可提前关闭
  toast.addEventListener('click', () => {
    toast.style.display = 'none';
    if (toastTimer) clearTimeout(toastTimer);
  });

  // --- 初始化 ---
  console.log('JLU WebVPN 转换工具已就绪');
  console.log('VPN 基础地址:', Converter.VPN_BASE);
  console.log('已保存的映射数量:', Object.keys(Learner.getAllMappings()).length);
})();
