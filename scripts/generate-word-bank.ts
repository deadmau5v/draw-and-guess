import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SeedPuzzle } from '../shared/protocol.js';

interface WordItem {
  id: string;
  word: string;
  category: string;
  difficulty: number;
  hints: [string, string, string];
  tags: string[];
  nsfl?: boolean;
  customSurface?: string;
}

const WORDS: WordItem[] = [
  // 1. 萌趣动物 (15)
  { id: 'draw-animal-01', word: '大熊猫', category: '萌趣动物', difficulty: 1, hints: ['国宝级竹林吃货，自带黑眼圈', '喜欢抱竹子打滚，黑白配色', '首字提示：「大 〇 〇」'], tags: ['动物', '经典', '轻松', '日常'] },
  { id: 'draw-animal-02', word: '长颈鹿', category: '萌趣动物', difficulty: 1, hints: ['非洲草原上的高个子瞭望员', '脖子特别长，身上有网状斑纹', '首字提示：「长 〇 〇」'], tags: ['动物', '经典', '日常'] },
  { id: 'draw-animal-03', word: '章鱼', category: '萌趣动物', difficulty: 2, hints: ['海洋里的软体伪装大师，有吸盘', '拥有八条灵活触手，受惊会喷墨汁', '首字提示：「章 〇」'], tags: ['动物', '轻松', '海洋'] },
  { id: 'draw-animal-04', word: '考拉', category: '萌趣动物', difficulty: 2, hints: ['澳洲树上的睡眠冠军，抱树不撒手', '专吃桉树叶，大鼻子圆耳朵', '首字提示：「考 〇」'], tags: ['动物', '温情', '轻松'] },
  { id: 'draw-animal-05', word: '变色龙', category: '萌趣动物', difficulty: 3, hints: ['丛林里的隐藏高手，眼睛能独立转动', '舌头极长抓昆虫，皮肤随环境换色', '首字提示：「变 〇 〇」'], tags: ['动物', '反转', '奇趣'] },
  { id: 'draw-animal-06', word: '企鹅', category: '萌趣动物', difficulty: 1, hints: ['南极冰面上的绅士，走路摇摇摆摆', '不会飞的鸟类，身穿燕尾服游泳极快', '首字提示：「企 〇」'], tags: ['动物', '经典', '日常'] },
  { id: 'draw-animal-07', word: '孔雀开屏', category: '萌趣动物', difficulty: 2, hints: ['动物园里最华丽的炫耀时刻', '展开布满眼状斑纹的巨大翠绿尾羽', '首字提示：「孔 〇 〇 〇」'], tags: ['动物', '成语', '经典'] },
  { id: 'draw-animal-08', word: '刺猬', category: '萌趣动物', difficulty: 1, hints: ['遇到危险会蜷缩成一颗带刺的球', '背上长满尖刺的小型哺乳动物', '首字提示：「刺 〇」'], tags: ['动物', '日常', '轻松'] },
  { id: 'draw-animal-09', word: '袋鼠', category: '萌趣动物', difficulty: 1, hints: ['跳跃前进的拳击手，自带育儿袋', '大洋洲代表动物，后腿强健有力', '首字提示：「袋 〇」'], tags: ['动物', '经典', '轻松'] },
  { id: 'draw-animal-10', word: '猫头鹰', category: '萌趣动物', difficulty: 2, hints: ['夜间森林的守望者，脑袋能转270度', '白天睡觉晚上抓老鼠，大眼睛圆脸盘', '首字提示：「猫 〇 〇」'], tags: ['动物', '悬疑', '日常'] },
  { id: 'draw-animal-11', word: '火烈鸟', category: '萌趣动物', difficulty: 2, hints: ['喜欢单腿站立在水中的粉红色大鸟', '脖子和腿都很修长，羽毛如火焰般鲜艳', '首字提示：「火 〇 〇」'], tags: ['动物', '温情', '奇趣'] },
  { id: 'draw-animal-12', word: '河豚', category: '萌趣动物', difficulty: 2, hints: ['生气时身体会瞬间鼓成一个圆球', '浑身小刺的水中萌物，自带膨胀防御', '首字提示：「河 〇」'], tags: ['动物', '搞笑', '轻松'] },
  { id: 'draw-animal-13', word: '树懒', category: '萌趣动物', difficulty: 2, hints: ['动作慢到仿佛被按了慢放键的动物', '常年倒挂在树枝上，表情自带微笑', '首字提示：「树 〇」'], tags: ['动物', '搞笑', '轻松'] },
  { id: 'draw-animal-14', word: '独角兽', category: '萌趣动物', difficulty: 2, hints: ['神话传说中额头长着螺旋尖角的白马', '带有翅膀或彩虹鬃毛的奇幻生物', '首字提示：「独 〇 〇」'], tags: ['动物', '奇幻', '温情'] },
  { id: 'draw-animal-15', word: '哈士奇', category: '萌趣动物', difficulty: 2, hints: ['长得像狼却经常犯傻拆家的雪橇犬', '表情包常客，外号二哈或撒手没', '首字提示：「哈 〇 〇」'], tags: ['动物', '搞笑', '热梗'] },

  // 2. 美食甜品 (15)
  { id: 'draw-food-01', word: '珍珠奶茶', category: '美食甜品', difficulty: 1, hints: ['当代年轻人的续命快乐水，配粗吸管', '杯底有黑亮圆润的Q弹木薯球', '首字提示：「珍 〇 〇 〇」'], tags: ['美食', '日常', '轻松'] },
  { id: 'draw-food-02', word: '鸳鸯火锅', category: '美食甜品', difficulty: 2, hints: ['聚餐神器，一口锅里隔出两个世界', 'S型隔板分开红油麻辣与白汤清汤', '首字提示：「鸳 〇 〇 〇」'], tags: ['美食', '经典', '日常'] },
  { id: 'draw-food-03', word: '冰糖葫芦', category: '美食甜品', difficulty: 1, hints: ['冬天街头竹签串起的红彤彤酸甜小吃', '山楂果裹着晶莹剔透的硬糖壳', '首字提示：「冰 〇 〇 〇」'], tags: ['美食', '经典', '温情'] },
  { id: 'draw-food-04', word: '榴莲比萨', category: '美食甜品', difficulty: 3, hints: ['热带臭味果王与意式圆饼的奇妙碰撞', '切分成三角形的芝士拉丝薄饼', '首字提示：「榴 〇 〇 〇」'], tags: ['美食', '搞笑', '反转'] },
  { id: 'draw-food-05', word: '荷包蛋', category: '美食甜品', difficulty: 1, hints: ['平底锅里滋滋作响的早餐常客', '蛋白洁白一圈，中间包裹圆圆黄心', '首字提示：「荷 〇 〇」'], tags: ['美食', '日常', '轻松'] },
  { id: 'draw-food-06', word: '生日蛋糕', category: '美食甜品', difficulty: 1, hints: ['许愿吹蜡烛时必不可少的庆典甜点', '多层奶油裱花，顶部插着燃烧的蜡烛', '首字提示：「生 〇 〇 〇」'], tags: ['美食', '温情', '经典'] },
  { id: 'draw-food-07', word: '旋转寿司', category: '美食甜品', difficulty: 2, hints: ['坐在吧台前看着小盘子排队跑过', '传送带上循环移动的日式饭团美食', '首字提示：「旋 〇 〇 〇」'], tags: ['美食', '日常', '奇趣'] },
  { id: 'draw-food-08', word: '臭豆腐', category: '美食甜品', difficulty: 2, hints: ['闻着让人捂鼻子、吃着外焦里嫩的夜市小吃', '方方正正通常是黑色，淋上蒜汁辣椒', '首字提示：「臭 〇 〇」'], tags: ['美食', '搞笑', '日常'] },
  { id: 'draw-food-09', word: '棉花糖', category: '美食甜品', difficulty: 1, hints: ['游乐园里像一朵白云插在木棍上的甜食', '用糖丝缠绕出的蓬松软绵球状甜品', '首字提示：「棉 〇 〇」'], tags: ['美食', '温情', '轻松'] },
  { id: 'draw-food-10', word: '烤羊肉串', category: '美食甜品', difficulty: 2, hints: ['夏夜大排档炭火上架着滋滋冒油的美食', '铁签串着肥瘦相间的肉块撒孜然辣椒', '首字提示：「烤 〇 〇 〇」'], tags: ['美食', '日常', '经典'] },
  { id: 'draw-food-11', word: '小笼包', category: '美食甜品', difficulty: 2, hints: ['竹蒸笼里热气腾腾、顶上有一圈褶子', '皮薄馅大带汤汁的传统江南面点', '首字提示：「小 〇 〇」'], tags: ['美食', '经典', '日常'] },
  { id: 'draw-food-12', word: '甜筒冰淇淋', category: '美食甜品', difficulty: 1, hints: ['夏天不快点吃就会顺着手流下来的冰品', '脆皮蛋卷锥形底座托着螺旋奶油球', '首字提示：「甜 〇 〇 〇 〇」'], tags: ['美食', '轻松', '日常'] },
  { id: 'draw-food-13', word: '方便面', category: '美食甜品', difficulty: 1, hints: ['加班熬夜和长途火车上的速食搭档', '波浪形卷曲面饼配调料包，热水泡三分钟', '首字提示：「方 〇 〇」'], tags: ['美食', '日常', '校园'] },
  { id: 'draw-food-14', word: '北京烤鸭', category: '美食甜品', difficulty: 3, hints: ['果木炭火烤得色泽红润的京城名菜', '片成薄片用荷叶饼卷葱丝甜面酱吃', '首字提示：「北 〇 〇 〇」'], tags: ['美食', '经典'] },
  { id: 'draw-food-15', word: '螺蛳粉', category: '美食甜品', difficulty: 3, hints: ['柳州特色酸辣米粉，灵魂在于酸笋味', '碗里有腐竹花生木耳，味道极具穿透力', '首字提示：「螺 〇 〇」'], tags: ['美食', '热梗', '搞笑'] },

  // 3. 成语俗语 (15)
  { id: 'draw-idiom-01', word: '画蛇添足', category: '成语俗语', difficulty: 2, hints: ['本来已经画好了，偏偏多画了几笔反而输掉比赛', '一条长长的爬行动物下面长出了四只脚', '首字提示：「画 〇 〇 〇」'], tags: ['成语', '经典', '反转'] },
  { id: 'draw-idiom-02', word: '守株待兔', category: '成语俗语', difficulty: 2, hints: ['放下农具坐在树桩旁，指望好运再次撞上来', '一只长耳朵动物一头撞在大树桩上', '首字提示：「守 〇 〇 〇」'], tags: ['成语', '经典', '校园'] },
  { id: 'draw-idiom-03', word: '对牛弹琴', category: '成语俗语', difficulty: 2, hints: ['比喻向不懂道理的人讲高深学问，白费力气', '古人抚琴弹奏，听众却是一头低头吃草的牛', '首字提示：「对 〇 〇 〇」'], tags: ['成语', '经典', '搞笑'] },
  { id: 'draw-idiom-04', word: '井底之蛙', category: '成语俗语', difficulty: 2, hints: ['眼界狭小，只看到头顶那一小圈圆圆的天空', '深井底部坐着一只抬头往上看的小青蛙', '首字提示：「井 〇 〇 〇」'], tags: ['成语', '经典', '校园'] },
  { id: 'draw-idiom-05', word: '掩耳盗铃', category: '成语俗语', difficulty: 3, hints: ['以为自己听不见声音，别人也就听不见了', '一手捂住耳朵，一手去偷挂着的铃铛', '首字提示：「掩 〇 〇 〇」'], tags: ['成语', '经典', '搞笑'] },
  { id: 'draw-idiom-06', word: '亡羊补牢', category: '成语俗语', difficulty: 2, hints: ['出了差错后及时修补还不算晚', '羊圈破了个洞跑了羊，赶紧拿木板锤子修围栏', '首字提示：「亡 〇 〇 〇」'], tags: ['成语', '经典', '校园'] },
  { id: 'draw-idiom-07', word: '狐假虎威', category: '成语俗语', difficulty: 3, hints: ['借着强者的威风去吓唬百兽', '小狐狸神气活现走在前面，大老虎跟在后面', '首字提示：「狐 〇 〇 〇」'], tags: ['成语', '经典', '反转'] },
  { id: 'draw-idiom-08', word: '盲人摸象', category: '成语俗语', difficulty: 3, hints: ['只凭局部印象就对整体妄加判断', '几个人闭着眼分别摸大象的腿、鼻子和耳朵', '首字提示：「盲 〇 〇 〇」'], tags: ['成语', '经典'] },
  { id: 'draw-idiom-09', word: '鸡飞狗跳', category: '成语俗语', difficulty: 2, hints: ['形容家里或现场乱成一团、惊慌失措', '带翅膀的家禽扑腾飞起，小狗四处乱蹦', '首字提示：「鸡 〇 〇 〇」'], tags: ['成语', '搞笑', '日常'] },
  { id: 'draw-idiom-10', word: '一心二用', category: '成语俗语', difficulty: 2, hints: ['注意力分散，同时做两件不相干的事', '一颗爱心分裂指向两个不同的任务方向', '首字提示：「一 〇 〇 〇」'], tags: ['成语', '校园', '日常'] },
  { id: 'draw-idiom-11', word: '水中捞月', category: '成语俗语', difficulty: 2, hints: ['白费力气去抓虚幻的倒影', '猴子倒挂在树枝上伸手去池塘里捞月亮', '首字提示：「水 〇 〇 〇」'], tags: ['成语', '经典'] },
  { id: 'draw-idiom-12', word: '拔苗助长', category: '成语俗语', difficulty: 2, hints: ['急于求成违反规律，结果把庄稼弄枯死了', '农夫在田里用力把小禾苗往上拔高', '首字提示：「拔 〇 〇 〇」'], tags: ['成语', '经典', '校园'] },
  { id: 'draw-idiom-13', word: '乌鸦喝水', category: '成语俗语', difficulty: 1, hints: ['聪明的小鸟动脑筋解决了瓶口太窄的问题', '黑鸟叼着小石子一颗颗投进水瓶里让水位上升', '首字提示：「乌 〇 〇 〇」'], tags: ['成语', '校园', '经典'] },
  { id: 'draw-idiom-14', word: '三头六臂', category: '成语俗语', difficulty: 2, hints: ['哪吒显灵时的神通广大形象', '一个人长着三个脑袋和六只挥舞的手臂', '首字提示：「三 〇 〇 〇」'], tags: ['成语', '奇幻', '经典'] },
  { id: 'draw-idiom-15', word: '眉开眼笑', category: '成语俗语', difficulty: 2, hints: ['形容心情极好、满脸喜悦的表情', '弯弯舒展的眉毛加上笑成月牙的眼睛', '首字提示：「眉 〇 〇 〇」'], tags: ['成语', '温情', '轻松'] },

  // 4. 日常百货与道具 (15)
  { id: 'draw-item-01', word: '闹钟', category: '日常物件', difficulty: 1, hints: ['每天早上准时把你从美梦中叫醒的敌人', '圆表盘配两只小耳朵铃铛和小锤子', '首字提示：「闹 〇」'], tags: ['物件', '日常', '校园'] },
  { id: 'draw-item-02', word: '降落伞', category: '日常物件', difficulty: 1, hints: ['高空跳下时保命的巨大半圆布伞', '天空中的彩色蘑菇伞冠吊着一个人', '首字提示：「降 〇 〇」'], tags: ['物件', '经典', '逃生'] },
  { id: 'draw-item-03', word: '放大镜', category: '日常物件', difficulty: 1, hints: ['名侦探寻找蛛丝马迹的标志性随身工具', '一个圆框凸透镜片连着一根手柄', '首字提示：「放 〇 〇」'], tags: ['物件', '悬疑', '经典'] },
  { id: 'draw-item-04', word: '吹风机', category: '日常物件', difficulty: 1, hints: ['洗完头后呼呼吹出热风的小家电', 'L型枪状机身，风口吹出波浪气流', '首字提示：「吹 〇 〇」'], tags: ['物件', '日常', '轻松'] },
  { id: 'draw-item-05', word: '仙人掌', category: '日常物件', difficulty: 1, hints: ['沙漠里最耐旱的绿色植物，浑身是刺', '花盆里绿色的掌状茎，偶尔顶着小花', '首字提示：「仙 〇 〇」'], tags: ['物件', '日常', '轻松'] },
  { id: 'draw-item-06', word: '望远镜', category: '日常物件', difficulty: 2, hints: ['站在山顶或船头看清远方景物的光学仪器', '双筒或单筒可伸缩的观察镜筒', '首字提示：「望 〇 〇」'], tags: ['物件', '经典', '日常'] },
  { id: 'draw-item-07', word: '红绿灯', category: '日常物件', difficulty: 1, hints: ['十字路口指挥车辆停与行的三色哨兵', '竖排或横排的红、黄、绿三个发光圆灯', '首字提示：「红 〇 〇」'], tags: ['物件', '日常', '经典'] },
  { id: 'draw-item-08', word: '高跟鞋', category: '日常物件', difficulty: 2, hints: ['踩上去立马增高、走路哒哒响的时尚单品', '鞋跟又细又高的女士皮鞋', '首字提示：「高 〇 〇」'], tags: ['物件', '日常'] },
  { id: 'draw-item-09', word: '手电筒', category: '日常物件', difficulty: 1, hints: ['停电或夜路探险时照亮前方的便携光源', '圆柱形手柄前端射出一道三角形光束', '首字提示：「手 〇 〇」'], tags: ['物件', '悬疑', '日常'] },
  { id: 'draw-item-10', word: '沙漏', category: '日常物件', difficulty: 2, hints: ['古代用细沙流逝来计时的玻璃器皿', '上下两个对称三角球体中间细腰漏沙', '首字提示：「沙 〇」'], tags: ['物件', '经典', '悬疑'] },
  { id: 'draw-item-11', word: '跷跷板', category: '日常物件', difficulty: 2, hints: ['公园游乐场里需要两个人一上一下配合玩耍', '中间一个三角形支点，上面架着长木板', '首字提示：「跷 〇 〇」'], tags: ['物件', '校园', '温情'] },
  { id: 'draw-item-12', word: '摩天轮', category: '日常物件', difficulty: 2, hints: ['游乐园最高处的浪漫地标，缓缓旋转俯瞰全城', '巨大的圆形轮盘边缘挂满小座舱', '首字提示：「摩 〇 〇」'], tags: ['物件', '温情', '经典'] },
  { id: 'draw-item-13', word: '听诊器', category: '日常物件', difficulty: 2, hints: ['医生挂在脖子上听心跳呼吸的专业工具', 'Y字形软管连着耳塞和圆形金属探头', '首字提示：「听 〇 〇」'], tags: ['物件', '日常'] },
  { id: 'draw-item-14', word: '指南针', category: '日常物件', difficulty: 2, hints: ['中国古代四大发明之一，荒野迷路靠它辨方向', '标着东西南北N/S刻度的圆盘磁针', '首字提示：「指 〇 〇」'], tags: ['物件', '经典', '逃生'] },
  { id: 'draw-item-15', word: '存钱罐', category: '日常物件', difficulty: 2, hints: ['背上有一道窄口，把硬币一枚枚喂进去', '通常是胖乎乎的小猪造型陶瓷罐', '首字提示：「存 〇 〇」'], tags: ['物件', '温情', '日常'] },

  // 5. 影视动漫与角色 (15)
  { id: 'draw-ACG-01', word: '孙悟空', category: '影视动漫', difficulty: 2, hints: ['头戴紧箍咒、手拿金箍棒的齐天大圣', '西游记大师兄，会七十二变和筋斗云', '首字提示：「孙 〇 〇」'], tags: ['动漫', '经典', '奇幻'] },
  { id: 'draw-ACG-02', word: '皮卡丘', category: '影视动漫', difficulty: 1, hints: ['黄皮肤、红脸颊、会放电的超人气宝可梦', '尾巴是闪电形状，耳朵尖是黑色的', '首字提示：「皮 〇 〇」'], tags: ['动漫', '经典', '轻松'] },
  { id: 'draw-ACG-03', word: '哆啦A梦', category: '影视动漫', difficulty: 1, hints: ['来自未来的蓝胖子机器猫，最爱吃铜锣烧', '脖子挂铃铛，肚子上有四次元百宝袋', '首字提示：「哆 〇 A 〇」'], tags: ['动漫', '经典', '温情'] },
  { id: 'draw-ACG-04', word: '奥特曼', category: '影视动漫', difficulty: 2, hints: ['胸前能量灯一闪就开始放大招打小怪兽', '来自M78星云的光之巨人，双手交叉发射光线', '首字提示：「奥 〇 〇」'], tags: ['动漫', '经典', '搞笑'] },
  { id: 'draw-ACG-05', word: '葫芦娃', category: '影视动漫', difficulty: 2, hints: ['一根藤上七朵花，为了救爷爷勇闯妖洞', '头顶小葫芦、身穿彩衣的七兄弟', '首字提示：「葫 〇 〇」'], tags: ['动漫', '经典'] },
  { id: 'draw-ACG-06', word: '蜘蛛侠', category: '影视动漫', difficulty: 2, hints: ['手腕射出蛛丝在高楼大厦间摆荡的超级英雄', '红蓝紧身战衣，胸前有蜘蛛标志', '首字提示：「蜘 〇 〇」'], tags: ['动漫', '经典'] },
  { id: 'draw-ACG-07', word: '名侦探柯南', category: '影视动漫', difficulty: 2, hints: ['外表看似小孩，智慧却过于常人的死神小学生', '戴着大框眼镜、打着红色变声领结', '首字提示：「名 〇 〇 〇 〇」'], tags: ['动漫', '悬疑', '经典'] },
  { id: 'draw-ACG-08', word: '海绵宝宝', category: '影视动漫', difficulty: 1, hints: ['住在太平洋深海菠萝屋里的黄色方形厨师', '浑身小孔、穿着白衬衫打红领带做蟹黄堡', '首字提示：「海 〇 〇 〇」'], tags: ['动漫', '搞笑', '轻松'] },
  { id: 'draw-ACG-09', word: '蜡笔小新', category: '影视动漫', difficulty: 2, hints: ['有着两条粗粗浓眉、喜欢跳草裙舞的五岁小孩', '穿红T恤黄短裤，牵着小白狗', '首字提示：「蜡 〇 〇 〇」'], tags: ['动漫', '搞笑', '日常'] },
  { id: 'draw-ACG-10', word: '白雪公主', category: '影视动漫', difficulty: 2, hints: ['咬了一口毒苹果昏迷不醒的童话主角', '森林里和七个小矮人住在一起的公主', '首字提示：「白 〇 〇 〇」'], tags: ['动漫', '童话', '经典'] },
  { id: 'draw-ACG-11', word: '小黄人', category: '影视动漫', difficulty: 1, hints: ['戴着金属护目镜、身穿牛仔背带裤的黄色胶囊人', '最爱吃香蕉，说着奇奇怪怪的语言', '首字提示：「小 〇 〇」'], tags: ['动漫', '搞笑', '轻松'] },
  { id: 'draw-ACG-12', word: '钢铁侠', category: '影视动漫', difficulty: 2, hints: ['胸口镶嵌发光方舟反应堆的高科技战甲英雄', '红金配色的金属盔甲，手掌心喷射飞行', '首字提示：「钢 〇 〇」'], tags: ['动漫', '科幻', '经典'] },
  { id: 'draw-ACG-13', word: '猪八戒', category: '影视动漫', difficulty: 1, hints: ['手拿九齿钉耙、大耳朵圆肚子的取经二师兄', '高老庄女婿，贪吃爱睡', '首字提示：「猪 〇 〇」'], tags: ['动漫', '经典', '搞笑'] },
  { id: 'draw-ACG-14', word: '功夫熊猫', category: '影视动漫', difficulty: 2, hints: ['爱吃面条包子、最终练成神龙大侠的胖熊猫', '头戴斗笠或摆出武术招式的黑白国宝', '首字提示：「功 〇 〇 〇」'], tags: ['动漫', '经典', '搞笑'] },
  { id: 'draw-ACG-15', word: '美人鱼', category: '影视动漫', difficulty: 1, hints: ['大海深处上半身是少女、下半身是鱼尾的传说生物', '坐在礁石上唱歌，有着漂亮的鱼尾鳞片', '首字提示：「美 〇 〇」'], tags: ['动漫', '童话', '温情'] },

  // 6. 整活热梗与灵魂动作 (15)
  { id: 'draw-meme-01', word: '打工人', category: '整活热梗', difficulty: 2, hints: ['早八挤地铁、对着电脑疯狂敲键盘的当代社畜', '顶着黑眼圈喝冰美式搬砖的上班族', '首字提示：「打 〇 〇」'], tags: ['热梗', '搞笑', '日常'] },
  { id: 'draw-meme-02', word: '躺平', category: '整活热梗', difficulty: 2, hints: ['放弃内卷，直接四仰八叉倒在沙发或地上休息', '一个人笔直平躺着一动不动，头上飘着咸鱼', '首字提示：「躺 〇」'], tags: ['热梗', '搞笑', '轻松'] },
  { id: 'draw-meme-03', word: '吃瓜群众', category: '整活热梗', difficulty: 2, hints: ['遇到热闹八卦时搬好小板凳在旁边围观的人', '手里捧着一瓣大西瓜津津有味地看戏', '首字提示：「吃 〇 〇 〇」'], tags: ['热梗', '搞笑', '日常'] },
  { id: 'draw-meme-04', word: '锦鲤附体', category: '整活热梗', difficulty: 3, hints: ['转发求好运，考试必过、抽奖必中的幸运象征', '一条金光闪闪的大红鱼围绕着笑开花的人', '首字提示：「锦 〇 〇 〇」'], tags: ['热梗', '温情', '校园'] },
  { id: 'draw-meme-05', word: '熬夜冠军', category: '整活热梗', difficulty: 2, hints: ['凌晨三点还在被窝里刷手机，头顶金牌与黑眼圈', '月亮高挂、时钟指着半夜，熊猫眼捧着发光屏幕', '首字提示：「熬 〇 〇 〇」'], tags: ['热梗', '搞笑', '校园'] },
  { id: 'draw-meme-06', word: '单身狗', category: '整活热梗', difficulty: 2, hints: ['情人节在情侣旁边独自流泪的搞笑自嘲称呼', '一只小狗看着旁边成双成对的爱心汪汪哭泣', '首字提示：「单 〇 〇」'], tags: ['热梗', '搞笑', '反转'] },
  { id: 'draw-meme-07', word: '社死现场', category: '整活热梗', difficulty: 4, hints: ['当众出糗尴尬得脚趾能抠出一座三室一厅', '众人目光聚焦下，一个人恨不得钻进地缝里', '首字提示：「社 〇 〇 〇」'], tags: ['热梗', '搞笑', '校园'] },
  { id: 'draw-meme-08', word: '摸鱼', category: '整活热梗', difficulty: 2, hints: ['上班时间偷偷闲逛玩手机，假装在工作', '办公桌电脑前伸手在水里抓了一条鱼', '首字提示：「摸 〇」'], tags: ['热梗', '搞笑', '日常'] },
  { id: 'draw-meme-09', word: '画饼充饥', category: '整活热梗', difficulty: 3, hints: ['老板许诺年底发大财，实际上只存在于图画里', '用画笔在纸上画了一个大圆饼望着流口水', '首字提示：「画 〇 〇 〇」'], tags: ['热梗', '成语', '搞笑'] },
  { id: 'draw-meme-10', word: '显眼包', category: '整活热梗', difficulty: 3, hints: ['人群中动作最夸张、最引人注目的活宝', '一排正常站立的小人里，有一个摆出奇葩姿势发光', '首字提示：「显 〇 〇」'], tags: ['热梗', '搞笑', '轻松'] },
  { id: 'draw-meme-11', word: '科目三', category: '整活热梗', difficulty: 3, hints: ['原本是驾照路考，后来变成了摇花手扭脚踝魔性舞蹈', '小人甩手扭胯跳舞，旁边标着驾考3号牌', '首字提示：「科 〇 〇」'], tags: ['热梗', '搞笑'] },
  { id: 'draw-meme-12', word: '脑洞大开', category: '整活热梗', difficulty: 2, hints: ['奇思妙想源源不断地从脑袋里冒出来', '头顶打开一扇天窗，飞出灯泡、飞碟与彩虹', '首字提示：「脑 〇 〇 〇」'], tags: ['热梗', '奇趣', '反转'] },
  { id: 'draw-meme-13', word: '佛系青年', category: '整活热梗', difficulty: 3, hints: ['不争不抢、一切随缘、拿着保温杯泡枸杞', '盘腿打坐头顶光环，一脸淡定微笑', '首字提示：「佛 〇 〇 〇」'], tags: ['热梗', '轻松', '日常'] },
  { id: 'draw-meme-14', word: '背锅侠', category: '整活热梗', difficulty: 2, hints: ['明明不是自己的错，却替别人扛下了黑锅', '一个人弯着腰，背上背着一口硕大的黑色铁锅', '首字提示：「背 〇 〇」'], tags: ['热梗', '搞笑', '反转'] },
  { id: 'draw-meme-15', word: '广场舞', category: '整活热梗', difficulty: 2, hints: ['傍晚公园里大喇叭放着最炫民族风，整齐划一跳舞', '大音响播放音乐，一群人排着队挥扇子跳舞', '首字提示：「广 〇 〇」'], tags: ['热梗', '日常', '轻松'] },

  // 7. 妙笔生谎 Drawful 奇葩怪题 (10)
  { id: 'drawful-01', word: '正在经历中年危机的企鹅', category: '妙笔生谎', difficulty: 4, hints: ['南极鸟类遇到了脱发与生活压力', '端着保温杯叹气的燕尾服动物', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '反转', '轻松'] },
  { id: 'drawful-02', word: '偷吃贡品被抓包的猫咪', category: '妙笔生谎', difficulty: 3, hints: ['案发现场留有鱼骨头与心虚的眼神', '供桌上慌张逃窜的四脚萌宠', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '动物'] },
  { id: 'drawful-03', word: '在健身房举铁的火柴人', category: '妙笔生谎', difficulty: 3, hints: ['极度瘦弱的四肢却在挑战百斤杠铃', '满头大汗举起巨大哑铃的线条小人', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '运动'] },
  { id: 'drawful-04', word: '害怕打针的霸王龙', category: '妙笔生谎', difficulty: 4, hints: ['史前顶级掠食者面对小护士瑟瑟发抖', '小短手捂着眼睛躲避注射器的恐龙', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '反转'] },
  { id: 'drawful-05', word: '带着降落伞跳伞的猪', category: '妙笔生谎', difficulty: 3, hints: ['原本不会飞的家畜在天空中翱翔', '粉红猪鼻子吊在五彩伞冠下面', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '奇趣'] },
  { id: 'drawful-06', word: '给外星人送外卖的骑手', category: '妙笔生谎', difficulty: 4, hints: ['飞碟旁边停着一辆黄色电动车', '拎着保温餐箱递给大眼睛绿皮肤生物', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '科幻', '搞笑'] },
  { id: 'drawful-07', word: '被闹钟吵醒的太阳', category: '妙笔生谎', difficulty: 3, hints: ['连发光发热的恒星都不想早起上班', '天空中揉着惺忪睡眼、砸向床头钟的火球', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '日常'] },
  { id: 'drawful-08', word: '在月亮上钓鱼的宇航员', category: '妙笔生谎', difficulty: 3, hints: ['穿着太空服坐在月牙尖上甩出鱼竿', '太空失重环境下钓起一颗小星星', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '温情', '科幻'] },
  { id: 'drawful-09', word: '忘记带伞的龙王', category: '妙笔生谎', difficulty: 4, hints: ['自己负责行云布雨却被淋成了落汤鸡', '长着龙角穿龙袍在暴雨中狂奔抱头', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '反转'] },
  { id: 'drawful-10', word: '用望远镜找眼镜的爷爷', category: '妙笔生谎', difficulty: 4, hints: ['老花镜明明就挂在自己的脑门上', '举着大筒望远镜满屋子找东西', '脑洞题：请编造一个最像这幅画的假题目骗票！'], tags: ['妙笔生谎', '搞笑', '温情'] },

  // 8. 怪兽目击者 MonsDRAWsity 奇葩异兽档案 (10)
  {
    id: 'monster-01',
    word: '三眼仙人掌怪',
    category: '怪兽目击',
    difficulty: 3,
    customSurface: '【怪兽目击档案 #01】目击地点：深夜植物园。目击者拥有20秒观察异兽真容，随后口述特征（身体轮廓、眼睛数量、头顶装饰与手脚道具），全员同步绘制警方画像！',
    hints: ['异兽身体是浑身长刺的绿色仙人掌柱', '脸上竖着排列三只大小不一的圆眼睛', '头顶戴着一顶歪斜的西部牛仔帽，手里拿吉他'],
    tags: ['怪兽目击', '奇幻', '搞笑', '经典'],
  },
  {
    id: 'monster-02',
    word: '章鱼电视机怪',
    category: '怪兽目击',
    difficulty: 3,
    customSurface: '【怪兽目击档案 #02】目击地点：废弃电子城。目击者拥有20秒记忆异兽特征，请口述它的头部造型、天线与触手数量，画师们凭描述还原！',
    hints: ['脑袋是一台长着两根V字天线的方框老式电视机', '屏幕里显示着一张咧嘴大笑的锯齿嘴巴', '下半身长着六条带吸盘的紫色章鱼触手，踩着滑板'],
    tags: ['怪兽目击', '科幻', '搞笑'],
  },
  {
    id: 'monster-03',
    word: '荷包蛋飞碟兽',
    category: '怪兽目击',
    difficulty: 2,
    customSurface: '【怪兽目击档案 #03】目击地点：早餐摊上空。目击者请仔细记住这只美食系外星异兽的五官与翅膀位置！',
    hints: ['主体是一颗边缘波浪形的巨大煎荷包蛋', '中间圆圆的蛋黄是一只戴着独眼眼罩的大眼睛', '左右两侧长着一对迷你蝙蝠小翅膀，底下伸出两只弹簧腿'],
    tags: ['怪兽目击', '美食', '搞笑', '轻松'],
  },
  {
    id: 'monster-04',
    word: '茶壶蜗牛龙',
    category: '怪兽目击',
    difficulty: 3,
    customSurface: '【怪兽目击档案 #04】目击地点：古老茶馆后院。目击者请口述它背上的容器造型与触角特征！',
    hints: ['身体像蜗牛一样爬行，但背上的壳是一个冒热气的紫砂茶壶', '头顶长着两根挂着小灯笼的发光触角', '嘴里叼着一片巨大的绿茶叶，尾巴是弯弯的汤勺'],
    tags: ['怪兽目击', '奇幻', '温情'],
  },
  {
    id: 'monster-05',
    word: '闹钟螃蟹王',
    category: '怪兽目击',
    difficulty: 3,
    customSurface: '【怪兽目击档案 #05】目击地点：黄金海岸沙滩。目击者请描述它的表盘躯干与大钳子武器！',
    hints: ['圆圆的肚子是一个指着12点的罗马数字大闹钟', '头顶有两个叮铃作响的铜铃铛耳朵', '左右挥舞着两只巨大的红螃蟹钳子，一边夹着叉子一边夹着柠檬'],
    tags: ['怪兽目击', '海洋', '搞笑'],
  },
];

const EXTRA_COMPAT: SeedPuzzle[] = [
  {
    id: 'zerotang-seed-classic-bar-hiccups',
    title: '打嗝惊吓 · 经典剧场',
    surface: '男人走进酒吧要了一杯水。酒保忽然举枪对准他。他愣了一下，说了声谢谢，连水也没喝就走了。',
    bottom: '打嗝',
    hints: ['男人要水不是因为口渴，而是想缓解身体症状。', '酒保察觉到他在打嗝，故意吓他一跳帮他治好了打嗝。'],
    difficulty: 1,
    tags: ['经典', '轻松', '日常'],
    nsfl: false,
    source: { key: 'zerotang', repo: 'https://github.com/deadmau5v/draw-and-guess', url: 'https://github.com/deadmau5v/draw-and-guess', license: 'MIT' },
    alsoIn: ['anchor'],
  },
  {
    id: 'zerotang-seed-classic-short-match',
    title: '半根火柴 · 热气球剧场',
    surface: '沙漠中发现一名坠落身亡的男人。他没有穿衣服，手里攥着半根未烧过的火柴。附近散落着衣物和行李，却没有飞机残骸。',
    bottom: '热气球',
    hints: ['死者是从空中掉下来的。', '热气球超重，乘客抽签决定谁跳下去，抽中折断的半根火柴的人跳下。'],
    difficulty: 2,
    tags: ['经典', '救援', '极限'],
    nsfl: false,
    source: { key: 'zerotang', repo: 'https://github.com/deadmau5v/draw-and-guess', url: 'https://github.com/deadmau5v/draw-and-guess', license: 'MIT' },
    alsoIn: ['anchor'],
  },
  {
    id: 'haiguitang-14',
    title: '对称床位 · 四字提示',
    surface: '提示：3个字 · 心理与生活习惯词条 · 画出一排绝对整齐对称的物品',
    bottom: '强迫症',
    hints: [
      '杀人的动机，与一个长期形成的生活习惯有关。',
      '二哥去世后，有个每天都会遇到的变化让弟弟很难适应。',
      '留意他们原先睡觉时的位置，以及弟弟希望恢复的状态。',
    ],
    difficulty: 3,
    tags: ['悬疑', '反转', '经典'],
    nsfl: false,
    source: { key: 'draw-bank', repo: 'https://github.com/deadmau5v/draw-and-guess', url: 'https://github.com/deadmau5v/draw-and-guess', license: 'MIT' },
    alsoIn: [],
  },
  ...['custom-daily-01', 'custom-daily-02', 'custom-daily-03', 'custom-daily-04', 'custom-suspense-01', 'custom-suspense-02', 'custom-suspense-03', 'custom-suspense-04'].map((id, idx) => {
    const words = ['老花镜', '自动旋转门', '全息投影', '防盗猫眼', '紫外线灯', '摩斯密码', '指纹锁', '潜望镜'];
    const word = words[idx]!;
    return {
      id,
      title: `画猜题卡 · ${id.slice(-2)} (${word.length}字)`,
      surface: `画题提示：${word.length}个字 · 日常与机关物件 · 请在画板上画出它的外观特征与使用场景，让队友猜出答案！`,
      bottom: `${word}（你画我猜标准答案：${word}，画出该物件的标志性轮廓、结构细节以及人物互动场景即可帮助猜词玩家快速锁定答案。本题源自日常与悬疑道具精选词库，支持同义词与特征联想判定，考验画手的抓特征能力与猜词者的观察力，快来一展身手吧！）`.padEnd(160, '！'),
      hints: [
        '先观察画手勾勒出的整体几何轮廓与比例大小。',
        '留意画作中突出强调的核心部件或光影线条方向。',
        `字数提示：共 ${word.length} 个字，首字为「${word[0]}」。`,
      ],
      difficulty: (idx % 3) + 2,
      tags: ['常理', '物件', '经典', idx < 4 ? '日常' : '悬疑'],
      nsfl: false,
      source: { key: 'draw-bank', repo: 'https://github.com/deadmau5v/draw-and-guess', url: 'https://github.com/deadmau5v/draw-and-guess', license: 'MIT' },
      alsoIn: [],
    };
  }),
];

const seedPuzzles: SeedPuzzle[] = [
  ...WORDS.map((item): SeedPuzzle => ({
    id: item.id,
    title: `${item.category} · ${item.word.length}字词`,
    surface: item.customSurface ?? `画题提示：${item.word.length}个字 · 分类【${item.category}】 · 画手请根据机密词条作画，猜词玩家可在下方输入答案或特征提问！`,
    bottom: item.word,
    hints: item.hints,
    difficulty: item.difficulty,
    tags: ['常理', item.category, ...item.tags],
    nsfl: !!item.nsfl,
    source: {
      key: 'draw-bank',
      repo: 'https://github.com/deadmau5v/draw-and-guess',
      url: 'https://github.com/deadmau5v/draw-and-guess',
      license: 'MIT',
    },
    alsoIn: [],
  })),
  ...EXTRA_COMPAT,
];

writeFileSync(resolve('data/puzzles.json'), JSON.stringify(seedPuzzles, null, 2) + '\n', 'utf8');
console.log(`Generated ${seedPuzzles.length} Draw & Guess + Party Modes word bank items in data/puzzles.json`);
