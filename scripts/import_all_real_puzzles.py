# -*- coding: utf-8 -*-
import os
import re
import json

script_dir = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(script_dir, '..'))
puzzles_json_path = os.path.join(root, 'data', 'puzzles.json')

# Load existing puzzles if any
existing_puzzles = []
if os.path.exists(puzzles_json_path):
    with open(puzzles_json_path, 'r', encoding='utf-8') as f:
        existing_puzzles = json.load(f)

existing_ids = {p['id'] for p in existing_puzzles}
print(f"Existing puzzles count: {len(existing_puzzles)}")

new_puzzles = []

def parse_markdown_cases(filepath, category_key, default_tags):
    with open(filepath, 'r', encoding='utf-8') as fh:
        text = fh.read()

    # Split by ### 第XXX题
    chunks = re.split(r'\n### 第(\d+)题[：:]', text)
    if len(chunks) < 2:
        return []

    results = []
    # chunks[0] is preamble, then pairs of (num, body)
    for i in range(1, len(chunks), 2):
        case_num = chunks[i].strip()
        body = chunks[i+1]

        # Extract title from first line of body
        first_line = body.strip().split('\n')[0].strip()
        title = first_line.lstrip('#').strip().strip('《》[]【】')

        # Extract 原型
        proto_match = re.search(r'-\s*\*\*【(?:真实原型|真实背景|历史背景|商业背景|民生背景|时代背景|原型背景|案件背景)】\*\*[:：]?(.*?)(?=-\s*\*\*【|\Z)', body, re.DOTALL)
        proto = proto_match.group(1).strip() if proto_match else ""

        # Extract 汤面
        surface_match = re.search(r'-\s*\*\*【汤面】\*\*[:：]?(.*?)(?=-\s*\*\*【|\Z)', body, re.DOTALL)
        surface = surface_match.group(1).strip() if surface_match else ""

        # Extract 汤底
        bottom_match = re.search(r'-\s*\*\*【汤底】\*\*[:：]?(.*?)(?=-\s*\*\*【|\Z)', body, re.DOTALL)
        bottom = bottom_match.group(1).strip() if bottom_match else ""

        # Extract 核心线索 / DM引导
        hints = []
        clues_match = re.search(r'-\s*\*\*【(?:核心线索与DM判定引导|核心线索|核心线索与DM引导|DM引导)】\*\*[:：]?(.*?)(?=\n###|\Z)', body, re.DOTALL)
        if clues_match:
            clues_text = clues_match.group(1).strip()
            # extract bullet points or numbered items
            lines = clues_text.split('\n')
            for l in lines:
                l_str = l.strip()
                if l_str and (l_str.startswith('-') or re.match(r'^\d+[\.、]', l_str) or '玩家问' in l_str):
                    clean_hint = re.sub(r'^[-*0-9\.\、\s]+', '', l_str).strip()
                    if clean_hint:
                        hints.append(clean_hint)

        if not surface or not bottom:
            continue

        # If proto exists, prepend to bottom for context
        full_bottom = bottom
        if proto:
            full_bottom = f"【真实原型】{proto}\n\n【真相解析】\n{bottom}"

        puzzle_id = f"{category_key}-{case_num.zfill(3)}"
        
        # Tags
        tags = list(default_tags)
        if '死因' in category_key or '刑侦' in category_key or '法医' in category_key:
            nsfl = True
        else:
            nsfl = False

        puzzle = {
            "id": puzzle_id,
            "title": title or f"真实案件第{case_num}题",
            "surface": surface,
            "bottom": full_bottom,
            "hints": hints[:5],
            "difficulty": 3,
            "tags": tags,
            "nsfl": nsfl,
            "source": {
                "key": "real-chinese-library",
                "repo": "https://github.com/deepseek-harness/turtle-soup",
                "url": "local",
                "license": "CC-BY-NC-4.0"
            },
            "alsoIn": []
        }
        results.append(puzzle)
    return results

# Map volume files in 中国真实事件500题库
dir1_candidates = [os.path.join(root, d) for d in os.listdir(root) if '500' in d and '多元' not in d and os.path.isdir(os.path.join(root, d))]
dir1 = dir1_candidates[0] if dir1_candidates else os.path.join(root, '中国真实事件500题库')
for f in sorted(os.listdir(dir1)):
    if f.endswith('.md') and not f.startswith('README'):
        prefix = f.split('_')[0] + '-' + f.split('_')[1]
        vol_puzzles = parse_markdown_cases(
            os.path.join(dir1, f),
            f"case500-{prefix}",
            ["真实事件", "硬核推理", f.split('_')[1]]
        )
        print(f"Parsed {len(vol_puzzles)} puzzles from {f}")
        new_puzzles.extend(vol_puzzles)

# Map volume files in 中国真实多元玩法500题库
dir2_candidates = [os.path.join(root, d) for d in os.listdir(root) if '多元' in d and os.path.isdir(os.path.join(root, d))]
dir2 = dir2_candidates[0] if dir2_candidates else os.path.join(root, '中国真实多元玩法500题库')
for f in sorted(os.listdir(dir2)):
    if f.endswith('.md') and not f.startswith('README'):
        parts = f.split('_')
        play_mode = parts[1] # 红汤, 金汤, 灰汤, 绿汤, 白汤
        sub_name = parts[2]
        vol_puzzles = parse_markdown_cases(
            os.path.join(dir2, f),
            f"multi500-{play_mode}-{parts[-1].replace('.md', '')}",
            ["真实事件", play_mode, sub_name]
        )
        print(f"Parsed {len(vol_puzzles)} puzzles from {f}")
        new_puzzles.extend(vol_puzzles)

print(f"\nTotal new parsed puzzles: {len(new_puzzles)}")

# Combine with existing puzzles, avoiding duplicates
combined = list(existing_puzzles)
added_count = 0
for p in new_puzzles:
    if p['id'] not in existing_ids:
        combined.append(p)
        existing_ids.add(p['id'])
        added_count += 1

print(f"Added {added_count} new unique puzzles to dataset. Grand total: {len(combined)}")

# Save to data/puzzles.json
with open(puzzles_json_path, 'w', encoding='utf-8') as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)

print(f"Successfully saved to {puzzles_json_path}")
