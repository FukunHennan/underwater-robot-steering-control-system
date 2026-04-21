# 知识库体检记录

## 2026-04-20 首次体检

### 执行内容

- [X] 创建 Wiki 文件夹结构
- [X] 从记忆系统编译 3 个实体页面：Modbus 寄存器映射、SVG 流程图技能、Web Dashboard
- [X] 同步到技能仓库 `C:\Users\chen1\Desktop\SKILL`
- [X] 修正技能仓库路径（旧 `e:\毕业设计\trae-skill` → 新 `C:\Users\chen1\Desktop\SKILL`）
- [X] 寄存器数量统一为 78（论文正文 + 大纲 + 记忆）

### 发现的矛盾（已解决）

| 矛盾             | 来源         | 解决                      |
| ---------------- | ------------ | ------------------------- |
| 寄存器 72 vs 78  | 论文 vs 代码 | 统一为 78，更新论文和大纲 |
| 技能仓库路径失效 | 旧路径不存在 | 更新为桌面 SKILL 目录     |

### 待跟进

- [X] 论文图片引用路径待确认 → 已统一为 `diagrams/png/`
- [ ] 后续新增 SVG 图需同步更新 `svg-flowchart-skill.md` 图清单

---

## 2026-04-21 第二次体检

### 执行内容

- [X] `Picture/` 目录合并到 `Documentation/diagrams/png/`，删除原目录
- [X] 论文正文 10 处图片路径从 `../Picture/` 更新为 `diagrams/png/`
- [X] `Hardware/` 目录清理，仅保留 `V1.0原理图.pdf`
- [X] Dashboard 新增 `?mock` 模拟数据模式，生成 3 张截图
- [X] 更新 `web-dashboard.md` 实体页面

### 目录结构变更

| 变更                                            | 说明                          |
| ----------------------------------------------- | ----------------------------- |
| `Picture/` → `Documentation/diagrams/png/` | 截图与流程图 PNG 统一存放     |
| `Hardware/` 清理                              | 仅保留原理图，后续存放 3D/BOM |

### 待跟进

- [x] 6 张实物/硬件照片 → 已补充 STM32F407 实物图、ATK-MS901M 实物图、PCB 连接视图、3D 渲染图
- [ ] 仍缺 3 张照片：输入电压、输出电压、整体调试
- [ ] 后续新增 SVG 图需同步更新 `svg-flowchart-skill.md` 图清单

---

## 2026-04-21 第三次体检（目录整理）

### 执行内容

- [x] 新增实物图：STM32F407VET6、ATK-MS901M、PCB连接视图、3D渲染图
- [x] 论文新增 2.2.6 PCB电路板设计小节（图2.4、图2.5）
- [x] 删除执行器实物图引用（不需要）
- [x] Documentation 目录大清理：
  - 删除旧 md：`MODBUS_DOC.md`、`硬件系统流程图.md`、`论文关键代码与材料清单.md`、`设备功能清单.md`、`水下智能转向系统-陈富坤.md`
  - 删除 `media/`（pandoc 临时产物）
  - docx 文件移入 `docx/` 子文件夹

### Documentation 目录结构（当前）

```
Documentation/
├── README.md
├── 论文正文.md
├── 论文大纲.md
├── diagrams/
│   ├── svg/    (11 个流程图)
│   └── png/    (19 个图片)
└── docx/
    ├── reference.docx
    ├── 水下智能转向系统-模板.docx
    └── 水下智能转向系统-陈富坤.docx
```

### 待跟进

- [ ] 补充 3 张调试照片：输入电压.png、输出电压.png、整体调试.png
- [ ] 后续新增 SVG 图需同步更新 `svg-flowchart-skill.md` 图清单
