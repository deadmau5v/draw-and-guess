# -*- coding: utf-8 -*-
import os
import sys

# Ensure import works from current dir
sys.path.insert(0, r"C:\Users\d5v\Desktop\海龟汤")

from builder_part1 import items_part1
from builder_part2 import items_part2

all_items = items_part1 + items_part2
assert len(all_items) == 50, f"Expected 50 items, got {len(all_items)}"

out_path = r"C:\Users\d5v\Desktop\海龟汤\中国真实事件500题库\Vol_04_交通运输与行车意外篇_151-200.md"

header = """# 中国真实事件海龟汤题库·第04卷·交通运输与行车意外篇（编号 151 - 200）

> **原则声明**：
> 1. 本卷 50 个独立情境推理剧本**100% 取材于中国近现代国家应急管理部、交通运输部、海事局、国家铁路局、中国民用航空局及公安交管部门公开发布的特种交通与重大事故调查报告**。
> 2. **零玄学伪科学**：绝对严禁任何灵异鬼打墙、迷信怪谈。所有事故成因全部基于**牛顿力学、材料力学、流体力学、热力学相变、电工电子工程、光学错觉、人机工程学及人体生理应激盲区**。
> 3. 每个剧本均包含【真实原型/案件背景】、【汤面】、【汤底】与【核心线索与DM判定引导】，供主持人（DM）及玩家深度实境推演。

---

## 📚 本卷剧本目录（151 - 200）

"""

# Generate TOC
toc_lines = []
for item in all_items:
    toc_lines.append(f"{item['id']}. **《{item['title']}》** —— {item['background'].split('。')[0]}。")

toc_text = "\n".join(toc_lines) + "\n\n---\n\n"

# Generate Body
body_parts = []
for item in all_items:
    q_id = item['id']
    title = item['title']
    bg = item['background']
    surface = item['surface']
    bottom = item['bottom']
    clues = item['clues']
    
    clue_text = "\n".join([f"  - {c}" for c in clues])
    
    section = f"""### 第{q_id}题：{title}
- **【真实原型/案件背景】**：{bg}
- **【汤面】**：
  {surface}
- **【汤底】**：
  {bottom}
- **【核心线索与DM判定引导】**：
{clue_text}

---
"""
    body_parts.append(section)

full_content = header + toc_text + "\n".join(body_parts)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    f.write(full_content)

print(f"Successfully generated {out_path} with {len(all_items)} items, size: {len(full_content)} characters.")
