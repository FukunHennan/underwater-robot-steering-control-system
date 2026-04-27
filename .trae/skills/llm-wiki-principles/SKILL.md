---
name: "llm-wiki-principles"
description: "Applies LLM Wiki operation principles for knowledge management. Invoke when working on any project to ensure knowledge is compiled, organized, and maintained according to best practices."
---

# LLM Wiki 操作原则

## 核心理念
摄入时编译，而非查询时检索。知识一次编译，持续更新，自动增长。

### 5 条可操作原则

**原则 1：合并优于新增**
- 创建记忆前，先检索是否有语义相关的已有记忆
- 有 → update 已有记忆，将新信息整合进去
- 无 → 才 create 新记忆

**原则 2：实体为中心组织**
- 按项目、技术栈、架构决策、用户偏好等实体组织记忆
- 每个实体一个记忆条目，包含该实体的完整当前状态

**原则 3：矛盾即时标记**
- 新信息与旧记忆冲突时，不静默覆盖
- 先标注矛盾，向用户确认，确认后再更新

**原则 4：完成即编译**
- 完成一个功能/任务/调试后，主动将经验编译为可复用知识
- 输出形态：技能文件、工作流 workflow、结构化记忆

**原则 5：定期体检**
- 用户请求或对话末尾，检查记忆库的健康度
- 体检内容：重复条目合并、过时信息标记、碎片整合、路径/数值验证

### 工作流触发时机

| 触发事件 | 执行动作 |
|---|---|
| 新信息进入（用户告知/代码发现） | Ingest → 检索相关记忆 → Compile 合并 |
| 发现数据不一致 | Reconcile → 标记矛盾 → 等用户确认 |
| 完成一个任务/功能 | 编译为技能/记忆 |
| 用户说"体检/检查" | Health Check 全量扫描 |
| 创建新记忆前 | 先搜索是否已有相关条目 |

### 参考
- Karpathy Gist:
- 开源实现: AgentMemory