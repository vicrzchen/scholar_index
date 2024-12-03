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
  const paperList = document.getElementById('paperList');
  if (!papers || papers.length === 0) {
    paperList.innerHTML = '<p>未找到论文信息</p>';
    return;
  }
  
  paperList.innerHTML = papers.map((paper, index) => `
    <div class="paper-item">
      <div>
        <strong class="paper-title" data-index="${index}" style="cursor: pointer;">
          ${escapeHtml(paper.title)}
        </strong>
      </div>
      <div>作者: ${escapeHtml(paper.authors)}</div>
      <div>期刊: ${escapeHtml(paper.journal)}</div>
      <div>发表年份: ${escapeHtml(paper.publishDate)}</div>
      <div>引用次数: ${escapeHtml(paper.citations)}</div>
    </div>
  `).join('');

  // 添加点击事件处理
  const modal = document.getElementById('paperModal');
  const paperDetail = document.getElementById('paperDetail');
  const closeBtn = document.querySelector('.close');

  // 为所有论文标题添加点击事件
  document.querySelectorAll('.paper-title').forEach(title => {
    title.addEventListener('click', () => {
      const index = parseInt(title.dataset.index);
      const paper = papers[index];
      
      // 显示详细信息
      paperDetail.innerHTML = `
        <h3>${escapeHtml(paper.title)}</h3>
        <p><strong>作者:</strong> ${escapeHtml(paper.authors)}</p>
        <p><strong>期刊:</strong> ${escapeHtml(paper.journal)}</p>
        <p><strong>发表年份:</strong> ${escapeHtml(paper.publishDate)}</p>
        <p><strong>引用次数:</strong> ${escapeHtml(paper.citations)}</p>
      `;
      
      modal.style.display = 'block';
    });
  });

  // 关闭按钮事件
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // 点击模态框外部关闭
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
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
    
    // 直接使用缓存的数据下载
    await downloadCSV(cachedPapers);
    
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