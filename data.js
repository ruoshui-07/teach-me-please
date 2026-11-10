/* 实验科目表 —— 「蹲一个师姐」
 * 把申报书里的 54 项实验重组成师兄师姐「能带」的 13 个大类
 * maps 字段对应 experiments.json / 申报书实验编号 A1–E14、F1–F10
 */
window.PEEK_DATA = {
  owner: "ruoshui-07",

  days: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],

  periods: ["上午", "下午", "晚上"],

  periodHint: {
    "上午": "9:00–12:00",
    "下午": "14:00–18:00",
    "晚上": "19:00–22:00"
  },

  tiers: [
    { id: 1, name: "1", hint: " " },
    { id: 2, name: "2", hint: "  " },
    { id: 3, name: "3", hint: " " }
  ],

  categories: [
    {
      id: "culture", name: "细胞培养", emoji: "🧫", tier: 1, level: 1, hours: "0.5–1 h",
      why: "所有细胞的起点",
      watch: ["无菌操作", "消化到什么程度该终止", "传代密度"],
      maps: ["A1", "B1", "F1"]
    },
    {
      id: "treat", name: "细胞处理与表型", emoji: "🧪", tier: 1, level: 1, hours: "1–2 h",
      why: "缺糖、缺氧、加药、CCK-8",
      watch: ["铺板密度与时间点", "缺糖/缺氧怎么设对照", "CCK-8 加药，读板"],
      maps: ["A2", "A3", "B1", "E4"]
    },
    {
      id: "func", name: "细胞功能实验", emoji: "🏃", tier: 1, level: 1, hours: "1–3 h（含等待）",
      why: "Transwell、划痕、克隆形成、管形成，手法",
      watch: ["小室怎么放不产生气泡", "划痕的力度一致性", "固定染色的时间点"],
      maps: ["E5", "E7"]
    },
    {
      id: "wb", name: "Western blot", emoji: "🧬", tier: 2, level: 2, hours: "2 天（分两段）",
      why: "高频",
      watch: ["裂解与 BCA 定量", "制胶和上样量", "转膜有没有转透", "条带怎么判读"],
      maps: ["B3", "C7", "E12", "F4", "F5"]
    },
    {
      id: "if", name: "免疫荧光与成像", emoji: "🔬", tier: 2, level: 2, hours: "1 天（分两段）",
      why: "大创相关",
      watch: ["爬片/种板", "固定透化的分寸", "抗体浓度与背景", "共聚焦怎么调参数"],
      maps: ["B4", "B6", "C6"]
    },
    {
      id: "qpcr", name: "核酸提取与 qPCR", emoji: "🌡️", tier: 2, level: 2, hours: "半天",
      why: "提 RNA、逆转录、上机",
      watch: ["RNase 防护", "逆转录体系", "加样重复性", "熔解曲线怎么看"],
      maps: ["A5", "D9", "E12", "F6"]
    },
    {
      id: "clone", name: "分子克隆", emoji: "🔧", tier: 2, level: 2, hours: "2–3 天（分段）",
      why: "大创：NLS 突变体",
      watch: ["引物设计", "酶切/同源重组", "转化与涂板", "挑单克隆送测序"],
      maps: ["C2", "C3", "F2"]
    },
    {
      id: "flow", name: "流式细胞术", emoji: "📊", tier: 2, level: 2, hours: "半天",
      why: "周期、凋亡、分选，一个下午能看完一整轮",
      watch: ["单细胞悬液怎么制备", "补偿设置", "圈门逻辑"],
      maps: ["E6"]
    },
    {
      id: "ihc", name: "组织切片与免疫组化", emoji: "🩸", tier: 3, level: 3, hours: "2–3 天",
      why: "周期长、步骤多",
      watch: ["固定包埋", "抗原修复", "显色与封片", "结果判读标准"],
      maps: ["B6", "E11", "F7"]
    },
    {
      id: "virus", name: "慢病毒与稳转构建", emoji: "🦠", tier: 3, level: 3, hours: "1–2 周",
      why: "周期长、规范多",
      watch: ["包装体系与转染", "滴度怎么定", "感染与筛选", "单克隆化"],
      maps: ["C4", "E1", "E3", "F3"]
    },
    {
      id: "animal", name: "动物实验", emoji: "🐭", tier: 3, level: 3, hours: "半天 / 单次",
      why: "涉及伦理与资质，通常需要老师授权，先跟着看",
      watch: ["裸鼠皮下接种", "瘤径测量", "取材与固定", "伦理与记录"],
      maps: ["E9", "E10", "F9"]
    },
    {
      id: "omics", name: "组学样品制备", emoji: "🧾", tier: 3, level: 3, hours: "1 天（分两段）",
      why: "RNA-seq 送样、ChIP/CUT&RUN 建库、Co-IP 样品，贵而且要求高",
      watch: ["样品量与质控", "建库前处理", "送样单怎么填"],
      maps: ["A4", "D1", "D2", "D4", "D5", "D6", "D7"]
    },
    {
      id: "bioinfo", name: "生信分析与作图", emoji: "💻", tier: 3, level: 2, hours: "半天",
      why: " ",
      watch: ["DESeq2 差异分析", "MACS2 / HOMER", "R 或 Python 作图"],
      maps: ["D8", "F8", "B7"]
    }
  ]
};
