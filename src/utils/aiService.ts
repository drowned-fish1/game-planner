// src/utils/aiService.ts
import { AIConfig } from '../components/Settings/Settings';

const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

// 用给定配置（可以是尚未保存的编辑态）发一条最小请求，验证 URL/Key/模型是否可用
export async function testAIConnection(config: Pick<AIConfig, 'url' | 'key' | 'model'>): Promise<void> {
  if (!config.url.trim()) throw new Error('请先填写 API Endpoint URL');
  if (!config.key.trim()) throw new Error('请先填写 API Key');
  if (!config.model.trim()) throw new Error('请先填写模型名称');

  let res: Response;
  try {
    res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        stream: false,
      }),
    });
  } catch {
    throw new Error('网络错误：无法访问该地址');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // 非 JSON 响应（如 404 页面），走下方 HTTP 状态判断
  }

  if (data?.error) throw new Error(data.error.message || 'API 返回错误');
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
  if (!data?.choices?.[0]) throw new Error('响应格式异常：未返回 choices');
}

export async function requestAI(
  systemPrompt: string, 
  userPrompt: string,
  onLoading?: (loading: boolean) => void
): Promise<string> {
  if (onLoading) onLoading(true);

  try {
    // 1. 读取配置
    const savedConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS);
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    
    if (!savedConfigs) throw new Error("请先在设置页配置 AI");
    
    const configs: AIConfig[] = JSON.parse(savedConfigs);
    const config = configs.find(c => c.id === activeId) || configs[0];

    if (!config || !config.key || !config.url) throw new Error("AI 配置无效或缺少 Key");

    // 2. 发起请求
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: false
      })
    });

    const data = await res.json();
    
    if (data.error) {
        throw new Error(data.error.message || "API Error");
    }

    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    } else {
      throw new Error("无响应数据");
    }

  } catch (error: any) {
    console.error("AI Request Failed:", error);
    throw error; // 抛出错误供 UI 处理
  } finally {
    if (onLoading) onLoading(false);
  }
}