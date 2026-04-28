# scripts/

项目辅助脚本。

## git-hooks/

Git 钩子源文件。由于 `.git/hooks/` 不进版本控制，这里是源头，**换机/clone 后必须手动安装一次**。

### 安装

PowerShell（Windows）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-git-hooks.ps1
```

### 已有 hooks

| Hook | 功能 |
|---|---|
| `pre-commit` | 拦截"代码改了但 Wiki 没改"的提交。支持 `git commit --no-verify` 或 commit message 含 `[no-wiki]` / `[skip-wiki]` 跳过 |

### 设计原则

- **温和但坚决**：默认阻止有问题的 commit，但提供多种跳过方式
- **无侵入**：纯代码改动（无论大小）都不受影响，只在涉及 `Software/` / `Documentation/` 时生效
- **Wiki 同批提交即可通过**：不要求 Wiki 放前面的独立 commit，只要本次 staged 含 `Wiki/` 文件即可

### 检测逻辑

```
staged 中有 Software/|Documentation/ 改动
  AND
staged 中无 Wiki/ 改动
  AND
commit message 无 [no-wiki] 或 [skip-wiki]
  → 拦截
```
