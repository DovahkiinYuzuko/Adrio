let projectHandle, charaDirHandle, memoDirHandle, imageDirHandle;
let currentFileHandle = null; 
let currentTab = 'chara', editingData = null, editingHandle = null;
let currentMode = localStorage.getItem('adrio-mode') || 'rich';
let saveTimeout = null;
let lastModifiedTime = 0;
let viewMode = 0;
let isEdited = false; 
let isProgrammaticChange = false; 
let isApplyingMode = false;

const richEditor = document.getElementById('editor-rich');
const mdInput = document.getElementById('md-input');
const mdPreview = document.getElementById('md-preview');
const lineNumbers = document.getElementById('line-numbers');
const togglePreviewBtn = document.getElementById('toggle-preview-btn');
const floatingToolbar = document.getElementById('floating-toolbar');

const searchContainer = document.getElementById('search-bar-container');
const searchInput = document.getElementById('search-input');

document.getElementById('toggle-search-btn').onclick = () => {
    const sc = document.getElementById('search-bar-container');
    if (sc.style.display === 'none') {
        sc.style.display = 'flex';
        searchInput.focus();
    } else {
        sc.style.display = 'none';
    }
};

const searchCloseBtn = document.getElementById('search-close');
if(searchCloseBtn) {
    searchCloseBtn.onclick = () => {
        document.getElementById('search-bar-container').style.display = 'none';
    };
}

const settingsToggleBtn = document.getElementById('settings-toggle-btn');
if(settingsToggleBtn) {
    settingsToggleBtn.onclick = (e) => {
        const sd = document.getElementById('settings-dropdown');
        sd.style.display = sd.style.display === 'none' ? 'flex' : 'none';
        e.stopPropagation();
    };
    document.addEventListener('click', (e) => {
        const sd = document.getElementById('settings-dropdown');
        if (sd && sd.style.display !== 'none' && !sd.contains(e.target) && e.target !== settingsToggleBtn && !settingsToggleBtn.contains(e.target)) {
            sd.style.display = 'none';
        }
    });
}

// フォント設定まわり
const fontToggleBtn = document.getElementById('font-toggle');
if (fontToggleBtn) {
    fontToggleBtn.onclick = (e) => {
        const fd = document.getElementById('font-dropdown');
        fd.style.display = fd.style.display === 'none' ? 'block' : 'none';
        e.stopPropagation();
    };
    document.addEventListener('click', (e) => {
        const fd = document.getElementById('font-dropdown');
        if (fd && fd.style.display !== 'none' && !fd.contains(e.target) && e.target !== fontToggleBtn && !fontToggleBtn.contains(e.target)) {
            fd.style.display = 'none';
        }
    });
}

let currentFont = localStorage.getItem('adrio-font') || 'gothic';

function applyFontFamily(fontName) {
    if (fontName === 'gothic') {
        document.documentElement.style.setProperty('--editor-font', `var(--font-gothic)`);
        document.body.classList.remove('font-mincho');
    } else if (fontName === 'mincho') {
        document.documentElement.style.setProperty('--editor-font', `var(--font-mincho)`);
        document.body.classList.add('font-mincho');
    } else {
        document.documentElement.style.setProperty('--editor-font', `"${fontName}", var(--font-gothic)`);
        document.body.classList.remove('font-mincho');
    }
    localStorage.setItem('adrio-font', fontName);
    currentFont = fontName;
    
    document.querySelectorAll('.font-select-btn').forEach(btn => {
        if (btn.dataset.font === fontName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

document.querySelectorAll('#font-dropdown > .font-select-btn').forEach(btn => {
    btn.onclick = () => applyFontFamily(btn.dataset.font);
});

const loadSysFontsBtn = document.getElementById('load-system-fonts-btn');
if(loadSysFontsBtn) {
    loadSysFontsBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
            if (!('queryLocalFonts' in window)) {
                alert("お使いのブラウザはシステムフォントの読み込みに対応していません。(Chrome/Edge等でご利用ください)");
                return;
            }
            const fonts = await window.queryLocalFonts();
            const uniqueFonts = [];
            const seen = new Set();
            for (const f of fonts) {
                if (!seen.has(f.family)) {
                    seen.add(f.family);
                    uniqueFonts.push(f);
                }
            }
            
            const listEl = document.getElementById('system-fonts-list');
            listEl.innerHTML = '';
            uniqueFonts.forEach(f => {
                const btn = document.createElement('button');
                btn.className = 'font-select-btn';
                btn.style.fontFamily = `"${f.family}", var(--font-gothic)`;
                btn.textContent = f.family;
                btn.dataset.font = f.family;
                btn.onclick = () => applyFontFamily(f.family);
                listEl.appendChild(btn);
            });
            applyFontFamily(currentFont);
        } catch (err) {
            console.error(err);
            alert("システムフォントの読み込みに失敗しました。権限が拒否された可能性があります。");
        }
    };
}


const execSearch = (backwards) => {
    if (!searchInput.value) return;
    const query = searchInput.value;
    
    if (currentMode === 'md') {
        const ta = mdInput;
        const val = ta.value.toLowerCase();
        const q = query.toLowerCase();
        let idx = -1;
        if (backwards) {
            idx = val.lastIndexOf(q, ta.selectionStart - 1);
            if (idx === -1) idx = val.lastIndexOf(q);
        } else {
            idx = val.indexOf(q, ta.selectionEnd);
            if (idx === -1) idx = val.indexOf(q);
        }
        if (idx !== -1) {
            ta.setSelectionRange(idx, idx + q.length);
            ta.focus();
            const textBefore = val.substring(0, idx);
            const lineCount = textBefore.split('\n').length;
            const lineHeight = parseFloat(getComputedStyle(ta).lineHeight);
            ta.scrollTop = Math.max(0, (lineCount - 2) * lineHeight);
        }
    } else {
        richEditor.focus();
        let found = false;
        let safety = 50;
        while(safety-- > 0) {
            found = window.find(query, false, backwards, true, false, false, false);
            if (!found) break;
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (richEditor.contains(range.commonAncestorContainer)) {
                    range.startContainer.parentElement.scrollIntoView({block: "center", behavior: "smooth"});
                    break;
                }
            }
        }
    }
};

document.getElementById('search-next').onclick = () => execSearch(false);
document.getElementById('search-prev').onclick = () => execSearch(true);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        execSearch(e.shiftKey);
    }
});

const themeToggleBtn = document.getElementById('theme-toggle');
let isLightMode = localStorage.getItem('adrio-theme') === 'light';

function applyTheme(isLight) {
    if (isLight) {
        document.body.classList.add('light-mode');
        themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
    } else {
        document.body.classList.remove('light-mode');
        themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
    }
    lucide.createIcons();
    localStorage.setItem('adrio-theme', isLight ? 'light' : 'dark');
}

themeToggleBtn.onclick = () => {
    isLightMode = !isLightMode;
    applyTheme(isLightMode);
};


window.addEventListener('DOMContentLoaded', async () => {
    applyTheme(isLightMode);
    applyFontFamily(currentFont);
    applyMode(currentMode); 
    document.execCommand('defaultParagraphSeparator', false, 'div');
    history.replaceState({ richScroll: 0, mdScroll: 0 }, "");
    lucide.createIcons();

    document.querySelectorAll('.formatting-toolbar button').forEach(btn => {
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); });
    });

    try {
        const storedHandle = await idbKeyval.get('adrio-project-handle');
        if (storedHandle) {
            const resumeBtn = document.getElementById('resume-btn');
            resumeBtn.style.display = 'flex';
            resumeBtn.onclick = async () => {
                try {
                    const permission = await storedHandle.requestPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        resumeBtn.style.display = 'none';
                        await setupProject(storedHandle);
                    } else {
                        alert('フォルダへのアクセス権限が拒否されました。');
                    }
                } catch (e) {
                    console.error(e);
                    alert('前回のプロジェクトの再開に失敗しました。');
                }
            };
        }
    } catch (e) {}
});

const ro = new ResizeObserver(entries => {
    const w = entries[0].contentRect.width;
    const tb = document.getElementById('floating-toolbar');
    const st = tb.querySelector('.secondary-tools');
    const moreBtn = document.getElementById('toolbar-more-btn');
    if (w < 700) {
        st.style.display = 'none';
        moreBtn.style.display = 'flex';
    } else {
        st.style.display = 'flex';
        moreBtn.style.display = 'none';
        document.getElementById('toolbar-dropdown').style.display = 'none';
    }
});
ro.observe(document.getElementById('editor-container'));

document.getElementById('toolbar-more-btn').addEventListener('mousedown', (e) => {
    e.preventDefault();
    const dd = document.getElementById('toolbar-dropdown');
    if (dd.style.display === 'none') {
        dd.innerHTML = document.querySelector('.secondary-tools').innerHTML;
        dd.querySelectorAll('button').forEach(b => {
            b.addEventListener('mousedown', ev => ev.preventDefault());
        });
        lucide.createIcons({root: dd});
        dd.style.display = 'grid';
    } else {
        dd.style.display = 'none';
    }
});

const fontUploadBtn = document.getElementById('font-upload');
if(fontUploadBtn) {
    fontUploadBtn.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const fontName = 'AdrioCustomFont';
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, buffer);
            await fontFace.load();
            document.fonts.add(fontFace);
            document.documentElement.style.setProperty('--editor-font', `"${fontName}", var(--font-gothic)`);
            alert('カスタムフォントを適用しました。');
        } catch(err) {
            console.error(err);
            alert('フォントの読み込みに失敗しました。');
        }
    };
}

function insertBlockElement(htmlStr) {
    richEditor.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    let range = selection.getRangeAt(0);
    let node = range.startContainer;
    
    let block = node;
    while (block && block !== richEditor && !['DIV', 'P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI'].includes(block.tagName)) {
        block = block.parentNode;
    }
    
    let isBlockEmpty = false;
    if (block && block !== richEditor) {
        const text = block.textContent.replace(/[\u200B-\u200D\uFEFF\n]/g, '').trim();
        if (text === '') isBlockEmpty = true;
    }

    const newDiv = document.createElement('div');
    newDiv.innerHTML = htmlStr;

    isProgrammaticChange = true;

    try {
        if (!block || block === richEditor) {
            richEditor.appendChild(newDiv);
        } else if (isBlockEmpty) {
            block.parentNode.insertBefore(newDiv, block);
            block.remove();
        } else {
            block.parentNode.insertBefore(newDiv, block.nextSibling);
        }

        const newRange = document.createRange();
        newRange.setStartAfter(newDiv);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        richEditor.focus();
    } finally {
        requestAnimationFrame(() => {
            isProgrammaticChange = false;
            isEdited = true;
            autoSave();
        });
    }
}

async function saveImageFile(file) {
    if (!imageDirHandle) return null;
    let baseName = file.name;
    let ext = '';
    const lastDot = file.name.lastIndexOf('.');
    if (lastDot !== -1) {
        baseName = file.name.substring(0, lastDot);
        ext = file.name.substring(lastDot);
    }
    
    let counter = 1;
    let currentName = file.name;
    let fileHandle;
    
    while (true) {
        try {
            await imageDirHandle.getFileHandle(currentName, { create: false });
            currentName = `${baseName}(${counter})${ext}`;
            counter++;
        } catch (err) {
            fileHandle = await imageDirHandle.getFileHandle(currentName, { create: true });
            break;
        }
    }
    
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return currentName;
}

document.getElementById('image-upload').onchange = async (e) => {
    if (!imageDirHandle) {
        alert('プロジェクトフォルダを開いてから画像を挿入してください。');
        return;
    }
    for (const file of e.target.files) {
        if (!file.type.startsWith('image/')) continue;
        try {
            const savedName = await saveImageFile(file);
            if (savedName) {
                const fileHandle = await imageDirHandle.getFileHandle(savedName);
                const savedFile = await fileHandle.getFile();
                const url = URL.createObjectURL(savedFile);
                
                const imgTag = `<img src="${url}" data-filename="イメージ/${savedName}" alt="${savedName}">`;
                insertBlockElement(imgTag);
            }
        } catch (err) {
            console.error(err);
            alert('画像の保存に失敗しました。');
        }
    }
    e.target.value = '';
    if (currentTab === 'image') renderPanel();
};

async function resolveImageUrls(container) {
    if (!imageDirHandle) return;
    const imgs = container.querySelectorAll('img[data-filename]');
    for (const img of imgs) {
        let path = img.getAttribute('data-filename');
        if (path) path = decodeURIComponent(path);
        if (path && path.startsWith('イメージ/')) {
            const fileName = path.split('/')[1];
            try {
                const fileHandle = await imageDirHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                img.src = URL.createObjectURL(file);
            } catch (e) {
                console.error("画像読み込みエラー:", e);
            }
        }
    }
}

function showImageModal(url) {
    let modal = document.getElementById('image-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <button class="image-modal-close"><i data-lucide="x"></i></button>
            <img src="">
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal || e.target.closest('.image-modal-close')) {
                modal.style.display = 'none';
            }
        };
    }
    modal.querySelector('img').src = url;
    modal.style.display = 'flex';
    lucide.createIcons();
}

window.addEventListener('popstate', (e) => {
    if (e.state) {
        if (currentMode === 'rich') {
            richEditor.scrollTo({ top: e.state.richScroll, behavior: 'smooth' });
        } else {
            mdInput.scrollTo({ top: e.state.mdScroll, behavior: 'smooth' });
        }
    }
});

document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('internal-link')) {
        e.preventDefault();
        const filename = e.target.getAttribute('data-filename');
        openFileByName(filename);
    }
});

richEditor.addEventListener('dragover', (e) => {
    e.preventDefault();
});

richEditor.addEventListener('drop', (e) => {
    const htmlText = e.dataTransfer.getData('text/html');
    const plainText = e.dataTransfer.getData('text/plain');

    if (htmlText && htmlText.includes('data-filename="イメージ/')) {
        e.preventDefault();
        
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            const range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const img = doc.querySelector('img[data-filename]');
        if (img) {
            insertBlockElement(img.outerHTML);
        }
        return;
    }

    if (plainText && (plainText.includes('：') || plainText.startsWith('> **'))) {
        e.preventDefault();
        
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            const range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        if (plainText.startsWith('> **')) {
            const htmlContent = convertMdToHtml(plainText);
            insertBlockElement(htmlContent);
        } else {
            isProgrammaticChange = true;
            try {
                document.execCommand('insertText', false, plainText);
                richEditor.focus();
            } finally {
                requestAnimationFrame(() => {
                    isProgrammaticChange = false;
                    isEdited = true;
                    autoSave();
                });
            }
        }
    }
});

async function openFileByName(targetName) {
    if (!projectHandle) return;
    let searchName = targetName.toLowerCase();
    if (!searchName.endsWith('.md')) searchName += '.md';
    
    for await (const [name, handle] of projectHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase() === searchName) {
            if (currentFileHandle !== handle) {
                if (currentFileHandle && isEdited && !isProgrammaticChange) {
                    let contentToSave = (currentMode === 'rich') ? parseHtmlToMd(richEditor) : mdInput.value;
                    try {
                        const writable = await currentFileHandle.createWritable();
                        await writable.write(contentToSave);
                        await writable.close();
                    } catch (e) { console.error("ファイル切替前の保存失敗:", e); }
                }

                currentFileHandle = handle;
                const file = await handle.getFile();
                lastModifiedTime = file.lastModified;
                const text = await file.text();
                
                mdInput.value = text;
                document.getElementById('current-file-name').textContent = name;
                
                isEdited = false;
                await applyMode(currentMode);
            }
            return;
        }
    }
    alert(`ファイル「${targetName}」が見つかりませんでした。`);
}

const renderer = new marked.Renderer();

renderer.code = function(codeOrToken, infostring, escaped) {
    let code = ''; let language = '';
    if (typeof codeOrToken === 'string') { 
        code = codeOrToken; 
        language = infostring || ''; 
    } 
    else if (codeOrToken && typeof codeOrToken === 'object') { 
        code = codeOrToken.text || ''; 
        language = codeOrToken.lang || ''; 
    }
    
    const langText = language ? `<div class="code-badge">${language}</div>` : '';
    let highlightedCode = code;
    if (language && hljs.getLanguage(language)) { 
        try { highlightedCode = hljs.highlight(code, { language }).value; } catch(e) {} 
    } else { 
        try { highlightedCode = hljs.highlightAuto(code).value; } catch(e) {} 
    }
    
    return `<div class="code-block-wrapper" data-lang="${language}" contenteditable="false">${langText}<pre><code class="hljs language-${language}">${highlightedCode}</code></pre></div>`;
};
marked.use({ renderer, breaks: true, gfm: true });

function convertMdToHtml(mdText) {
    const mathBlocks = [];
    let tempMd = mdText;

    tempMd = tempMd.replace(/\$\$\n?([\s\S]*?)\n?\$\$/g, (m, f) => {
        mathBlocks.push({ tex: f, display: true });
        return `\n\n%%MATH_BLOCK_${mathBlocks.length - 1}%%\n\n`;
    });
    tempMd = tempMd.replace(/\$(.*?)\$/g, (m, f) => {
        mathBlocks.push({ tex: f, display: false });
        return `%%MATH_INLINE_${mathBlocks.length - 1}%%`;
    });

    let html = marked.parse(tempMd);

    html = html.replace(/\[\[(.*?)\]\]/g, (m, filename) => {
        return `<a href="#" class="internal-link" contenteditable="false" data-filename="${filename}">${filename}</a>`;
    });

    html = html.replace(/<img([^>]*)src="([^"]+)"([^>]*)>/gi, (m, before, src, after) => {
        if (m.includes('data-filename=')) return m;
        return `<img${before}src="${src}" data-filename="${src}"${after}>`;
    });

    html = html.replace(/<p>%%MATH_BLOCK_(\d+)%%<\/p>|%%MATH_BLOCK_(\d+)%%/g, (m, p1, p2) => {
        const index = p1 !== undefined ? p1 : p2;
        const item = mathBlocks[index];
        if (typeof katex !== 'undefined') {
            const rendered = katex.renderToString(item.tex, { displayMode: true, throwOnError: false });
            return `<div class="math-block" data-tex="${encodeURIComponent(item.tex)}" contenteditable="false">${rendered}</div>`;
        }
        return `<div class="math-block" data-tex="${encodeURIComponent(item.tex)}" contenteditable="false">$$${item.tex}$$</div>`;
    });
    html = html.replace(/%%MATH_INLINE_(\d+)%%/g, (m, p1) => {
        const item = mathBlocks[p1];
        if (typeof katex !== 'undefined') {
            const rendered = katex.renderToString(item.tex, { displayMode: false, throwOnError: false });
            return `<span class="inline-math" data-tex="${encodeURIComponent(item.tex)}" contenteditable="false">${rendered}</span>`;
        }
        return `<span class="inline-math" data-tex="${encodeURIComponent(item.tex)}" contenteditable="false">$${item.tex}$</span>`;
    });
    return html;
}

function parseHtmlToMd(element, indentLevel = 0) {
    if (!element) return '';
    if (element.nodeType === 3) return element.nodeValue.replace(/\u00A0/g, ' ');

    let md = '';
    const tag = element.tagName ? element.tagName.toLowerCase() : '';

    function getChildrenMd(el, level) {
        let res = '';
        for (let child of el.childNodes) {
            res += parseHtmlToMd(child, level);
        }
        return res;
    }

    if (tag === 'ul' || tag === 'ol') {
        let child = element.firstChild;
        while (child) {
            if (child.nodeType === 1 && child.tagName.toLowerCase() === 'li') {
                md += parseHtmlToMd(child, indentLevel);
            } else if (child.nodeType === 1) {
                const cTag = child.tagName.toLowerCase();
                if (cTag === 'ul' || cTag === 'ol') {
                    let prev = child.previousSibling;
                    while (prev && prev.nodeType === 3 && prev.nodeValue.trim() === '') {
                        prev = prev.previousSibling;
                    }
                    if (prev && prev.nodeType === 1 && prev.tagName.toLowerCase() === 'li') {
                    } else {
                        md += parseHtmlToMd(child, indentLevel);
                    }
                } else {
                    md += parseHtmlToMd(child, indentLevel);
                }
            } else if (child.nodeType === 3) {
                md += parseHtmlToMd(child, indentLevel);
            }
            child = child.nextSibling;
        }
        return indentLevel === 0 ? md + '\n' : md;
    }

    if (tag === 'li') {
        const indent = '  '.repeat(indentLevel);
        let prefix = '- ';

        if (element.parentNode && element.parentNode.tagName.toLowerCase() === 'ol') {
            let index = 1;
            let sibling = element.previousSibling;
            while (sibling) {
                if (sibling.nodeType === 1 && sibling.tagName.toLowerCase() === 'li') index++;
                sibling = sibling.previousSibling;
            }
            prefix = `${index}. `;
        }

        let content = '';
        let nestedLists = '';

        for (let child of element.childNodes) {
            const cTag = child.tagName ? child.tagName.toLowerCase() : '';
            if (cTag === 'ul' || cTag === 'ol') {
                nestedLists += parseHtmlToMd(child, indentLevel + 1);
            } else {
                content += parseHtmlToMd(child, indentLevel);
            }
        }

        let nextSibling = element.nextSibling;
        while (nextSibling) {
            if (nextSibling.nodeType === 3 && nextSibling.nodeValue.trim() === '') {
                nextSibling = nextSibling.nextSibling;
                continue;
            }
            const nsTag = nextSibling.tagName ? nextSibling.tagName.toLowerCase() : '';
            if (nsTag === 'ul' || nsTag === 'ol') {
                nestedLists += parseHtmlToMd(nextSibling, indentLevel + 1);
                nextSibling = nextSibling.nextSibling;
            } else {
                break;
            }
        }

        const cleanContent = content.replace(/^[\n\r]+/, '').replace(/[\n\r]+$/, '').trim();
        md += `${indent}${prefix}${cleanContent}\n`;
        if (nestedLists) md += nestedLists;
        return md;
    }

    if (element.classList && element.classList.contains('math-block')) {
        return '\n\n$$\n' + decodeURIComponent(element.getAttribute('data-tex')) + '\n$$\n\n';
    }
    if (element.classList && element.classList.contains('inline-math')) {
        return '$' + decodeURIComponent(element.getAttribute('data-tex')) + '$';
    }
    if (element.classList && element.classList.contains('internal-link')) {
        return `[[${element.textContent.replace(/\u200B/g, '').trim()}]]`;
    }
    if (element.classList && element.classList.contains('code-block-wrapper')) {
        const lang = element.getAttribute('data-lang') || '';
        const codeEl = element.querySelector('code');
        const codeText = codeEl ? codeEl.textContent.replace(/\n$/, '') : '';
        return '\n\n```' + lang + '\n' + codeText + '\n```\n\n';
    }

    if (tag === 'img') {
        const alt = element.getAttribute('alt') || '';
        let src = element.getAttribute('data-filename') || element.getAttribute('src');
        if (src) src = decodeURIComponent(src);
        return `![${alt}](${src})`;
    }
    
    if (tag === 'h1') return `\n# ${getChildrenMd(element, 0).trim()}\n`;
    if (tag === 'h2') return `\n## ${getChildrenMd(element, 0).trim()}\n`;
    if (tag === 'h3') return `\n### ${getChildrenMd(element, 0).trim()}\n`;
    if (tag === 'b' || tag === 'strong') return `**${getChildrenMd(element, indentLevel)}**`;
    if (tag === 'i' || tag === 'em') return `*${getChildrenMd(element, indentLevel)}*`;
    if (tag === 'strike' || tag === 's') return `~~${getChildrenMd(element, indentLevel)}~~`;
    if (tag === 'code') return `\`${getChildrenMd(element, indentLevel)}\``;
    
    if (tag === 'blockquote') {
        const inner = getChildrenMd(element, 0).trim();
        return `\n> ${inner.replace(/\n/g, '\n> ')}\n`;
    }
    if (tag === 'hr') return `\n---\n`;
    if (tag === 'br') return `\n`;

    if (tag === 'div' || tag === 'p') {
        const content = getChildrenMd(element, indentLevel).trim();
        if (content) {
            let isInsideLi = false;
            let pCheck = element.parentNode;
            while (pCheck && pCheck.id !== 'editor-rich') {
                if (pCheck.tagName === 'LI') { isInsideLi = true; break; }
                pCheck = pCheck.parentNode;
            }
            return isInsideLi ? content : '\n' + content + '\n';
        }
        return '';
    }

    let childrenMd = getChildrenMd(element, indentLevel);

    if (indentLevel === 0 && element.id === 'editor-rich') {
        let res = childrenMd;
        
        res = res.replace(/^(#{1,6} .+|\-\-\-)\n+/gm, '$1\n');
        res = res.replace(/^([ \t]*[-*+] .+)\n\n+([ \t]*[-*+] )/gm, '$1\n$2');
        res = res.replace(/^([ \t]*\d+\. .+)\n\n+([ \t]*\d+\. )/gm, '$1\n$2');
        res = res.replace(/\n{3,}/g, '\n\n');
        res = res.replace(/^\s*\n\s*\n/gm, '\n');

        return res.trim();
    }

    return childrenMd;
}

function parseSmartLinks() {
    const walker = document.createTreeWalker(richEditor, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    while(walker.nextNode()) {
        const node = walker.currentNode;
        let parent = node.parentNode;
        let isProtected = false;
        while(parent && parent !== richEditor) {
            if(parent.tagName === 'CODE' || parent.tagName === 'PRE' || parent.classList.contains('internal-link')) {
                isProtected = true;
                break;
            }
            parent = parent.parentNode;
        }
        if (isProtected) continue;
        
        if (/\[\[(.+?)\]\]/.test(node.nodeValue)) {
            nodesToReplace.push(node);
        }
    }
    
    if (nodesToReplace.length > 0) {
        isProgrammaticChange = true;
        try {
            nodesToReplace.forEach(node => {
                const newHtml = node.nodeValue.replace(/\[\[(.+?)\]\]/g, '<a href="#" class="internal-link" contenteditable="false" data-filename="$1">$1</a>');
                const span = document.createElement('span');
                span.innerHTML = newHtml;
                node.parentNode.replaceChild(span, node);
            });
        } finally {
            requestAnimationFrame(() => {
                isProgrammaticChange = false;
                isEdited = true;
                autoSave();
            });
        }
    }
}

richEditor.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') parseSmartLinks();
});
richEditor.addEventListener('click', () => {
    parseSmartLinks();
});
richEditor.addEventListener('blur', () => {
    parseSmartLinks();
});

async function switchMode(targetMode) {
    if (currentMode === targetMode || isApplyingMode) return;
    
    if (currentFileHandle && isEdited) {
        try {
            const contentToSave = (currentMode === 'rich') ? parseHtmlToMd(richEditor) : mdInput.value;
            const writable = await currentFileHandle.createWritable();
            await writable.write(contentToSave);
            await writable.close();
            const file = await currentFileHandle.getFile();
            lastModifiedTime = file.lastModified;
            isEdited = false;
        } catch (e) {
            console.error("モード切替前の保存失敗:", e);
        }
    }
    
    try {
        if (currentFileHandle) {
            const file = await currentFileHandle.getFile();
            mdInput.value = await file.text();
        } else if (currentMode === 'rich') {
            mdInput.value = parseHtmlToMd(richEditor);
        }
    } catch (e) {
        console.error("ファイル読込エラー:", e);
    }
    
    await applyMode(targetMode);
}

async function applyMode(mode) {
    if (isApplyingMode) return;
    isApplyingMode = true;
    isProgrammaticChange = true;

    try {
        currentMode = mode;
        localStorage.setItem('adrio-mode', mode);
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        
        if (mode === 'rich') {
            document.getElementById('mode-rich').classList.add('active');
            togglePreviewBtn.style.display = 'none';
            floatingToolbar.style.display = 'flex'; 
            richEditor.innerHTML = convertMdToHtml(mdInput.value);
            await resolveImageUrls(richEditor);
            document.getElementById('editor-md-split').style.display = 'none';
            richEditor.style.display = 'block';
        } else {
            document.getElementById('mode-md').classList.add('active');
            togglePreviewBtn.style.display = 'flex';
            floatingToolbar.style.display = 'none'; 
            richEditor.style.display = 'none';
            document.getElementById('editor-md-split').style.display = 'flex';
            updateViewMode();
            await syncPreview();
            updateLineNumbers();
        }
    } catch (e) {
        console.error("モード切替エラー:", e);
    } finally {
        requestAnimationFrame(() => {
            isProgrammaticChange = false;
            isApplyingMode = false;
        });
    }
}

function updateViewMode() {
    const inputArea = document.getElementById('md-input-area');
    const previewArea = document.getElementById('md-preview');
    const resizer = document.getElementById('resizer-md');
    
    if (viewMode === 0) { 
        inputArea.style.display = 'flex';
        inputArea.style.width = '50%';
        previewArea.style.display = 'block';
        previewArea.style.width = 'auto';
        resizer.style.display = 'block';
    } else if (viewMode === 1) { 
        inputArea.style.display = 'flex';
        inputArea.style.width = '100%';
        previewArea.style.display = 'none';
        resizer.style.display = 'none';
    } else { 
        inputArea.style.display = 'none';
        previewArea.style.display = 'block';
        previewArea.style.width = '100%';
        resizer.style.display = 'none';
    }
}

togglePreviewBtn.onclick = () => {
    viewMode = (viewMode + 1) % 3;
    updateViewMode();
};

async function autoSave() {
    if (!currentFileHandle || !isEdited || isProgrammaticChange || isApplyingMode) return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        if (isProgrammaticChange || isApplyingMode) return;
        
        try {
            const content = (currentMode === 'rich') ? parseHtmlToMd(richEditor) : mdInput.value;
            const writable = await currentFileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            
            const file = await currentFileHandle.getFile();
            lastModifiedTime = file.lastModified;
            isEdited = false; 
        } catch (e) { 
            console.error("自動保存エラー:", e); 
        }
    }, 1000);
}

const syncPreview = async () => {
    mdPreview.innerHTML = convertMdToHtml(mdInput.value);
    await resolveImageUrls(mdPreview);
};

window.execCmd = (cmd, val = null) => { 
    isProgramChange = true;
    try {
        document.execCommand(cmd, false, val); 
        richEditor.focus(); 
    } finally {
        requestAnimationFrame(() => {
            isProgrammaticChange = false;
            isEdited = true;
            autoSave();
        });
    }
};

window.insertMathBlock = () => {
    insertBlockElement('$$<br><br>$$');
};

window.insertInternalLink = () => {
    const name = prompt('リンク先のファイル名を入力してください（拡張子不要）:');
    if (name) {
        insertBlockElement(`<a href="#" class="internal-link" contenteditable="false" data-filename="${name}">${name}</a>`);
    }
};

richEditor.addEventListener('input', (e) => {
    if (isProgrammaticChange || isApplyingMode) return;
    
    if (currentMode === 'rich') { 
        isEdited = true; 
        autoSave(); 
    }
    
    const selection = window.getSelection();
    if (!selection.focusNode) return;
    let node = selection.focusNode;
    if (node.nodeType === 3) {
        let text = node.nodeValue;

        const matchBlock = text.match(/^([\s\u00A0]*)(#{1,3}|>|\-|\*|1\.)\s$/);
        if (matchBlock && selection.focusOffset === text.length) {
            isProgrammaticChange = true;
            try {
                const trigger = matchBlock[2];
                node.nodeValue = ''; 
                let block = node;
                while (block && block !== richEditor && !['DIV', 'P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI'].includes(block.tagName)) {
                    block = block.parentNode;
                }
                if (!block || block === richEditor) block = node.parentNode;

                let newTag = '';
                if (trigger === '#') newTag = 'H1';
                else if (trigger === '##') newTag = 'H2';
                else if (trigger === '###') newTag = 'H3';
                else if (trigger === '>') newTag = 'BLOCKQUOTE';
                
                if (newTag) {
                    const el = document.createElement(newTag);
                    while(block.firstChild) el.appendChild(block.firstChild);
                    block.parentNode.insertBefore(el, block);
                    block.remove();
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else if (trigger === '-' || trigger === '*') {
                    document.execCommand('insertUnorderedList', false, null);
                } else if (trigger === '1.') {
                    document.execCommand('insertOrderedList', false, null);
                }
            } finally {
                requestAnimationFrame(() => {
                    isProgrammaticChange = false;
                    isEdited = true;
                    autoSave();
                });
            }
            return;
        }

        let modified = false;
        let newHtml = text;
        if (/\*\*(.+?)\*\*/.test(newHtml)) { newHtml = newHtml.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); modified = true; } 
        else if (/\*(.+?)\*/.test(newHtml) && !/\*\*/.test(text)) { newHtml = newHtml.replace(/\*(.+?)\*/g, '<i>$1</i>'); modified = true; }
        if (/~~(.+?)~~/.test(newHtml)) { newHtml = newHtml.replace(/~~(.+?)~~/g, '<strike>$1</strike>'); modified = true; }
        if (/`([^`]+)`/.test(newHtml)) { newHtml = newHtml.replace(/`([^`]+)`/g, '<code>$1</code>'); modified = true; }

        if (modified) {
            isProgrammaticChange = true;
            try {
                const span = document.createElement('span');
                span.innerHTML = newHtml;
                node.parentNode.replaceChild(span, node);
                const range = document.createRange();
                range.selectNodeContents(span);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            } finally {
                requestAnimationFrame(() => {
                    isProgrammaticChange = false;
                    isEdited = true;
                    autoSave();
                });
            }
        }
    }
});

richEditor.addEventListener('keydown', (e) => {
    if (currentMode !== 'rich') return;
    
    if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection.isCollapsed) {
            let node = selection.focusNode;
            let offset = selection.focusOffset;

            if (node && node.nodeType === 3 && offset >= 2) {
                const textBefore = node.nodeValue.substring(offset - 2, offset);
                if (textBefore === '  ' || textBefore === '\u00A0\u00A0' || textBefore === ' \u00A0' || textBefore === '\u00A0 ') {
                    e.preventDefault();
                    isProgrammaticChange = true;
                    try {
                        node.nodeValue = node.nodeValue.substring(0, offset - 2) + node.nodeValue.substring(offset);
                        const range = document.createRange();
                        range.setStart(node, offset - 2);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } finally {
                        requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
                    }
                    return;
                }
            }

            let lineNode = node;
            if (lineNode && lineNode.nodeType === 3) lineNode = lineNode.parentNode;
            while (lineNode && lineNode !== richEditor && !['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(lineNode.tagName)) {
                lineNode = lineNode.parentNode;
            }
            
            if (lineNode && lineNode !== richEditor) {
                const text = lineNode.textContent.replace(/[\u200B-\u200D\uFEFF\n]/g, '').trim();
                
                if (lineNode.tagName === 'LI' && text === '') {
                    e.preventDefault();
                    isProgrammaticChange = true;
                    try {
                        const parentList = lineNode.parentNode;
                        if (parentList.parentNode && parentList.parentNode.tagName === 'LI') {
                            document.execCommand('outdent', false, null);
                            return;
                        }

                        let listRoot = lineNode;
                        while (listRoot.parentNode && ['UL', 'OL', 'LI'].includes(listRoot.parentNode.tagName)) { listRoot = listRoot.parentNode; }
                        const newDiv = document.createElement('div');
                        newDiv.innerHTML = '<br>';
                        listRoot.parentNode.insertBefore(newDiv, listRoot.nextSibling);
                        lineNode.remove();
                        richEditor.querySelectorAll('ul:empty, ol:empty').forEach(el => el.remove());
                        const range = document.createRange();
                        range.selectNodeContents(newDiv);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } finally {
                        requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
                    }
                    return;
                }
                
                if (lineNode.tagName === 'BLOCKQUOTE' && text === '') {
                    e.preventDefault();
                    isProgrammaticChange = true;
                    try {
                        const newDiv = document.createElement('div');
                        newDiv.innerHTML = '<br>';
                        lineNode.parentNode.parentNode.insertBefore(newDiv, lineNode.parentNode.nextSibling);
                        lineNode.remove(); 
                        if (lineNode.parentNode.textContent.trim() === '') lineNode.parentNode.remove();
                        const range = document.createRange();
                        range.selectNodeContents(newDiv);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } finally {
                        requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
                    }
                    return;
                }
            }
        }
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        isProgrammaticChange = true;
        try {
            const selection = window.getSelection();
            let node = selection.focusNode;
            let isList = false;
            while (node && node !== richEditor) {
                if (node.tagName === 'LI') { isList = true; break; }
                node = node.parentNode;
            }
            
            if (isList) {
                if (e.shiftKey) document.execCommand('outdent', false, null);
                else document.execCommand('indent', false, null);
            } else {
                document.execCommand('insertText', false, '  ');
            }
        } finally {
            requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
        }
        return;
    }
    
    if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (!selection.focusNode) return;
        if (e.shiftKey) {
            let block = selection.focusNode;
            while (block && block !== richEditor && !['BLOCKQUOTE', 'UL', 'OL', 'H1', 'H2', 'H3'].includes(block.tagName)) { block = block.parentNode; }
            if (block && block !== richEditor) {
                e.preventDefault();
                isProgrammaticChange = true;
                try {
                    const newDiv = document.createElement('div');
                    newDiv.innerHTML = '<br>';
                    block.parentNode.insertBefore(newDiv, block.nextSibling);
                    const range = document.createRange();
                    range.selectNodeContents(newDiv);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } finally {
                    requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
                }
                return;
            }
        } else {
            let lineNode = selection.focusNode;
            if (lineNode && lineNode.nodeType === 3) lineNode = lineNode.parentNode;
            while (lineNode && lineNode !== richEditor && !['DIV', 'P', 'LI', 'H1', 'H2', 'H3'].includes(lineNode.tagName)) { lineNode = lineNode.parentNode; }
            
            if (lineNode && lineNode !== richEditor) {
                const text = lineNode.textContent.replace(/[\u200B-\u200D\uFEFF\n]/g, '').trim();
                if (lineNode.tagName === 'LI') {
                    if (text === '') {
                        e.preventDefault();
                        isProgrammaticChange = true;
                        try {
                            const parentList = lineNode.parentNode;
                            if (parentList.parentNode && parentList.parentNode.tagName === 'LI') {
                                document.execCommand('outdent', false, null);
                                return;
                            }

                            let listRoot = lineNode;
                            while (listRoot.parentNode && ['UL', 'OL', 'LI'].includes(listRoot.parentNode.tagName)) { listRoot = listRoot.parentNode; }
                            const newDiv = document.createElement('div');
                            newDiv.innerHTML = '<br>';
                            listRoot.parentNode.insertBefore(newDiv, listRoot.nextSibling);
                            lineNode.remove();
                            richEditor.querySelectorAll('ul:empty, ol:empty').forEach(el => el.remove());
                            const range = document.createRange();
                            range.selectNodeContents(newDiv);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        } finally {
                            requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
                        }
                        return;
                    }
                } else {
                    let bq = lineNode.parentNode;
                    while (bq && bq !== richEditor && bq.tagName !== 'BLOCKQUOTE') { bq = bq.parentNode; }
                    if (bq && bq.tagName === 'BLOCKQUOTE') {
                        if (text === '') {
                            e.preventDefault();
                            isProgrammaticChange = true;
                            try {
                                const newDiv = document.createElement('div');
                                newDiv.innerHTML = '<br>';
                                bq.parentNode.insertBefore(newDiv, bq.nextSibling);
                                lineNode.remove(); 
                                if (bq.textContent.trim() === '') bq.remove();
                                const range = document.createRange();
                                range.selectNodeContents(newDiv);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            } finally {
                                requestAnimationFrame(() => { isProgrammaticChange = false; isEdited = true; autoSave(); });
                            }
                            return;
                        }
                    }
                }
            }
        }
    }
});

mdInput.addEventListener('keydown', (e) => {
    if (currentMode !== 'md') return;
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = mdInput.selectionStart;
        const end = mdInput.selectionEnd;
        mdInput.value = mdInput.value.substring(0, start) + '  ' + mdInput.value.substring(end);
        mdInput.selectionStart = mdInput.selectionEnd = start + 2;
        isEdited = true;
        syncPreview();
        updateLineNumbers();
        autoSave();
    }
    if (e.key === 'Enter') {
        const start = mdInput.selectionStart;
        const end = mdInput.selectionEnd;
        const value = mdInput.value;
        const currentLineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(currentLineStart, start);
        const emptyMarkerMatch = currentLine.match(/^([ \t]*)([\-\*\>]|\d+\.)\s*$/);
        if (emptyMarkerMatch) {
            e.preventDefault();
            mdInput.value = value.substring(0, currentLineStart) + value.substring(end);
            mdInput.selectionStart = mdInput.selectionEnd = currentLineStart;
            isEdited = true;
            syncPreview();
            updateLineNumbers();
            autoSave();
            return;
        }
        const markerMatch = currentLine.match(/^([ \t]*)([\-\*\>]|\d+\.)\s+/);
        if (markerMatch) {
            e.preventDefault();
            const indent = markerMatch[1];
            let marker = markerMatch[2];
            if (/\d+\./.test(marker)) {
                const num = parseInt(marker, 10);
                marker = (num + 1) + '.';
            }
            const insertText = '\n' + indent + marker + ' ';
            mdInput.value = value.substring(0, start) + insertText + value.substring(end);
            mdInput.selectionStart = mdInput.selectionEnd = start + insertText.length;
            isEdited = true;
            syncPreview();
            updateLineNumbers();
            autoSave();
            return;
        }
        const emptyMatch = currentLine.match(/^([ \t]+)$/);
        if (emptyMatch && emptyMatch[1].length > 0) {
            e.preventDefault();
            const newIndent = emptyMatch[1].substring(2);
            mdInput.value = value.substring(0, currentLineStart) + newIndent + value.substring(start);
            mdInput.selectionStart = mdInput.selectionEnd = currentLineStart + newIndent.length;
            isEdited = true;
            syncPreview();
            updateLineNumbers();
            autoSave();
            return;
        }
        e.preventDefault();
        const indentMatch = currentLine.match(/^([ \t]+)/);
        const indent = indentMatch ? indentMatch[1] : '';
        mdInput.value = value.substring(0, start) + '\n' + indent + value.substring(end);
        mdInput.selectionStart = mdInput.selectionEnd = start + 1 + indent.length;
        isEdited = true;
        syncPreview();
        updateLineNumbers();
        autoSave();
    }
});

mdInput.addEventListener('input', () => { 
    if (isProgrammaticChange || isApplyingMode) return;
    if (currentMode === 'md') { 
        isEdited = true; 
        syncPreview(); 
        updateLineNumbers(); 
        autoSave(); 
    } 
});

function updateLineNumbers() {
    const lines = mdInput.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
}

let isSyncingLeft = false;
let isSyncingRight = false;
mdInput.onscroll = () => { 
    lineNumbers.scrollTop = mdInput.scrollTop; 
    if (!isSyncingLeft && mdPreview.style.display !== 'none') {
        isSyncingRight = true;
        const percentage = mdInput.scrollTop / (mdInput.scrollHeight - mdInput.clientHeight);
        mdPreview.scrollTop = percentage * (mdPreview.scrollHeight - mdPreview.clientHeight);
    }
    isSyncingLeft = false;
};
mdPreview.onscroll = () => {
    if (!isSyncingRight) {
        isSyncingLeft = true;
        const percentage = mdPreview.scrollTop / (mdPreview.scrollHeight - mdPreview.clientHeight);
        mdInput.scrollTop = percentage * (mdInput.scrollHeight - mdInput.clientHeight);
    }
    isSyncingRight = false;
};

async function refreshFileTree() {
    const tree = document.getElementById('file-tree'); tree.innerHTML = '';
    for await (const [name, handle] of projectHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.md')) {
            const container = document.createElement('div');
            container.className = 'file-item-container';
            
            const header = document.createElement('div');
            header.className = 'file-item-header';
            
            const toggleIconWrap = document.createElement('div');
            toggleIconWrap.className = 'file-toggle-icon-wrap';
            
            const toggleIcon = document.createElement('i');
            toggleIcon.setAttribute('data-lucide', 'chevron-right');
            toggleIcon.className = 'file-toggle-icon';
            toggleIconWrap.appendChild(toggleIcon);
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-name-text';
            nameSpan.textContent = name;
            
            header.appendChild(toggleIconWrap);
            header.appendChild(nameSpan);

            const childrenArea = document.createElement('div');
            childrenArea.className = 'file-children';

            toggleIconWrap.onclick = (e) => {
                e.stopPropagation();
                container.classList.toggle('open');
                if (container.classList.contains('open') && childrenArea.childNodes.length === 0) {
                    handle.getFile().then(file => file.text()).then(text => {
                        renderSubHeaders(text, childrenArea);
                    });
                }
            };

            nameSpan.onclick = async (e) => {
                e.stopPropagation();
                if (currentFileHandle !== handle) {
                    if (currentFileHandle && isEdited && !isProgrammaticChange) {
                        let contentToSave = (currentMode === 'rich') ? parseHtmlToMd(richEditor) : mdInput.value;
                        try {
                            const writable = await currentFileHandle.createWritable();
                            await writable.write(contentToSave);
                            await writable.close();
                        } catch (e) { console.error(e); }
                    }

                    currentFileHandle = handle;
                    const file = await handle.getFile();
                    lastModifiedTime = file.lastModified;
                    const text = await file.text();
                    
                    mdInput.value = text;
                    document.getElementById('current-file-name').textContent = name;
                    
                    isEdited = false;
                    await applyMode(currentMode); 
                    
                    if (childrenArea.childNodes.length === 0) {
                        renderSubHeaders(text, childrenArea);
                    }
                    container.classList.add('open');
                }
            };

            container.appendChild(header);
            container.appendChild(childrenArea);
            tree.appendChild(container);
        }
    }
    lucide.createIcons();
}

function renderSubHeaders(text, container) {
    container.innerHTML = '';
    const lines = text.split('\n');
    const root = document.createElement('div');
    const stack = [{ level: 0, element: root }];
    let headerIndex = 0;
    lines.forEach((line, idx) => {
        const match = line.match(/^(#{1,6})\s+(.*)/);
        if (match) {
            const level = match[1].length;
            const title = match[2];
            const currentHeaderIndex = headerIndex++;
            const wrapper = document.createElement('div');
            wrapper.className = 'tree-item-wrapper';
            const item = document.createElement('div');
            item.className = 'tree-item-header';
            item.style.paddingLeft = `${(level - 1) * 12 + 8}px`;
            const toggleSpan = document.createElement('span');
            toggleSpan.className = 'tree-toggle';
            toggleSpan.innerHTML = '▼';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'tree-title';
            titleSpan.textContent = title;
            item.appendChild(toggleSpan);
            item.appendChild(titleSpan);

            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            childrenContainer.style.display = 'block';

            titleSpan.onclick = (e) => {
                e.stopPropagation();
                history.pushState({ richScroll: richEditor.scrollTop, mdScroll: mdInput.scrollTop }, "");
                if (currentMode === 'md') {
                    const pos = text.split('\n').slice(0, idx).join('\n').length;
                    mdInput.focus(); mdInput.setSelectionRange(pos, pos);
                    mdInput.scrollTo({ top: Math.max(0, (idx * 19.6) - 60), behavior: 'smooth' });
                } else {
                    const headers = richEditor.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    if (headers[currentHeaderIndex]) {
                        const target = headers[currentHeaderIndex];
                        const editorRect = richEditor.getBoundingClientRect();
                        const targetRect = target.getBoundingClientRect();
                        const scrollPos = targetRect.top - editorRect.top + richEditor.scrollTop;
                        const centerPos = scrollPos - (editorRect.height / 2) + (targetRect.height / 2);
                        richEditor.scrollTo({ top: Math.max(0, centerPos), behavior: 'smooth' });
                        target.classList.remove('flash-highlight');
                        void target.offsetWidth; 
                        target.classList.add('flash-highlight');
                    }
                }
            };

            toggleSpan.onclick = (e) => {
                e.stopPropagation();
                const isClosed = childrenContainer.style.display === 'none';
                childrenContainer.style.display = isClosed ? 'block' : 'none';
                toggleSpan.innerHTML = isClosed ? '▼' : '▶';
            };
            wrapper.appendChild(item);
            wrapper.appendChild(childrenContainer);
            while (stack.length > 1 && stack[stack.length - 1].level >= level) { stack.pop(); }
            const parent = stack[stack.length - 1];
            parent.element.appendChild(wrapper);
            stack.push({ level: level, element: childrenContainer });
        }
    });

    const allWrappers = root.querySelectorAll('.tree-item-wrapper');
    allWrappers.forEach(w => {
        const childrenArea = w.querySelector('.tree-children');
        if (childrenArea.childNodes.length === 0) {
            w.querySelector('.tree-toggle').style.visibility = 'hidden';
        }
    });
    container.appendChild(root);
}

async function saveCardData(fileName, dataObj, dirHandle) {
    try {
        const h = await dirHandle.getFileHandle(`${fileName}.json`, {create:true});
        const w = await h.createWritable();
        await w.write(JSON.stringify(dataObj, null, 2));
        await w.close();
    } catch(e) { console.error("Card save error:", e); }
}

async function renderPanel() {
    const content = document.getElementById('panel-content'); 
    content.innerHTML = '';
    
    const newBtnContainer = document.querySelector('.new-card-btn-container');
    if (newBtnContainer) {
        newBtnContainer.style.display = (currentTab === 'image') ? 'none' : 'block';
    }

    if (currentTab === 'image') {
        await renderImagePanel();
        return;
    }
    
    const dir = (currentTab === 'chara') ? charaDirHandle : memoDirHandle;
    if (!dir) return;
    for await (const entry of dir.values()) {
        if (entry.name.endsWith('.json')) {
            const file = await entry.getFile();
            try {
                const data = JSON.parse(await file.text());
                content.appendChild(createDataCard(data, entry, dir));
            } catch(e) {}
        }
    }
    lucide.createIcons();
}

async function renderImagePanel() {
    const content = document.getElementById('panel-content');
    content.innerHTML = `
        <div id="image-drop-zone" class="image-drop-zone">
            ここに画像をドロップして追加<br>
            <span style="font-size:10px; color:var(--text-faint);">またはクリックで選択</span>
        </div>
        <div class="image-list" id="image-list-container"></div>
    `;
    
    const dropZone = document.getElementById('image-drop-zone');
    dropZone.onclick = () => document.getElementById('image-upload').click();
    
    dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = e => { dropZone.classList.remove('dragover'); };
    dropZone.ondrop = async e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (const file of e.dataTransfer.files) {
                if (file.type.startsWith('image/')) {
                    await saveImageFile(file);
                }
            }
            renderPanel();
        }
    };

    if (!imageDirHandle) return;
    const listContainer = document.getElementById('image-list-container');
    for await (const entry of imageDirHandle.values()) {
        if (entry.kind === 'file') {
            const ext = entry.name.toLowerCase();
            if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.webp')) {
                try {
                    const file = await entry.getFile();
                    const url = URL.createObjectURL(file);
                    
                    const item = document.createElement('div');
                    item.className = 'image-item';
                    item.draggable = true;
                    item.innerHTML = `
                        <div class="image-item-actions">
                            <button class="image-delete-btn" title="削除"><i data-lucide="trash-2"></i></button>
                        </div>
                        <img src="${url}"><span>${entry.name}</span>
                    `;
                    
                    item.ondragstart = (e) => {
                        const mdText = `![${entry.name}](イメージ/${entry.name})`;
                        const htmlText = `<img src="${url}" data-filename="イメージ/${entry.name}" alt="${entry.name}">`;
                        e.dataTransfer.setData('text/plain', mdText);
                        e.dataTransfer.setData('text/html', htmlText);
                        e.dataTransfer.effectAllowed = 'copy';
                    };
                    
                    item.onclick = (e) => {
                        if (!e.target.closest('.image-delete-btn')) {
                            showImageModal(url);
                        }
                    };

                    const delBtn = item.querySelector('.image-delete-btn');
                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        if (confirm(`画像「${entry.name}」を削除しますか？`)) {
                            try {
                                await imageDirHandle.removeEntry(entry.name);
                                renderPanel();
                            } catch (err) {
                                console.error(err);
                                alert('画像の削除に失敗しました。');
                            }
                        }
                    };
                    
                    listContainer.appendChild(item);
                } catch(e) {}
            }
        }
    }
}

document.getElementById('show-editor-btn').onclick = async () => {
    const isChar = currentTab === 'chara';
    const newData = isChar ? {
        kind: "character",
        data: { name: "", displayName: "", memo: "", status: [], params: [] }
    } : {
        title: "", memo: ""
    };
    const dir = isChar ? charaDirHandle : memoDirHandle;
    if (dir) {
        const content = document.getElementById('panel-content');
        const newCard = createDataCard(newData, null, dir);
        content.insertBefore(newCard, content.firstChild);
    }
};

function createDataCard(data, handle, dirHandle) {
    const card = document.createElement('details'); 
    card.className = 'data-card'; 
    let isEditingCard = !handle; 
    
    const isChar = data.kind === "character"; 
    const d = isChar ? data.data : data;
    if (isChar) {
        if (!d.status) d.status = [];
        if (!d.params) d.params = [];
    }
    
    let currentHandle = handle;
    let currentFileName = handle ? handle.name.replace('.json', '') : '';

    const renderCardContent = () => {
        card.innerHTML = '';
        const fullName = d.name || "";
        const displayName = d.displayName || fullName || d.title || currentFileName || (isChar ? "新規キャラクター" : "新規メモ");

        card.draggable = !isEditingCard;
        card.ondragstart = (e) => {
            if (isEditingCard) return e.preventDefault();
            e.dataTransfer.setData('text/plain', isChar ? `${displayName}：` : `> **${displayName}**\n> ${d.memo || d.details || ""}\n\n`);
        };
        
        const sum = document.createElement('summary'); 
        sum.innerHTML = `
            <input type="text" class="card-title-input" value="${displayName}" placeholder="表示名">
            <div class="card-actions">
                ${isEditingCard && currentHandle ? `<button class="del-btn" title="カードを削除"><i data-lucide="trash-2"></i></button>` : ''}
                <button class="settings-btn" title="${isEditingCard ? '完了' : '設定編集'}"><i data-lucide="${isEditingCard ? 'check' : 'settings'}"></i></button>
                <i data-lucide="chevron-down" class="details-toggle-icon"></i>
            </div>
        `;
        
        sum.querySelector('.settings-btn').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isEditingCard && !currentHandle) {
                sum.querySelector('.card-title-input').dispatchEvent(new Event('change'));
            }
            isEditingCard = !isEditingCard;
            renderCardContent();
        };

        const titleInput = sum.querySelector('.card-title-input');
        titleInput.onclick = (e) => e.stopPropagation(); 
        titleInput.onchange = async () => {
            let newVal = titleInput.value.trim();
            if (isChar) {
                d.displayName = newVal;
            } else {
                d.title = newVal;
            }
            
            let baseName = newVal;
            if (!isChar && !baseName) baseName = "774";
            if (isChar && !baseName) baseName = "新規キャラクター";
            
            baseName = baseName.replace(/[\\/:*?"<>|]/g, '_');
            
            let targetName = baseName;
            let counter = 1;
            
            if (targetName !== currentFileName || !currentHandle) {
                while (true) {
                    try {
                        await dirHandle.getFileHandle(`${targetName}.json`, { create: false });
                        targetName = `${baseName}(${counter})`;
                        counter++;
                    } catch (err) {
                        break;
                    }
                }
                
                await saveCardData(targetName, data, dirHandle);
                
                if (currentHandle) {
                    try {
                        await dirHandle.removeEntry(currentHandle.name);
                    } catch(e) { console.error("Old file remove error:", e); }
                }
                
                currentHandle = await dirHandle.getFileHandle(`${targetName}.json`);
                currentFileName = targetName;
                
                renderPanel();
            } else {
                await saveCardData(currentFileName, data, dirHandle);
            }
        };

        if (isEditingCard && currentHandle) {
            sum.querySelector('.del-btn').onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('このカードを削除しますか？')) {
                    if (currentHandle && dirHandle) await dirHandle.removeEntry(currentHandle.name);
                    renderPanel();
                }
            };
        }
        
        card.appendChild(sum);

        const body = document.createElement('div'); 
        body.className = 'card-content';

        if (isChar) {
            if (isEditingCard) {
                const presetRow = document.createElement('div');
                presetRow.className = 'preset-buttons';
                presetRow.innerHTML = `
                    <button class="preset-btn" id="preset-coc6">CoC 6版</button>
                    <button class="preset-btn" id="preset-coc7">CoC 7版</button>
                `;
                presetRow.querySelector('#preset-coc6').onclick = async () => {
                    if(confirm("現在のステータスをCoC 6版に上書きしますか？")) {
                        d.status = [{label:"HP", value:10, max:10}, {label:"MP", value:10, max:10}, {label:"SAN", value:50, max:50}];
                        d.params = [{label:"STR", value:10}, {label:"CON", value:10}, {label:"POW", value:10}, {label:"DEX", value:10}, {label:"APP", value:10}, {label:"SIZ", value:10}, {label:"INT", value:10}, {label:"EDU", value:10}];
                        if (currentHandle) await saveCardData(currentFileName, data, dirHandle);
                        renderCardContent();
                    }
                };
                presetRow.querySelector('#preset-coc7').onclick = async () => {
                    if(confirm("現在のステータスをCoC 7版に上書きしますか？")) {
                        d.status = [{label:"HP", value:10, max:10}, {label:"MP", value:10, max:10}, {label:"SAN", value:50, max:99}, {label:"幸運", value:50, max:99}];
                        d.params = [{label:"STR", value:50}, {label:"CON", value:50}, {label:"POW", value:50}, {label:"DEX", value:50}, {label:"APP", value:50}, {label:"SIZ", value:50}, {label:"INT", value:50}, {label:"EDU", value:50}, {label:"移動力", value:8}];
                        if (currentHandle) await saveCardData(currentFileName, data, dirHandle);
                        renderCardContent();
                    }
                };
                body.appendChild(presetRow);

                const nameRow = document.createElement('div');
                nameRow.innerHTML = `<input type="text" class="card-full-name-input" value="${fullName}" placeholder="本名 (フルネーム)">`;
                const nameInput = nameRow.querySelector('input');
                nameInput.onchange = async () => { d.name = nameInput.value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                body.appendChild(nameRow);

                const statEditWrap = document.createElement('div');
                statEditWrap.className = 'edit-mode-container';
                d.status.forEach((s, i) => {
                    const row = document.createElement('div'); row.className = 'edit-item-row';
                    row.innerHTML = `
                        <div class="move-btns">
                            <button class="move-btn move-up" title="上へ"><i data-lucide="chevron-up"></i></button>
                            <button class="move-btn move-down" title="下へ"><i data-lucide="chevron-down"></i></button>
                        </div>
                        <input type="text" class="edit-input edit-input-label" value="${s.label}" placeholder="項目名">
                        <input type="number" class="edit-input edit-input-num" value="${s.max}" placeholder="最大値">
                        <button class="remove-item-btn" title="削除"><i data-lucide="x"></i></button>
                    `;
                    const inputs = row.querySelectorAll('input');
                    inputs[0].onchange = async () => { d.status[i].label = inputs[0].value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                    inputs[1].onchange = async () => { d.status[i].max = Number(inputs[1].value); if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                    row.querySelector('.remove-item-btn').onclick = async () => { d.status.splice(i, 1); if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent(); };
                    
                    row.querySelector('.move-up').onclick = async (e) => {
                        e.preventDefault();
                        if (i > 0) {
                            const temp = d.status[i]; d.status[i] = d.status[i - 1]; d.status[i - 1] = temp;
                            if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent();
                        }
                    };
                    row.querySelector('.move-down').onclick = async (e) => {
                        e.preventDefault();
                        if (i < d.status.length - 1) {
                            const temp = d.status[i]; d.status[i] = d.status[i + 1]; d.status[i + 1] = temp;
                            if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent();
                        }
                    };
                    statEditWrap.appendChild(row);
                });
                const addStatBtn = document.createElement('button'); addStatBtn.className = 'add-item-btn'; addStatBtn.innerHTML = '+ ステータス(現在/最大) を追加';
                addStatBtn.onclick = async () => { d.status.push({label:"New", value:10, max:10}); if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent(); };
                statEditWrap.appendChild(addStatBtn);
                body.appendChild(statEditWrap);

                const paramEditWrap = document.createElement('div');
                paramEditWrap.className = 'edit-mode-container';
                d.params.forEach((p, i) => {
                    const row = document.createElement('div'); row.className = 'edit-item-row';
                    row.innerHTML = `
                        <div class="move-btns">
                            <button class="move-btn move-up" title="上へ"><i data-lucide="chevron-up"></i></button>
                            <button class="move-btn move-down" title="下へ"><i data-lucide="chevron-down"></i></button>
                        </div>
                        <input type="text" class="edit-input edit-input-label" value="${p.label}" placeholder="項目名">
                        <input type="text" class="edit-input edit-input-num" value="${p.value}" placeholder="数値">
                        <button class="remove-item-btn" title="削除"><i data-lucide="x"></i></button>
                    `;
                    const inputs = row.querySelectorAll('input');
                    inputs[0].onchange = async () => { d.params[i].label = inputs[0].value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                    inputs[1].onchange = async () => { d.params[i].value = inputs[1].value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                    row.querySelector('.remove-item-btn').onclick = async () => { d.params.splice(i, 1); if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent(); };
                    
                    row.querySelector('.move-up').onclick = async (e) => {
                        e.preventDefault();
                        if (i > 0) {
                            const temp = d.params[i]; d.params[i] = d.params[i - 1]; d.params[i - 1] = temp;
                            if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent();
                        }
                    };
                    row.querySelector('.move-down').onclick = async (e) => {
                        e.preventDefault();
                        if (i < d.params.length - 1) {
                            const temp = d.params[i]; d.params[i] = d.params[i + 1]; d.params[i + 1] = temp;
                            if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent();
                        }
                    };
                    paramEditWrap.appendChild(row);
                });
                const addParamBtn = document.createElement('button'); addParamBtn.className = 'add-item-btn'; addParamBtn.innerHTML = '+ 能力値(単一) を追加';
                addParamBtn.onclick = async () => { d.params.push({label:"New", value:"10"}); if(currentHandle) await saveCardData(currentFileName, data, dirHandle); renderCardContent(); };
                paramEditWrap.appendChild(addParamBtn);
                body.appendChild(paramEditWrap);

            } else {
                if (fullName && fullName !== displayName) {
                    body.innerHTML += `<div class="char-full-name">${fullName}</div>`;
                }

                if (d.status.length > 0) {
                    const statWrap = document.createElement('div');
                    statWrap.className = 'char-status-row';
                    d.status.forEach((s, i) => {
                        const box = document.createElement('div'); box.className = 'status-item';
                        box.innerHTML = `<span class="status-label">${s.label}</span><input type="number" class="status-input" value="${s.value}"><span class="status-max">/ ${s.max || '-'}</span>`;
                        const input = box.querySelector('input');
                        input.onclick = (e) => e.stopPropagation();
                        input.onchange = async () => { d.status[i].value = Number(input.value); if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                        statWrap.appendChild(box);
                    });
                    body.appendChild(statWrap);
                }

                if (d.params.length > 0) {
                    const paramWrap = document.createElement('div');
                    paramWrap.className = 'char-params-grid';
                    d.params.forEach((p, i) => {
                        const box = document.createElement('div'); box.className = 'param-box';
                        box.innerHTML = `<span class="param-label">${p.label}</span><input type="text" class="param-val-input" value="${p.value}">`;
                        const input = box.querySelector('input');
                        input.onclick = (e) => e.stopPropagation();
                        input.onchange = async () => { d.params[i].value = input.value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
                        paramWrap.appendChild(box);
                    });
                    body.appendChild(paramWrap);
                }
            }

            const cmdWrap = document.createElement('div');
            cmdWrap.className = 'char-commands-wrap';
            cmdWrap.style.marginTop = '12px';
            cmdWrap.innerHTML = `
                <div class="cmd-header">チャットパレット ${!isEditingCard ? `<button class="copy-cmd-btn" title="コピー"><i data-lucide="copy"></i></button>` : ''}</div>
                <textarea class="cmd-textarea" ${!isEditingCard ? 'readonly' : ''} placeholder="ダイスコード等...">${d.commands || ""}</textarea>
            `;
            if (!isEditingCard && d.commands) {
                cmdWrap.querySelector('.copy-cmd-btn').onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(d.commands);
                    const icon = cmdWrap.querySelector('.copy-cmd-btn i');
                    icon.setAttribute('data-lucide', 'check'); lucide.createIcons();
                    setTimeout(() => { icon.setAttribute('data-lucide', 'copy'); lucide.createIcons(); }, 2000);
                };
            }
            const cmdTextarea = cmdWrap.querySelector('.cmd-textarea');
            cmdTextarea.onclick = (e) => e.stopPropagation();
            cmdTextarea.onchange = async () => { d.commands = cmdTextarea.value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
            body.appendChild(cmdWrap);
        }
        
        const memoWrap = document.createElement('div');
        memoWrap.innerHTML = `<textarea class="card-memo-input" placeholder="メモ...">${d.memo || d.details || ""}</textarea>`;
        const memoInput = memoWrap.querySelector('textarea');
        memoInput.onclick = (e) => e.stopPropagation();
        memoInput.onchange = async () => { d.memo = memoInput.value; if(currentHandle) await saveCardData(currentFileName, data, dirHandle); };
        body.appendChild(memoWrap);

        card.appendChild(body); 
        lucide.createIcons();
        if(isEditingCard) card.open = true; 
    };

    renderCardContent();
    return card;
}

window.onfocus = async () => {
    if (!currentFileHandle) return;
    try {
        const file = await currentFileHandle.getFile();
        if (file.lastModified > lastModifiedTime) {
            const text = await file.text();
            lastModifiedTime = file.lastModified;
            
            mdInput.value = text;
            await applyMode(currentMode);
        }
    } catch (e) {}
};

async function setupProject(handle) {
    projectHandle = handle; 
    document.getElementById('project-name-display').textContent = handle.name;
    console.log(`[Adrio-Debug] Project Load: ${handle.name}`);
    
    try {
        await idbKeyval.set('adrio-project-handle', handle);
    } catch (e) {}

    charaDirHandle = await projectHandle.getDirectoryHandle('キャラ', {create:true});
    memoDirHandle = await projectHandle.getDirectoryHandle('データ', {create:true});
    imageDirHandle = await projectHandle.getDirectoryHandle('イメージ', {create:true});
    
    await refreshFileTree(); 
    renderPanel();
}

document.getElementById('open-folder-btn').onclick = async () => { try { await setupProject(await window.showDirectoryPicker()); } catch(e){} };

// ---------- PDF出力モーダル＆ロジック ----------
const pdfModalBtn = document.getElementById('pdf-export-modal-btn');
const pdfModal = document.getElementById('pdf-modal');
const closePdfModal = document.getElementById('close-pdf-modal');
const pdfRadios = document.querySelectorAll('input[name="pdf-mode"]');
const pdfSortContainer = document.getElementById('pdf-sortable-container');
const pdfFileList = document.getElementById('pdf-file-list');
const execPdfExport = document.getElementById('exec-pdf-export');

let dragSrcEl = null;

function createSortableItem(name) {
    const li = document.createElement('li');
    li.className = 'sortable-item';
    li.draggable = true;
    li.innerHTML = `
        <span class="sortable-item-handle" title="ドラッグして移動"><i data-lucide="grip-vertical" style="width:14px;height:14px;"></i></span>
        <input type="checkbox" checked class="pdf-include-cb" data-name="${name}">
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
    `;

    li.addEventListener('dragstart', function(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
    });

    li.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    });

    li.addEventListener('dragenter', function(e) {
        this.classList.add('over');
    });

    li.addEventListener('dragleave', function(e) {
        this.classList.remove('over');
    });

    li.addEventListener('drop', function(e) {
        e.stopPropagation();
        if (dragSrcEl !== this) {
            const allItems = Array.from(pdfFileList.querySelectorAll('.sortable-item'));
            const srcIdx = allItems.indexOf(dragSrcEl);
            const tgtIdx = allItems.indexOf(this);
            if (srcIdx < tgtIdx) {
                this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
            } else {
                this.parentNode.insertBefore(dragSrcEl, this);
            }
        }
        return false;
    });

    li.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        pdfFileList.querySelectorAll('.sortable-item').forEach(el => el.classList.remove('over'));
    });

    return li;
}

if (pdfModalBtn) {
    pdfModalBtn.onclick = () => {
        pdfFileList.innerHTML = '';
        const fileNames = Array.from(document.querySelectorAll('.file-name-text')).map(el => el.textContent);
        fileNames.forEach(name => {
            pdfFileList.appendChild(createSortableItem(name));
        });
        lucide.createIcons({root: pdfFileList});
        pdfModal.style.display = 'flex';
        
        // 初期状態をリセット
        document.querySelector('input[name="pdf-mode"][value="single"]').checked = true;
        pdfSortContainer.style.display = 'none';
    };
}

if (closePdfModal) {
    closePdfModal.onclick = () => pdfModal.style.display = 'none';
}

pdfRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'all') {
            pdfSortContainer.style.display = 'block';
        } else {
            pdfSortContainer.style.display = 'none';
        }
    });
});

if (execPdfExport) {
    execPdfExport.onclick = async () => {
        const mode = document.querySelector('input[name="pdf-mode"]:checked').value;
        pdfModal.style.display = 'none';

        if (mode === 'single') {
            if (!currentFileHandle && !mdInput.value) {
                alert("印刷するファイルが開かれていません。");
                return;
            }
            const isRich = currentMode === 'rich';
            if (isRich) {
                await switchMode('md');
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            window.print();
            if (isRich) {
                setTimeout(() => switchMode('rich'), 100);
            }
        } else {
            if (!projectHandle) {
                alert("プロジェクトフォルダを開いてください。");
                return;
            }
            
            const selectedFiles = [];
            pdfFileList.querySelectorAll('.sortable-item').forEach(li => {
                const cb = li.querySelector('.pdf-include-cb');
                if (cb.checked) {
                    selectedFiles.push(cb.getAttribute('data-name'));
                }
            });

            if (selectedFiles.length === 0) {
                alert("出力するファイルが選択されていません。");
                return;
            }

            const originalMode = currentMode;
            const originalMd = mdInput.value;
            const originalScroll = mdInput.scrollTop;

            if (isEdited && currentFileHandle) {
                const content = (currentMode === 'rich') ? parseHtmlToMd(richEditor) : mdInput.value;
                try {
                    const writable = await currentFileHandle.createWritable();
                    await writable.write(content);
                    await writable.close();
                    isEdited = false;
                } catch (e) { console.error(e); }
            }

            let combinedMd = '';
            for (const name of selectedFiles) {
                try {
                    const handle = await projectHandle.getFileHandle(name);
                    const file = await handle.getFile();
                    const text = await file.text();
                    
                    if (combinedMd !== '') {
                        combinedMd += '\n\n<div class="page-break"></div>\n\n';
                    }
                    combinedMd += text;
                } catch(e) { console.error(e); }
            }

            mdInput.value = combinedMd;
            
            if (currentMode !== 'md') {
                await applyMode('md'); 
            } else {
                await syncPreview();
            }
            
            await new Promise(resolve => setTimeout(resolve, 800)); 
            window.print();

            mdInput.value = originalMd;
            if (originalMode === 'rich') {
                setTimeout(() => applyMode('rich'), 100);
            } else {
                await syncPreview();
                mdInput.scrollTop = originalScroll;
            }
        }
    };
}
// ---------------------------------------------

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = (e) => {
        switchMode(e.target.id === 'mode-rich' ? 'rich' : 'md');
    };
});

document.querySelectorAll('.tab-btn').forEach((btn, idx) => { btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    document.getElementById('tab-indicator').style.transform = `translateX(${idx * 100}%)`; currentTab = btn.dataset.tab; renderPanel();
};});

function initResizer(rId, cId, isR = false, isInternal = false) {
    const r = document.getElementById(rId), c = document.getElementById(cId);
    if(!r || !c) return;
    r.onmousedown = (e) => { 
        const startX = e.pageX; const startWidth = c.offsetWidth;
        document.onmousemove = (ev) => {
            let w = isR ? window.innerWidth - ev.pageX : (isInternal ? startWidth + (ev.pageX - startX) : ev.pageX);
            c.style.width = Math.max(10, w) + 'px';
            if (isInternal) c.style.flex = "none";
        }; 
        document.onmouseup = () => document.onmousemove = null; 
    };
}
initResizer('resizer-left', 'left-sidebar'); initResizer('resizer-right', 'right-panel', true);
initResizer('resizer-md', 'md-input-area', false, true);

document.getElementById('toggle-left').onclick = () => document.getElementById('left-sidebar').classList.toggle('collapsed');
document.getElementById('toggle-right').onclick = () => document.getElementById('right-panel').classList.toggle('collapsed');