import { getSingletonHighlighter, Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;
const highlighterPromise = (async () => {
  try {
    highlighter = await getSingletonHighlighter({
      themes: ['github-dark'],
      langs: ['javascript', 'typescript', 'python', 'json', 'bash', 'markdown', 'html', 'yaml', 'css']
    });
  } catch (e) {
    // Fallback to basic highlighter if Shiki fails to load
  }
})();

function hexToAnsi(hex: string): string {
  if (!hex) return '\x1b[0m';
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return '\x1b[0m';
}

function highlightCodeBasic(code: string): string {
  // Simple regex-based fallback highlighter for common tokens
  return code
    .replace(/(const|let|var|function|return|import|export|from|class|extends|if|else|for|while|await|async|typeof|try|catch|new|throw)\b/g, '\x1b[35m$1\x1b[0m') // keywords (magenta)
    .replace(/(["'`])(.*?)\1/g, '\x1b[32m$1$2$1\x1b[0m') // strings (green)
    .replace(/\b(\d+)\b/g, '\x1b[33m$1\x1b[0m') // numbers (yellow)
    .replace(/(\/\/.*)/g, '\x1b[90m$1\x1b[0m'); // comments (grey)
}

export function highlightCode(code: string, lang: string): string {
  if (highlighter) {
    try {
      const normalizedLang = lang.toLowerCase();
      const supportedLangs = ['javascript', 'typescript', 'python', 'json', 'bash', 'markdown', 'html', 'yaml', 'css', 'js', 'ts', 'py', 'sh'];
      const actualLang = supportedLangs.includes(normalizedLang)
        ? (normalizedLang === 'js' ? 'javascript' : normalizedLang === 'ts' ? 'typescript' : normalizedLang === 'py' ? 'python' : normalizedLang === 'sh' ? 'bash' : normalizedLang)
        : 'typescript';

      const tokens = highlighter.codeToTokens(code, {
        lang: actualLang,
        theme: 'github-dark'
      });

      let highlighted = '';
      for (const line of tokens) {
        for (const token of line) {
          const color = token.color ? hexToAnsi(token.color) : '\x1b[0m';
          highlighted += color + token.content + '\x1b[0m';
        }
        highlighted += '\n';
      }
      return highlighted.trimEnd();
    } catch (e) {
      return highlightCodeBasic(code);
    }
  }
  return highlightCodeBasic(code);
}

// Ensure highlighter starts loading early
export function initializeHighlighter() {
  return highlighterPromise;
}

export function renderMarkdown(md: string, terminalWidth = 80): string {
  if (!md) return '';

  const lines = md.split('\n');
  const renderedLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        inCodeBlock = false;
        const highlighted = highlightCode(codeBlockContent, codeBlockLang);
        // Draw fine bordered card for code block
        renderedLines.push('\x1b[90m┌' + '─'.repeat(Math.min(terminalWidth - 2, 78)) + '┐\x1b[0m');
        const codeLines = highlighted.split('\n');
        for (const codeLine of codeLines) {
          // Remove ANSI escapes to count visible length
          const visible = codeLine.replace(/\x1b\[[0-9;]*m/g, '');
          const padding = Math.max(0, Math.min(terminalWidth - 2, 78) - visible.length);
          renderedLines.push('\x1b[90m│\x1b[0m ' + codeLine + ' '.repeat(padding) + ' \x1b[90m│\x1b[0m');
        }
        renderedLines.push('\x1b[90m└' + '─'.repeat(Math.min(terminalWidth - 2, 78)) + '┘\x1b[0m');
        codeBlockContent = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3) || 'typescript';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Handle Tables
    if (line.trim().startsWith('|')) {
      // Find consecutive table lines
      const tableLines = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        tableLines.push(lines[i + 1]);
        i++;
      }

      const renderedTable = renderTable(tableLines, terminalWidth);
      renderedLines.push(renderedTable);
      continue;
    }

    // Handle Horizontal Rules
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      renderedLines.push('\x1b[90m' + '─'.repeat(terminalWidth) + '\x1b[0m');
      continue;
    }

    // Handle Headers
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const formattedText = inlineFormatting(text);
        if (level === 1) {
          renderedLines.push(`\n\x1b[1;36m${formattedText.toUpperCase()}\x1b[0m`);
          renderedLines.push(`\x1b[36m${'━'.repeat(Math.min(terminalWidth, formattedText.length))}\x1b[0m`);
        } else if (level === 2) {
          renderedLines.push(`\n\x1b[1;33m${formattedText}\x1b[0m`);
          renderedLines.push(`\x1b[90m${'─'.repeat(Math.min(terminalWidth, formattedText.length))}\x1b[0m`);
        } else {
          renderedLines.push(`\n\x1b[1;32m${formattedText}\x1b[0m`);
        }
        continue;
      }
    }

    // Handle Blockquotes
    if (line.trim().startsWith('>')) {
      const quoteText = line.trim().substring(1).trim();
      renderedLines.push(`\x1b[34m│\x1b[0m \x1b[3m${inlineFormatting(quoteText)}\x1b[0m`);
      continue;
    }

    // Handle Bullet/Numbered Lists
    if (line.trim().match(/^([\*\+-]|\d+\.)\s+/)) {
      const match = line.trim().match(/^([\*\+-]|\d+\.)\s+(.*)$/);
      if (match) {
        const marker = match[1];
        const content = match[2];
        const indent = line.length - line.trimStart().length;
        const bulletSymbol = ['*', '+', '-'].includes(marker) ? '•' : marker;
        renderedLines.push(' '.repeat(indent) + `\x1b[32m${bulletSymbol}\x1b[0m ${inlineFormatting(content)}`);
        continue;
      }
    }

    // Inline formatting and standard line
    renderedLines.push(inlineFormatting(line));
  }

  // Handle unclosed code block at end of streaming input gracefully
  if (inCodeBlock && codeBlockContent) {
    const highlighted = highlightCode(codeBlockContent, codeBlockLang);
    renderedLines.push('\x1b[90m┌' + '─'.repeat(Math.min(terminalWidth - 2, 78)) + '┐\x1b[0m');
    const codeLines = highlighted.split('\n');
    for (const codeLine of codeLines) {
      const visible = codeLine.replace(/\x1b\[[0-9;]*m/g, '');
      const padding = Math.max(0, Math.min(terminalWidth - 2, 78) - visible.length);
      renderedLines.push('\x1b[90m│\x1b[0m ' + codeLine + ' '.repeat(padding) + ' \x1b[90m│\x1b[0m');
    }
    renderedLines.push('\x1b[90m└' + '─'.repeat(Math.min(terminalWidth - 2, 78)) + '┘\x1b[0m');
  }

  return renderedLines.join('\n');
}

function inlineFormatting(text: string): string {
  return text
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, '\x1b[1m$1\x1b[22m')
    // Italic *text*
    .replace(/\*(.*?)\*/g, '\x1b[3m$1\x1b[23m')
    // Strikethrough ~~text~~
    .replace(/~~(.*?)~~/g, '\x1b[9m$1\x1b[29m')
    // Inline code `code`
    .replace(/`(.*?)`/g, '\x1b[48;5;236;38;5;250m $1 \x1b[0m');
}

function renderTable(tableLines: string[], terminalWidth: number): string {
  // Parse rows & columns
  const rows = tableLines.map(line =>
    line.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
  ).filter(row => row.length > 0);

  if (rows.length === 0) return '';

  // Determine col widths
  const colCount = rows[0].length;
  const colWidths = Array(colCount).fill(0);

  for (const row of rows) {
    // Skip divider row (contains only dashes/colons)
    if (row.every(cell => cell.match(/^:?-+:?$/))) continue;
    for (let c = 0; c < colCount; c++) {
      if (row[c]) {
        // Strip inline ANSI format to measure actual visible width
        const visible = row[c].replace(/\x1b\[[0-9;]*m/g, '').replace(/`(.*?)`/g, ' $1 ');
        colWidths[c] = Math.max(colWidths[c], visible.length);
      }
    }
  }

  let tableStr = '';

  // Render borders
  const drawLine = (left: string, mid: string, right: string, dash: string) => {
    return '\x1b[90m' + left + colWidths.map(w => dash.repeat(w + 2)).join(mid) + right + '\x1b[0m\n';
  };

  tableStr += drawLine('┌', '┬', '┐', '─');

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    // Check if divider row
    if (row.every(cell => cell.match(/^:?-+:?$/))) {
      tableStr += drawLine('├', '┼', '┤', '─');
      continue;
    }

    const formattedCells = row.map((cell, c) => {
      const formatted = inlineFormatting(cell);
      const visible = cell.replace(/\x1b\[[0-9;]*m/g, '').replace(/`(.*?)`/g, ' $1 ');
      const padding = Math.max(0, colWidths[c] - visible.length);
      return ' ' + formatted + ' '.repeat(padding) + ' ';
    });

    tableStr += '\x1b[90m│\x1b[0m' + formattedCells.join('\x1b[90m│\x1b[0m') + '\x1b[90m│\x1b[0m\n';
  }

  tableStr += drawLine('└', '┴', '┘', '─');
  return tableStr.trimEnd();
}
