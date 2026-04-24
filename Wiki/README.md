# 项目知识 Wiki

基于 Karpathy LLM Wiki 模式管理的项目知识库。

## 原则

1. **合并优于新增** — 先搜再存，有相关条目就更新
2. **实体为中心** — 一个实体一个页面，记录完整当前状态
3. **矛盾即时标记** — 新旧冲突时标注，确认后更新
4. **完成即编译** — 做完任务就提炼为可复用知识
5. **定期体检** — 清重复、修过时、补缺失

## 目录结构

```
Wiki/
├── README.md              ← 本文件
├── entities/              ← 实体页面（项目核心知识）
│   ├── modbus-register-map.md
│   ├── svg-flowchart-skill.md
│   ├── web-dashboard.md
│   └── adc-calibration.md
└── health-check-log.md    ← 体检记录
```

## 使用方式

- AI 对话中发现重要知识 → 更新对应实体页面
- 完成功能/调试后 → 编译为实体页面或技能
- 定期请求"体检" → 检查知识一致性
