// src/utils/aiService.ts
import { AIConfig } from '../components/Settings/Settings';

const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

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