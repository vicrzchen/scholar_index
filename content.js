// 标记内容脚本已加载
console.log('Content script loaded');

// 确保内容脚本只初始化一次
if (!window.contentScriptInitialized) {
  window.contentScriptInitialized = true;

  // 通知扩展内容脚本已加载
  chrome.runtime.sendMessage({ 
    action: 'contentScriptLoaded',
    url: window.location.href
  });

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    if (request.action === 'getPapers') {
      // 立即发送一个响应表示消息已收到
      sendResponse({ status: 'processing' });
      
      getPaperInfo().then(papers => {
        // 使用新的消息发送结果
        chrome.runtime.sendMessage({
          action: 'papersReady',
          data: papers
        });
      }).catch(error => {
        chrome.runtime.sendMessage({
          action: 'papersError',
          error: error.message
        });
      });
      return true; // 保持消息通道开启
    }
  });
}

// 抓取页面上的文献信息
async function getPaperInfo() {
  try {
    console.log('Getting paper info...');
    const papers = [];
    const articles = document.querySelectorAll('.gsc_a_tr');
    const totalArticles = articles.length;
    
    console.log('Found articles:', totalArticles);
    
    chrome.runtime.sendMessage({
      action: 'processingStatus',
      message: `正在获取 ${totalArticles} 篇文献的信息...`
    });
    
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      // 移除之前的高亮
      document.querySelectorAll('.gsc_a_tr.processing').forEach(el => {
        el.classList.remove('processing');
      });
      
      // 添加高亮样式
      article.classList.add('processing');
      
      // 滚动到当前元素
      article.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
      
      // 获取标题和链接
      const titleElement = article.querySelector('.gsc_a_at');
      const title = titleElement ? titleElement.textContent.trim() : '';
      const detailUrl = titleElement ? titleElement.href : '';
      
      chrome.runtime.sendMessage({
        action: 'processingStatus',
        message: `正在处理第 ${i + 1}/${totalArticles} 篇文献：${title}`
      });
      
      // 获取作者信息
      let authors = '';
      if (detailUrl) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { 
                action: 'getAuthorDetails', 
                url: detailUrl 
              },
              (response) => resolve(response)
            );
          });
          authors = response.authors;
        } catch (error) {
          console.error('Error getting author details:', error);
          const authorElement = article.querySelector('.gs_gray');
          authors = authorElement ? authorElement.textContent.trim() : '';
        }
      } else {
        const authorElement = article.querySelector('.gs_gray');
        authors = authorElement ? authorElement.textContent.trim() : '';
      }
      
      // 获取期刊信息（第二个 gs_gray 元素）
      const journalElement = article.querySelectorAll('.gs_gray')[1];
      const journal = journalElement ? journalElement.textContent.trim() : '';
      
      // 获取引用次数
      const citationElement = article.querySelector('.gsc_a_ac');
      const citations = citationElement ? citationElement.textContent.trim() : '0';
      
      // 获取年份
      const yearElement = article.querySelector('.gsc_a_h');
      const year = yearElement ? yearElement.textContent.trim() : '';

      papers.push({
        title: title,
        authors: authors,
        journal: journal,
        citations: citations,
        publishDate: year,
        meta: `${authors} | ${journal} | 引用次数: ${citations}`
      });

      // 短暂延迟以便看到高亮效果
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 最后移除所有高亮
    document.querySelectorAll('.gsc_a_tr.processing').forEach(el => {
      el.classList.remove('processing');
    });

    console.log('Processed papers:', papers.length);
    return papers;
  } catch (error) {
    console.error('Error getting paper info:', error);
    throw error;
  }
}

// 添加高亮样式
const style = document.createElement('style');
style.textContent = `
  .gsc_a_tr.processing {
    background-color: #e3f2fd !important;
    transition: background-color 0.3s ease;
  }
  html {
    scroll-behavior: smooth;
  }
`;
document.head.appendChild(style);

// 确认内容脚本已加载
console.log('Content script initialization complete'); 