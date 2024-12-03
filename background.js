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

// 添加新的消息处理器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthorDetails') {
    // 创建新标签页来加载详情页
    chrome.tabs.create(
      { 
        url: request.url, 
        active: false 
      },
      async (tab) => {
        try {
          // 等待页面加载完成
          await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });

          // 执行脚本获取作者信息
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const authorElement = document.querySelector('.gsc_oci_value');
              return authorElement ? authorElement.textContent.trim() : '';
            }
          });

          // 关闭标签页
          chrome.tabs.remove(tab.id);

          // 返回结果
          sendResponse({ authors: results[0].result });
        } catch (error) {
          console.error('Error in getAuthorDetails:', error);
          sendResponse({ authors: '' });
        }
      }
    );
    return true; // 保持消息通道开启
  }
  
  // 保留原有的消息处理逻辑
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