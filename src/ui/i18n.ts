// Tool name dictionary: raw tool name -> Japanese display
const TOOL_MAP: Record<string, [string, string]> = {
  // [long, short]
  'read':       ['\u{1F4C4} \u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u3093\u3067\u3044\u307E\u3059', '\u30D5\u30A1\u30A4\u30EB\u8AAD\u8FBC'],
  'Read':       ['\u{1F4C4} \u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u3093\u3067\u3044\u307E\u3059', '\u30D5\u30A1\u30A4\u30EB\u8AAD\u8FBC'],
  'exec':       ['\u26A1 \u30B3\u30DE\u30F3\u30C9\u3092\u5B9F\u884C\u4E2D', '\u30B3\u30DE\u30F3\u30C9\u5B9F\u884C'],
  'Bash':       ['\u26A1 \u30B3\u30DE\u30F3\u30C9\u3092\u5B9F\u884C\u4E2D', '\u30B3\u30DE\u30F3\u30C9\u5B9F\u884C'],
  'Write':      ['\u270F\uFE0F \u30D5\u30A1\u30A4\u30EB\u3092\u7DE8\u96C6\u4E2D', '\u30D5\u30A1\u30A4\u30EB\u7DE8\u96C6'],
  'Edit':       ['\u270F\uFE0F \u30D5\u30A1\u30A4\u30EB\u3092\u7DE8\u96C6\u4E2D', '\u30D5\u30A1\u30A4\u30EB\u7DE8\u96C6'],
  'Grep':       ['\u{1F50D} \u30D5\u30A1\u30A4\u30EB\u3092\u691C\u7D22\u4E2D', '\u30D5\u30A1\u30A4\u30EB\u691C\u7D22'],
  'Glob':       ['\u{1F50D} \u30D5\u30A1\u30A4\u30EB\u3092\u691C\u7D22\u4E2D', '\u30D5\u30A1\u30A4\u30EB\u691C\u7D22'],
  'WebSearch':  ['\u{1F310} \u30A6\u30A7\u30D6\u3067\u8ABF\u3079\u3066\u3044\u307E\u3059', '\u30A6\u30A7\u30D6\u691C\u7D22'],
  'WebFetch':   ['\u{1F310} \u30A6\u30A7\u30D6\u3092\u53D6\u5F97\u4E2D', '\u30A6\u30A7\u30D6\u53D6\u5F97'],
  'Agent':      ['\u{1F916} \u30B5\u30D6\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306B\u59D4\u8B72\u4E2D', '\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u59D4\u8B72'],
  'ToolSearch': ['\u{1F50D} \u30C4\u30FC\u30EB\u3092\u691C\u7D22\u4E2D', '\u30C4\u30FC\u30EB\u691C\u7D22'],
};

// MCP prefix patterns
const MCP_PREFIX_MAP: Record<string, [string, string]> = {
  'slack':    ['\u{1F4AC} Slack\u3067\u901A\u4FE1\u4E2D', 'Slack\u901A\u4FE1'],
  'github':   ['\u{1F419} GitHub\u3092\u64CD\u4F5C\u4E2D', 'GitHub\u64CD\u4F5C'],
  'notion':   ['\u{1F4DD} Notion\u3092\u64CD\u4F5C\u4E2D', 'Notion\u64CD\u4F5C'],
  'calendar': ['\u{1F4C5} \u30AB\u30EC\u30F3\u30C0\u30FC\u64CD\u4F5C\u4E2D', '\u30AB\u30EC\u30F3\u30C0\u30FC'],
  'gmail':    ['\u{1F4E7} Gmail\u64CD\u4F5C\u4E2D', 'Gmail'],
  'chrome':   ['\u{1F310} \u30D6\u30E9\u30A6\u30B6\u64CD\u4F5C\u4E2D', '\u30D6\u30E9\u30A6\u30B6'],
  'filesystem': ['\u{1F4C1} \u30D5\u30A1\u30A4\u30EB\u64CD\u4F5C\u4E2D', '\u30D5\u30A1\u30A4\u30EB\u64CD\u4F5C'],
  'context7': ['\u{1F4DA} \u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u53C2\u7167\u4E2D', '\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8'],
  'drawio':   ['\u{1F4CA} \u56F3\u3092\u4F5C\u6210\u4E2D', '\u56F3\u4F5C\u6210'],
};

const STATUS_MAP: Record<string, string> = {
  'working':  '\u4F5C\u696D\u4E2D',
  'thinking': '\u8003\u3048\u4E2D',
  'idle':     '\u5F85\u6A5F\u4E2D',
};

function matchMcpPrefix(name: string): [string, string] | null {
  if (!name.startsWith('mcp__')) return null;
  const parts = name.split('__');
  if (parts.length < 2) return null;
  const service = parts[1].toLowerCase();
  for (const [prefix, labels] of Object.entries(MCP_PREFIX_MAP)) {
    if (service.includes(prefix)) return labels;
  }
  // Fallback: capitalize service name
  const svc = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  return [`\u{1F527} ${svc}\u3092\u64CD\u4F5C\u4E2D`, `${svc}\u64CD\u4F5C`];
}

export function formatToolJa(name: string): string {
  const direct = TOOL_MAP[name];
  if (direct) return direct[0];
  const mcp = matchMcpPrefix(name);
  if (mcp) return mcp[0];
  return name;
}

export function formatToolShortJa(name: string): string {
  const direct = TOOL_MAP[name];
  if (direct) return direct[1];
  const mcp = matchMcpPrefix(name);
  if (mcp) return mcp[1];
  return name;
}

export function formatStatusJa(status: string): string {
  return STATUS_MAP[status] ?? status;
}
