// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('scholar.google')) {
    try {
      chrome.tabs.sendMessage(tabId, { action: 'pageLoaded' });
    } catch (error) {
      console.error('Error sending pageLoaded message:', error);
    }
  }
});

// 处理获取作者信息的请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchAuthors') {
    fetch(request.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // 首先尝试获取详情页中的作者信息
        let authorElement = doc.querySelector('.gsc_oci_value');
        if (!authorElement) {
          // 如果找不到，尝试其他可能的选择器
          authorElement = doc.querySelector('.gs_gray');
        }
        
        const authors = authorElement ? authorElement.textContent.trim() : '';
        console.log('Found authors:', authors);
        sendResponse({ authors: authors });
      })
      .catch(error => {
        console.error('Error fetching authors:', error);
        sendResponse({ authors: '' });
      });
    return true;
  }
}); 