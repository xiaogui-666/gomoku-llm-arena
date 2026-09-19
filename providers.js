/** 预设接口（纯静态页面由浏览器直连，无需后端）
 *  protocol: 'openai' = OpenAI 兼容 chat/completions；'anthropic' = Messages 协议；'local' = 内置引擎
 */
window.PROVIDERS = [
  { id: 'agnes', name: 'Agnes API Hub（当前密钥）', protocol: 'openai', baseUrl: 'https://apihub.agnes-ai.cn/v1', model: 'agnes-3.0-flash', models: ['agnes-3.0-flash', 'agnes-3.0-pro'], home: '' },
  { id: 'local', name: '内置引擎 · 离线（不用密钥）', protocol: 'local', baseUrl: '', model: 'gomoku-engine', models: ['gomoku-engine'], home: '', tip: '纯启发式引擎，反应最快，也用作模型解析失败时的兜底。' },
  { id: 'deepseek', name: 'DeepSeek 深度求索', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'openai', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1', models: ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'] },
  { id: 'anthropic', name: 'Anthropic Claude', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5', models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] },
  { id: 'qwen', name: '阿里通义千问（百炼）', protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', models: ['qwen3-max', 'qwen-plus', 'qwen-turbo'] },
  { id: 'moonshot', name: '月之暗面 Kimi', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.5', models: ['kimi-k2.5', 'moonshot-v1-32k'] },
  { id: 'zhipu', name: '智谱 GLM', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', models: ['glm-4.6', 'glm-4-plus', 'glm-4-flash'] },
  { id: 'doubao', name: '火山方舟 · 豆包', protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-2.0-pro', models: ['doubao-seed-2.0-pro', 'doubao-seed-2.0-lite'], tip: '豆包需填「接入点 ID」（ep-xxxx）作为模型名。' },
  { id: 'hunyuan', name: '腾讯混元', protocol: 'openai', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-turbo', models: ['hunyuan-turbo', 'hunyuan-pro'] },
  { id: 'gemini', name: 'Google Gemini', protocol: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3-flash', models: ['gemini-3-pro', 'gemini-3-flash', 'gemini-2.5-flash'], tip: 'URL 末尾必须保留 /openai。' },
  { id: 'grok', name: 'xAI Grok', protocol: 'openai', baseUrl: 'https://api.x.ai/v1', model: 'grok-4', models: ['grok-4', 'grok-4-fast'] },
  { id: 'siliconflow', name: '硅基流动 SiliconFlow', protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3-32B', models: ['Qwen/Qwen3-32B', 'deepseek-ai/DeepSeek-V3'] },
  { id: 'openrouter', name: 'OpenRouter（聚合）', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4.6'] },
  { id: 'ollama', name: 'Ollama / 自建（vLLM、OneAPI…）', protocol: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', models: ['qwen2.5:7b', 'llama3.1'], tip: 'https 页面直连 http 本地服务会被浏览器拦截，需本地服务开启 CORS 与 https。' },
  { id: 'custom', name: '自定义（OpenAI 兼容）', protocol: 'openai', baseUrl: '', model: '', models: [] },
];
