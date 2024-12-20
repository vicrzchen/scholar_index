// 在文件开头添加缓存变量
let cachedPapers = null;

// 获取当前标签页中的文献信息
async function getPapers() {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab) {
      console.error('No active tab found');
      showError('无法获取当前标签页信息');
      return;
    }
    
    if (!tab.url.includes('scholar.google')) {
      document.getElementById('paperList').innerHTML = 
        '<p>请在 Google Scholar 页面使用此扩展</p>';
      return;
    }

    // 显示加载状态
    showLoading();

    // 注入内容脚本
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.log('Content script may already be injected:', error);
    }

    // 获取论文数据
    cachedPapers = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, {action: 'getPapers'}, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        function messageHandler(message) {
          if (message.action === 'papersReady') {
            chrome.runtime.onMessage.removeListener(messageHandler);
            resolve(message.data);
          } else if (message.action === 'papersError') {
            chrome.runtime.onMessage.removeListener(messageHandler);
            reject(new Error(message.error));
          }
        }
        
        chrome.runtime.onMessage.addListener(messageHandler);
      });
    });

    hideLoading();
    displayPapers(cachedPapers);

  } catch (error) {
    hideLoading();
    console.error('Error in getPapers:', error);
    showError('获取论文信息失败: ' + error.message);
  }
}

// 显示文献列表
function displayPapers(papers) {
  if (!papers || papers.length === 0) {
    showError('未找到论文信息');
    return;
  }

  // 在新标签页中打开结果页面
  const papersJson = encodeURIComponent(JSON.stringify(papers));
  chrome.tabs.create({
    url: `result.html?papers=${papersJson}`
  });
  
  // 关闭弹出窗口
  window.close();
}

// 下载CSV文件
async function downloadCSV(papers) {
  try {
    const headers = ['标题', '作者', '期刊', '发表年份', '引用次数'];
    const csvContent = [
      headers.join(','),
      ...papers.map(paper => [
        `"${(paper.title || '').replace(/"/g, '""')}"`,
        `"${(paper.authors || '').replace(/"/g, '""')}"`,
        `"${(paper.journal || '').replace(/"/g, '""')}"`,
        paper.publishDate || '',
        paper.citations || '0'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url: url,
      filename: 'scholar_papers.csv',
      saveAs: true
    });
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading CSV:', error);
    showError('下载CSV文件失败: ' + error.message);
  }
}

// 显示错误信息
function showError(message) {
  const paperList = document.getElementById('paperList');
  paperList.innerHTML = `<p style="color: red;">${escapeHtml(message)}</p>`;
}

// HTML转义
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 初始化
document.addEventListener('DOMContentLoaded', getPapers);

// 下载按钮点击事件
document.getElementById('downloadBtn').addEventListener('click', async () => {
  try {
    if (!cachedPapers) {
      throw new Error('没有可用的论文数据');
    }
    
    // 获取选中的论文
    const checkboxes = document.querySelectorAll('.paper-checkbox:checked');
    if (checkboxes.length === 0) {
      throw new Error('请至少选择一篇论文');
    }
    
    // 筛选出选中的论文数据
    const selectedPapers = Array.from(checkboxes).map(checkbox => {
      const index = parseInt(checkbox.dataset.index);
      return cachedPapers[index];
    });
    
    // 导出选中的论文
    await downloadCSV(selectedPapers);
    
  } catch (error) {
    console.error('Error in download button click:', error);
    showError('导出失败: ' + error.message);
  }
});

// 显示加载状态
function showLoading() {
  const paperList = document.getElementById('paperList');
  paperList.innerHTML = `
    <div class="loading">
      <p>正在获取论文信息...</p>
      <p id="processingStatus"></p>
    </div>
  `;
  document.getElementById('downloadBtn').disabled = true;
}

// 隐藏加载状态
function hideLoading() {
  document.getElementById('downloadBtn').disabled = false;
}

// 更新处理状态
function updateProcessingStatus(message) {
  const statusElement = document.getElementById('processingStatus');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// 在初始化时添加消息监听
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'processingStatus') {
    updateProcessingStatus(message.message);
  }
}); 