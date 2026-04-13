import fitz  # PyMuPDF
import os

pdf_path = r"e:\毕业设计\Hardware\V1.0原理图.pdf"
output_dir = r"e:\毕业设计\Hardware\pdf_images"

# 创建输出目录
os.makedirs(output_dir, exist_ok=True)

# 打开 PDF
doc = fitz.open(pdf_path)

print(f"PDF 总页数: {len(doc)}")

# 将每一页转换为图片
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    # 使用较高的 DPI 来获得清晰的图片
    pix = page.get_pixmap(dpi=300)
    output_path = os.path.join(output_dir, f"page_{page_num + 1}.png")
    pix.save(output_path)
    print(f"已保存: {output_path}")

doc.close()
print("转换完成！")
