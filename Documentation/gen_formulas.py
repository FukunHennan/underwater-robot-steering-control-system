"""
生成卡尔曼滤波公式 PNG 图片，用于插入 Word 文档
使用 matplotlib 渲染 LaTeX 公式，输出高清透明背景 PNG
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os

output_dir = os.path.join(os.path.dirname(__file__), 'formulas')
os.makedirs(output_dir, exist_ok=True)

# 公式列表: (文件名, LaTeX公式, 字号)
formulas = [
    (
        "01-状态预测",
        r"$\hat{x}_k^{-} = \hat{x}_{k-1} + \omega \cdot \Delta t$",
        28
    ),
    (
        "02-协方差预测",
        r"$P_k^{-} = P_{k-1} + Q$",
        28
    ),
    (
        "03-卡尔曼增益",
        r"$K_k = \dfrac{P_k^{-}}{P_k^{-} + R}$",
        28
    ),
    (
        "04-状态更新",
        r"$\hat{x}_k = \hat{x}_k^{-} + K_k \cdot (z_k - \hat{x}_k^{-})$",
        28
    ),
    (
        "05-协方差更新",
        r"$P_k = (1 - K_k) \cdot P_k^{-}$",
        28
    ),
]

for fname, latex, fontsize in formulas:
    fig, ax = plt.subplots(figsize=(10, 1.5))
    ax.text(0.5, 0.5, latex, fontsize=fontsize, ha='center', va='center',
            transform=ax.transAxes)
    ax.axis('off')
    fig.patch.set_alpha(0)  # 透明背景
    out_path = os.path.join(output_dir, f"{fname}.png")
    fig.savefig(out_path, dpi=300, bbox_inches='tight', pad_inches=0.1,
                transparent=False, facecolor='white')
    plt.close(fig)
    print(f"[OK] {out_path}")

print(f"\n共生成 {len(formulas)} 张公式图片 -> {output_dir}")
