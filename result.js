// 从URL参数获取论文数据
function getPapersFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const papersJson = urlParams.get('papers');
  return papersJson ? JSON.parse(decodeURIComponent(papersJson)) : [];
}

// 显示论文列表
function displayPapers(papers) {
  const paperTableBody = document.getElementById('paperTableBody');
  
  paperTableBody.innerHTML = papers.map((paper, index) => `
    <tr>
      <td>
        <input type="checkbox" class="paper-checkbox" data-index="${index}">
      </td>
      <td class="title-cell" title="${escapeHtml(paper.title)}">
        ${escapeHtml(paper.title)}
      </td>
      <td class="authors-cell" title="${escapeHtml(paper.authors)}">
        ${escapeHtml(paper.authors)}
      </td>
      <td class="journal-cell" title="${escapeHtml(paper.journal)}">
        ${escapeHtml(paper.journal)}
      </td>
      <td>${escapeHtml(paper.publishDate)}</td>
      <td>${escapeHtml(paper.citations)}</td>
    </tr>
  `).join('');

  // 添加全选/取消全选功能
  const selectAllCheckbox = document.getElementById('tableSelectAll');
  const checkboxes = document.querySelectorAll('.paper-checkbox');
  
  selectAllCheckbox.addEventListener('change', (e) => {
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
  });

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      selectAllCheckbox.checked = allChecked;
    });
  });

  // 添加表格行悬停效果
  const rows = document.querySelectorAll('#paperTableBody tr');
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const checkbox = row.querySelector('.paper-checkbox');
        checkbox.checked = !checkbox.checked;
        // 触发 change 事件以更新全选框状态
        checkbox.dispatchEvent(new Event('change'));
      }
    });
  });
}

// 下载CSV文件
async function downloadCSV(papers) {
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
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scholar_papers.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 等待一小段时间确保下载开始后再关闭页面
  await new Promise(resolve => setTimeout(resolve, 500));
  window.close();
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
document.addEventListener('DOMContentLoaded', () => {
  const papers = getPapersFromUrl();
  displayPapers(papers);
  
  // 下载按钮点击事件
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.paper-checkbox:checked');
    if (checkboxes.length === 0) {
      alert('请至少选择一篇论文');
      return;
    }
    
    const selectedPapers = Array.from(checkboxes).map(checkbox => {
      const index = parseInt(checkbox.dataset.index);
      return papers[index];
    });
    
    downloadCSV(selectedPapers);
  });
}); 