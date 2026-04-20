# 知识库体检记录

## 2026-04-20 首次体检

### 执行内容

- [x] 创建 Wiki 文件夹结构
- [x] 从记忆系统编译 3 个实体页面：Modbus 寄存器映射、SVG 流程图技能、Web Dashboard
- [x] 同步到技能仓库 `C:\Users\chen1\Desktop\SKILL`
- [x] 修正技能仓库路径（旧 `e:\毕业设计\trae-skill` → 新 `C:\Users\chen1\Desktop\SKILL`）
- [x] 寄存器数量统一为 78（论文正文 + 大纲 + 记忆）

### 发现的矛盾（已解决）

| 矛盾 | 来源 | 解决 |
|---|---|---|
| 寄存器 72 vs 78 | 论文 vs 代码 | 统一为 78，更新论文和大纲 |
| 技能仓库路径失效 | 旧路径不存在 | 更新为桌面 SKILL 目录 |

### 待跟进

- [x] 论文图片引用路径待确认 → 已统一为 `diagrams/png/`
- [ ] 后续新增 SVG 图需同步更新 `svg-flowchart-skill.md` 图清单

---

## 2026-04-21 第二次体检

### 执行内容

- [x] `Picture/` 目录合并到 `Documentation/diagrams/png/`，删除原目录
- [x] 论文正文 10 处图片路径从 `../Picture/` 更新为 `diagrams/png/`
- [x] `Hardware/` 目录清理，仅保留 `V1.0原理图.pdf`
- [x] Dashboard 新增 `?mock` 模拟数据模式，生成 3 张截图
- [x] 更新 `web-dashboard.md` 实体页面

### 目录结构变更

| 变更 | 说明 |
|---|---|
| `Picture/` → `Documentation/diagrams/png/` | 截图与流程图 PNG 统一存放 |
| `Hardware/` 清理 | 仅保留原理图，后续存放 3D/BOM |

### 待跟进

- [ ] 6 张实物/硬件照片由用户拍摄后放入 `diagrams/png/`
- [ ] 后续新增 SVG 图需同步更新 `svg-flowchart-skill.md` 图清单
