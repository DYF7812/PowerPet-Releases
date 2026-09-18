/* 发布页仅使用内存中的示例数据，不调用模型、不访问本机文件。 */
(() => {
  const root = document.querySelector('.workspace-demo');
  if (!root) return;

  const find = (id) => root.querySelector(`#demo-${id}`);
  const files = [
    {
      id: 'meeting', name: '会议记录.txt', type: 'TXT',
      content: '项目讨论会\n2026 / 09 / 18\n\n本次确认：优先完成文件预览与助手对话。\n\n本周待办：\n小林：周三前整理功能清单。\n小陈：周五前完成交互原型。\n\n下次评审：下周一，准备演示材料。',
      answer: '这次会议的三个重点\n\n• 功能范围：先完成文件预览与助手对话。\n• 本周待办：小林整理功能清单，小陈完成交互原型。\n• 下次评审：下周一，提前准备演示材料。',
    },
    {
      id: 'plan', name: '项目计划.md', type: 'MD',
      content: '# 项目计划\n\n目标：让文件查找、阅读和整理更顺手。\n\n## 本周\n- 完成文件中心交互原型\n- 验证只读预览\n\n## 下周\n- 联调助手工具审批\n- 整理使用说明',
      answer: '项目计划摘要\n\n• 目标：串联文件查找、阅读和整理。\n• 本周：完成文件中心原型，验证只读预览。\n• 下周：联调工具审批，整理使用说明。',
    },
    {
      id: 'image', name: '活动截图.png', type: 'PNG',
      content: '设计分享会\n周五 14:00—16:00\n图书馆 · 302 室\n带上你的想法，一起交流。',
      answer: '已提取截图中的文字（预设演示）\n\n设计分享会\n周五 14:00—16:00\n图书馆 · 302 室\n带上你的想法，一起交流。\n\n软件中可从截图确认栏运行 Windows 本机 OCR。',
    },
  ];
  const originalNames = files.map((file) => file.name);
  const scenarios = {
    summary: { title: '整理会议记录', file: 'meeting', prompt: '@会议记录.txt 帮我整理主要内容和待办事项。' },
    rename: { title: '文件重命名审批', file: 'meeting', prompt: '将 @会议记录.txt 重命名为「项目会议纪要.txt」。' },
    ocr: { title: '体验截图识字', file: 'image', prompt: '识别 @活动截图.png 中的文字。' },
  };
  const transcript = find('transcript');
  const input = find('message');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = files[0];
  let timer;
  let busy = false;
  let approval = null;
  let tool = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function status(text) {
    find('status').textContent = `● ${text}`;
  }

  function setBusy(value) {
    busy = value;
    find('send').disabled = value;
    find('stop').disabled = !value;
    find('mention').disabled = value;
    input.readOnly = value;
  }

  function cancel() {
    clearTimeout(timer);
    if (approval) approval.remove();
    approval = null;
    if (tool) tool.classList.remove('pending');
    transcript.querySelector('.is-streaming')?.classList.remove('is-streaming');
    setBusy(false);
  }

  function scrollConversation() {
    transcript.scrollTop = transcript.scrollHeight;
  }

  function renderPreview() {
    const preview = find('preview-content');
    find('preview-type').textContent = selected.type;
    preview.replaceChildren();
    if (selected.type === 'PNG') {
      const poster = element('div', 'demo-poster');
      poster.append(element('small', '', 'IDEAS TOGETHER'), element('strong', '', '设计分享会'),
        element('span', '', '周五 14:00—16:00\n图书馆 · 302 室\n\n带上你的想法，一起交流。'));
      preview.append(poster);
    } else {
      preview.textContent = selected.content;
    }
    if (!reducedMotion.matches) {
      preview.getAnimations().forEach((animation) => animation.cancel());
      preview.animate([{ opacity: .3, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
    }
  }

  function renderFiles() {
    const list = find('file-list');
    const query = find('search').value.trim().toLowerCase();
    list.replaceChildren();
    for (const file of files.filter((item) => item.name.toLowerCase().includes(query))) {
      const button = element('button', 'demo-file');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(file === selected));
      button.setAttribute('aria-label', `预览 ${file.name}`);
      button.title = file.name;
      const description = element('span', 'file-description');
      description.append(element('strong', '', file.name), element('small', '', file.type === 'PNG' ? '图片素材 · 可识字' : '文本资料 · 可总结'));
      button.append(element('span', `file-type${file.type === 'PNG' ? ' image' : ''}`, file.type), description);
      button.addEventListener('click', () => {
        selected = file;
        // 保留原按钮与键盘焦点，只更新选择状态。
        for (const item of list.querySelectorAll('button')) item.setAttribute('aria-pressed', String(item === button));
        find('preview').hidden = false;
        find('preview-toggle').setAttribute('aria-expanded', 'true');
        renderPreview();
        if (!busy) input.value = `@${file.name} ${file.type === 'PNG' ? '识别截图中的文字。' : '帮我总结这份文件。'}`;
      });
      list.append(button);
    }
    if (!list.children.length) list.append(element('p', 'demo-empty', '没有匹配的示例文件，试试“会议”或清空搜索。'));
    renderPreview();
  }

  function showAnswer(text) {
    const answer = element('p', 'demo-answer is-streaming');
    transcript.append(answer);
    let length = 0;
    function tick() {
      length = reducedMotion.matches ? text.length : Math.min(length + 2, text.length);
      answer.textContent = text.slice(0, length);
      scrollConversation();
      if (length < text.length) {
        timer = setTimeout(tick, 20);
      } else {
        answer.classList.remove('is-streaming');
        setBusy(false);
        status('演示完成');
      }
    }
    tick();
  }

  function setTool(title, detail) {
    tool.replaceChildren(element('strong', '', title), element('small', '', detail));
    scrollConversation();
  }

  function requestRename(file) {
    tool.classList.remove('pending');
    if (file.name === '项目会议纪要.txt') {
      setTool('无需重命名', '示例文件已使用目标名称');
      showAnswer('文件已经叫“项目会议纪要.txt”。点击“重置”可以重新体验审批。');
      return;
    }
    setTool('等待你批准 · 重命名文件', `${file.name} → 项目会议纪要.txt\n范围：示例中转站，仅演示改名。`);
    approval = element('div', 'demo-approval-actions');
    const approve = element('button', '', '批准执行');
    const reject = element('button', '', '拒绝');
    approve.type = reject.type = 'button';
    approval.append(approve, reject);
    tool.append(approval);
    status('等待审批');
    scrollConversation();
    approve.addEventListener('click', () => {
      approval.remove();
      approval = null;
      file.name = '项目会议纪要.txt';
      renderFiles();
      setTool('✓ 重命名完成', '示例文件中心已同步更新');
      showAnswer('已将文件重命名为“项目会议纪要.txt”，内容保持不变。\n\n你可以在右侧查看结果，或点击“重置”还原示例。');
      find('stop').focus();
    });
    reject.addEventListener('click', () => {
      approval.remove();
      approval = null;
      setTool('已拒绝执行', '文件名保持不变');
      showAnswer('没有修改文件。你可以切换其他体验场景。');
      find('stop').focus();
    });
  }

  function startScenario(name) {
    cancel();
    const scenario = scenarios[name];
    selected = files.find((file) => file.id === scenario.file);
    find('session').textContent = scenario.title;
    input.value = scenario.prompt.replace(originalNames[0], files[0].name);
    find('search').value = '';
    transcript.replaceChildren();
    const welcome = element('p', 'demo-welcome');
    const emblem = element('img', 'welcome-emblem');
    emblem.src = 'power_pet.svg';
    emblem.alt = '';
    welcome.append(emblem, element('small', 'welcome-eyebrow', '文件就位，灵感开场'),
      element('strong', '', name === 'rename' ? '每一次修改，都由你决定。' : '让文件里的信息，清晰起来。'),
      element('span', '', '预览一份资料，发送一个想法。\n从下方的示例消息开始，看看助手如何接手。'));
    const steps = element('span', 'welcome-steps');
    steps.append(element('span', '', '选择文件'), element('span', '', '发送需求'), element('span', '', '查看结果'));
    welcome.append(steps);
    transcript.append(welcome);
    root.querySelectorAll('[data-scenario]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.scenario === name)));
    renderFiles();
    status('等待体验');
  }

  find('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (busy || !message) return;
    setBusy(true);
    transcript.replaceChildren(element('p', 'demo-user', message), element('p', 'assistant-label', '助手'));
    const file = files.find((item) => message.includes(`@${item.name}`)) || selected;
    selected = file;
    renderFiles();
    tool = element('div', 'demo-tool pending');
    transcript.append(tool);
    setTool('正在解析演示请求…', file.name);
    status('演示进行中');
    timer = setTimeout(() => {
      if (/重命名|改名/.test(message) && file.id === 'meeting' && message.includes('项目会议纪要.txt')) {
        requestRename(file);
        return;
      }
      tool.classList.remove('pending');
      if (/总结|整理|摘要|主要内容|待办/.test(message) && file.type !== 'PNG') {
        setTool('✓ 读取文件完成', `${file.name} · 使用内置示例内容`);
        showAnswer(file.answer);
      } else if (/识别|识字|OCR|提取.*文字/i.test(message) && file.type === 'PNG') {
        setTool('✓ 截图文字识别演示', '使用预设识别结果，未运行真实 OCR');
        showAnswer(file.answer);
      } else {
        setTool('当前为预设演示', '不会调用真实模型或执行自定义指令');
        showAnswer('这里可以体验文本摘要、会议记录重命名和截图识字。请点击上方场景按钮，再发送示例消息；完整对话能力可在软件中连接模型后使用。');
      }
    }, reducedMotion.matches ? 0 : 700);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      find('form').requestSubmit();
    }
  });
  find('stop').addEventListener('click', () => {
    cancel();
    if (tool) setTool('演示已停止', '可重新发送消息或切换场景');
    status('已停止');
    input.focus();
  });
  find('reset').addEventListener('click', () => {
    files.forEach((file, index) => { file.name = originalNames[index]; });
    find('preview').hidden = false;
    find('preview-toggle').setAttribute('aria-expanded', 'true');
    setView('list');
    startScenario('summary');
  });
  root.querySelectorAll('[data-scenario]').forEach((button) => button.addEventListener('click', () => startScenario(button.dataset.scenario)));
  find('search').addEventListener('input', renderFiles);
  find('preview-toggle').addEventListener('click', () => {
    find('preview').hidden = !find('preview').hidden;
    find('preview-toggle').setAttribute('aria-expanded', String(!find('preview').hidden));
  });
  function setView(view) {
    find('file-list').classList.toggle('is-grid', view === 'grid');
    root.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  }
  root.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  find('mention').addEventListener('click', () => {
    input.value = `@${selected.name} ${selected.type === 'PNG' ? '识别截图中的文字。' : '帮我总结这份文件。'}`;
    input.focus();
  });
  startScenario('summary');
})();
