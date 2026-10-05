import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const newPuzzles = [
  {
    id: "viral-cow-grass",
    title: "牛吃草",
    surface: "你独自住在郊外，隔壁只有一户养牛的邻居。深夜你听见吵闹声，随后听见牛叫、牛撞开栅栏和牛吃草的声响。不久，有东西在撞你家大门，你没有理会继续睡下。第二天，警察敲响了你的门。",
    bottom: "邻居夫妻半夜发生激烈争吵，失去理智的丈夫残忍割去妻子的舌头并砍断其四肢。妻子发出的绝望呻吟被隔壁误听为“牛叫”；丈夫自杀后，重伤的妻子用躯干撞开房门，在草地上用嘴咬住青草压迫口腔止血（误听为“牛吃草”），一路挣扎爬到你家门前撞门求救。因无人开门，妻子失血过多身亡。",
    hints: [
      "深夜在那片草地上发生的所有声响，其实从来没有一头真正的牲畜参与其中。",
      "那名身受重伤的邻居所做的每一个举动，本质上都是在生命悬于一线时的本能挣扎与自救。",
      "你所听到的“进食声”，其实是一种在极端痛苦与绝望下被迫采取的物理压迫止血方式。"
    ],
    difficulty: 4,
    tags: ["微恐", "邻居", "求救", "经典反转"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-red-heels",
    title: "红色高跟鞋",
    surface: "小红买了一双漂亮的红色高跟鞋，当晚穿着它去了工作场地。几个小时后，小红不幸身亡。",
    bottom: "小红是马戏团的杂技演员，负责头顶物品配合搭档表演“蒙眼飞刀/飞镖”。日常排练和小红平时的演出都是穿着平底鞋进行的。当晚她穿了新买的高跟鞋登台，导致头部位置比平时高出了几厘米。搭档在蒙眼状态下完全依赖长久训练形成的肌肉记忆掷出飞刀，失误命中其头部要害导致死亡。",
    hints: [
      "这起悲剧的发生完全源于一场表演中的默契失灵，现场并不存在任何主观恶意。",
      "那双鞋子本身没有任何质量缺陷，它唯一改变的仅仅是一项极度微小的空间物理参数。",
      "掷出致命一击的那个人，在出手的整个过程中，视线其实处于完全受阻的状态。"
    ],
    difficulty: 3,
    tags: ["本格", "职业", "意外", "经典反转"],
    nsfl: false,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-balloon",
    title: "气球",
    surface: "四周漆黑一片。还好爸爸带了蜡烛，哥哥带了食物，妈妈最伟大，最后用气球救了我。",
    bottom: "一家四口在野外露营遭遇山体严重坍塌，被深埋在暗无天日的地下洞穴中。父母和哥哥当场或相继遇难，年幼的孩子为了等待漫长的搜救，只能利用生物残留延续生机：用遗体脂肪提炼照明，靠最后的给养充饥。正值酷暑，遗体由于厌氧腐败产生大量气体迅速膨胀（形成法医学上的“巨人观”，膨胀如气球）。听到地表传来挖掘声后，孩子刺破了气球般的膨胀体，释放出的强烈异味指引搜救犬准确定位，使他成功获救。",
    hints: [
      "这个封闭的空间并非普通的野营帐篷，而是一处彻底与外界隔绝的绝境。",
      "在这个昏暗的环境里，所有用来维持生命和传递信息的物资，都直接取自现实的人体。",
      "那个所谓的“气球”之所以能够膨胀并引来外面的救援，是由于环境温度引发了某种不可逆的生物腐败现象。"
    ],
    difficulty: 5,
    tags: ["绝境", "生存", "细思极恐", "经典反转"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-peeping",
    title: "偷窥",
    surface: "小区新来了一个女孩，我总爱在窗前看着她。今天她突然躲进了窗帘后，像发现了什么似的失声尖叫，接着屋里传来一声愤怒的咆哮：“我要杀了你！”随后我死了。",
    bottom: "女孩是男主人的情人，趁着女主人出差来到公寓。不料女主人提前返家，慌乱中女孩赤身躲到了窗帘后。四处张望寻找掩蔽物时，女孩偶然透过窗户看到了对楼已经上吊悬挂在窗前的“我”的尸体。惊恐之下女孩失声尖叫，跑回卧室时被女主人撞个正着。女主人误以为丈夫背叛而愤怒暴怒；而“我”其实早已自杀身亡，是在自杀的形态下“看着”她。",
    hints: [
      "观察者在整个事件发生的这一刻，其实早就已经失去了生命体征和行动能力。",
      "女孩并不是因为注意到了暗中观察的目光而害怕，而是被对面窗户里呈现出的恐怖死相吓得失声尖叫。",
      "屋里爆发的激烈冲突并不是针对窗外的目击者，而是一场毫无防备的私人关系穿帮。"
    ],
    difficulty: 3,
    tags: ["误会", "坠落", "惊悚", "经典反转"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-mermaid-princess",
    title: "人鱼公主",
    surface: "人鱼公主与人类王子相爱并来到了王子的王国。不久后皇宫传来了王子的死讯，人鱼公主却平安回到了大海。",
    bottom: "相传吃了人鱼的肉就可以在深海中自如呼吸生存。王国的臣民因长期患病残疾，极度渴望移居大海，在得知王子的新娘是人鱼后，纷纷密谋分食人鱼肉。王子深知民怨与贪婪无法遏止，为了让人鱼公主免遭屠戮，他在大典前夜服毒自尽，并在遗体旁伪造了血书“人鱼肉蕴含剧毒，食之暴毙”。众人大惊不敢再犯，人鱼公主由此得以在悲痛中安全返回深海。",
    hints: [
      "王子所统治的子民们之所以对这位新王妃虎视眈眈，是因为民间流传着一个关于她体质的荒诞传说。",
      "王子的死亡并不是由于外部敌人的刺杀，而是一场经过周密设计的苦肉计。",
      "留在遗体旁边的警告是一场谎言，而正是这个谎言击退了人群心中最深沉的贪欲。"
    ],
    difficulty: 4,
    tags: ["童话", "暗黑", "牺牲", "守护"],
    nsfl: false,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-red-coat",
    title: "要买红衣服吗",
    surface: "每天深夜，宿舍门外总有人轻声问：“要买红衣服吗？”大家一直没理睬。昨晚被吵得心烦的我随口回了句“买吧买吧”。第二天，整间寝室的人都死了。",
    bottom: "门外的敲门者是一名心理扭曲的剥皮连环杀手。“红衣服”根本不是纺织衣物，而是剥去整张人皮后暴露出的鲜红血肉。得到屋内的正面肯定答复后，凶手强行撬门而入，将宿舍里所有人的表皮残忍剥离，让所有人“穿”上了所谓的红衣服。",
    hints: [
      "门外所推销的“商品”，在现实生活里根本无法用任何货币在商店中购买。",
      "那件所谓鲜艳夺目的“红衣服”，实际上是人体最外层防御屏障被外力强行剥夺后的直观景象。",
      "门内的那句漫不经心的随口回应，被凶手当成了一种准许施暴的契约许可。"
    ],
    difficulty: 4,
    tags: ["校园", "怪谈", "都市传说", "恐怖"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-hamster-chocolate",
    title: "仓鼠与巧克力",
    surface: "弟弟养的仓鼠死了，弟弟伤心地哭了。妈妈为了安慰他，奖励了他一块和仓鼠体积一样大的巧克力。不久后，哥哥死了。",
    bottom: "年幼的弟弟并不能理解死亡的真正含义，但他记住了妈妈制定的规则——失去什么体型的宠物，就能获得对应等大体积的美味巧克力。弟弟为了得到一块巨大无比、足够他吃很久的巧克力，偷偷把正在睡觉的哥哥杀害了。",
    hints: [
      "制造这场家庭悲剧的始作俑者，其认知水平对“生命终结”根本没有任何敬畏与概念。",
      "母亲出于好意设立的安抚机制，在稚嫩而贪婪的心智中被异化成了一场按重计价的兑换游戏。",
      "导致家庭成员遇害的根本诱因，仅仅是一份对于甜食的盲目渴望。"
    ],
    difficulty: 3,
    tags: ["家庭", "童真", "畸形", "经典反转"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-rain-blood",
    title: "下雨了",
    surface: "下雨了，他死了；雨停了，我死了。",
    bottom: "我正在自家阳台上闭目晒太阳，突然感觉有水滴落在脸上，以为天空中下起了细雨。然而睁开眼看时，楼上被害者的尸体正悬在窗外，滴落在自己脸上的其实是浓稠的鲜血。我因过度受惊大声尖叫，这声尖叫暴露了我目睹凶案的事实，上面的凶手立刻下楼破门而入将我灭口（“雨停了”指楼上的出血停止或凶手已完成作案下楼）。",
    hints: [
      "前后两场死亡之间，唯一的因果联结在于一场对于天候环境的严重感官误判。",
      "落在观察者脸颊上的液体，带有完全不同于自然雨水的温度与黏稠度。",
      "观察者之所以招来杀身之祸，是因为他在发现异常瞬间做出的本能生理反应惊动了附近真正的凶徒。"
    ],
    difficulty: 3,
    tags: ["邻里", "误认", "目击", "经典反转"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-sister-room",
    title: "妹妹的房间",
    surface: "深夜，妹妹的房间里频繁传出球鞋用力摩擦木地板的尖锐声响。我推开虚掩的门，只看见妹妹空洞的眼神直勾勾地盯着我。我吓得跑下楼去叫保安，然而刚跑出门口我就倒在了血泊中。",
    bottom: "妹妹早在几个小时前就在房间里被潜入的凶手杀害。凶手为了毁尸灭迹，正穿着胶底球鞋在地板上吃力地拖拽搬运沉重的尸体（胶底在木地板上发出了刺耳的摩擦声）。推开门时妹妹直勾勾盯着我，是因为她已经被摆放在墙角早已断气。而凶手当时正潜伏在门后的阴影中，看见哥哥推门并转身逃跑，凶手立即追赶出来在楼梯间将哥哥灭口。",
    hints: [
      "深夜那个房间里传出的刺耳声响，来源于有人正在极度费力地转移重物。",
      "门缝里看到的亲人之所以眼神空洞毫无反应，是因为她的意识早已彻底消逝。",
      "真正的危险并非来自房间里那个看似诡异的身影，而是隐藏在门后视觉盲区中的潜伏者。"
    ],
    difficulty: 4,
    tags: ["惊悚", "拖拽", "目击", "凶杀"],
    nsfl: true,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  },
  {
    id: "viral-car-baby",
    title: "车内的婴儿",
    surface: "深夜丈夫驾车带着妻子在国道上疾驰。半路上车子突然燃油耗尽熄火，丈夫锁好所有车门下车徒步去取油。等他提着油桶回来时，车窗完好无损，车门依旧锁着，车内却莫名多了一个人。",
    bottom: "深夜疾驰是因为孕晚期的妻子突然羊水破裂即将临盆，丈夫急送妻子赶往医院。熄火期间妻子在密闭的车厢内独自完成了分娩，丈夫返回时看到的多出的那个人，正是刚刚平安降生的新生婴儿。",
    hints: [
      "这并不是一起超自然穿墙事件，车门和车窗的锁闭状态自始至终未曾遭到任何破坏。",
      "那名新出现的“乘客”，在车辆熄火之前其实就已经处于车厢内部的某个容器之中。",
      "丈夫深夜冒着严寒超速行驶的真正目的，是一场争分夺秒迎接新生命的紧急转移。"
    ],
    difficulty: 2,
    tags: ["家庭", "深夜", "温情", "经典反转"],
    nsfl: false,
    source: {
      key: "viral-community",
      repo: "https://github.com/deadmau5v/turtle-soup",
      url: "community",
      license: "CC-BY-NC-4.0"
    },
    alsoIn: []
  }
];

const jsonPath = './data/puzzles.json';
const dbPath = './turtle.db';

const puzzles = JSON.parse(readFileSync(jsonPath, 'utf8'));
const existingIds = new Set(puzzles.map(p => p.id));
let added = 0;

for (const p of newPuzzles) {
  if (!existingIds.has(p.id)) {
    puzzles.push(p);
    existingIds.add(p.id);
    added++;
  }
}

writeFileSync(jsonPath, JSON.stringify(puzzles, null, 2) + '\n', 'utf8');
console.log(`JSON 已更新，新增 ${added} 道爆款剧本，总计：${puzzles.length} 题。`);

const db = new DatabaseSync(dbPath);
const insert = db.prepare('INSERT OR REPLACE INTO puzzles(id,title,surface,bottom,hints,difficulty,tags,nsfl,source,also_in,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
db.exec('BEGIN IMMEDIATE');
for (const p of newPuzzles) {
  insert.run(
    p.id,
    p.title,
    p.surface,
    p.bottom,
    JSON.stringify(p.hints),
    p.difficulty,
    JSON.stringify(p.tags),
    Number(p.nsfl),
    JSON.stringify(p.source),
    JSON.stringify(p.alsoIn),
    Date.now()
  );
}
db.exec('COMMIT');
const count = db.prepare('SELECT count(*) as n FROM puzzles').get().n;
console.log(`数据库已更新，当前有效剧本总数：${count} 题。`);
db.close();
