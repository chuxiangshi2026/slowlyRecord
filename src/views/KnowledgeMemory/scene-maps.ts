/**
 * 现象动画映射：条目 id → 专属场景配置。
 * 每条反应单独配置容器、液体颜色、粒子效果与现象文案；没有映射的条目不显示「现象动画」按钮。
 * 全部用 Canvas 代码绘制，不引入任何图片/视频资源。
 * 带 steps 的条目为分步演示：逐步覆盖基础配置展示反应过程；textOnly 的条目无 canvas，仅纯文字分步（适合无合适可视化原语的物理实验）。
 */

/** 一个专属现象动画的完整配置 */
export interface SceneConfig {
    /** 容器形状：试管 / 烧杯 / 无容器（燃烧类纯火焰场景） */
    vessel: 'testTube' | 'beaker' | 'none';
    /** 液面高度比例（从容底部算起，0-1），默认 0.65 */
    liquidLevel?: number;
    /** 液体颜色（无液体则不画） */
    liquidColor?: string;
    /** 气泡颜色：设置后产生上升气泡（气体逸出） */
    bubbleColor?: string;
    /** 沉淀颗粒颜色：设置后产生下沉颗粒并在底部堆积（沉淀生成） */
    sedimentColor?: string;
    /** 火星颜色组：设置后从火焰处飞溅火星（燃烧类） */
    sparkColors?: string[];
    /** 主火焰颜色：燃烧类画面中央的火焰，或加热类容器底部的小火焰 */
    flameColor?: string;
    /** 容器底部加热火焰（加热制气类） */
    heating?: boolean;
    /** 分步演示的单步配置：有 steps 时按步覆盖基础场景 */
    steps?: SceneStep[];
    /** 纯文字分步：不渲染 canvas，仅展示步骤条与文字说明 */
    textOnly?: boolean;
    /** 现象说明文案（无 steps 时为唯一说明；有 steps 时为整条目的总结） */
    caption: string;
}

/** 分步演示的单步：caption 为该步说明；其余字段覆盖基础场景配置（空串 '' 表示关闭该效果） */
export type SceneStep = { caption: string } & Partial<Omit<SceneConfig, 'steps' | 'caption' | 'sparkColors'>> & {
    /** 覆盖火星颜色组；传 '' 表示关闭火星效果 */
    sparkColors?: string[] | '';
};

/** 条目 id → 专属现象动画配置 */
export const SCENE_ANIMATIONS: Record<string, SceneConfig> = {
    // 氢气的燃烧：淡蓝色火焰
    'chemistry-formulas-8': {
        vessel: 'none',
        flameColor: '#7db9e8',
        sparkColors: ['#a8d4f0', '#7db9e8', '#e8f4fc'],
        caption: '现象：安静地燃烧，发出淡蓝色火焰，放出大量的热，烧杯内壁出现水珠',
        steps: [
            {caption: '① 点燃纯净的氢气：安静地燃烧，发出淡蓝色火焰', sparkColors: ''},
            {caption: '② 持续燃烧，放出大量的热'},
            {caption: '③ 结论：氢气与氧气反应生成水，烧杯内壁出现水珠', sparkColors: ''},
        ],
    },
    // 碳的完全燃烧：发白光
    'chemistry-formulas-9': {
        vessel: 'none',
        flameColor: '#ffb84d',
        sparkColors: ['#ffd591', '#ff9c6e', '#fff2e8'],
        caption: '现象：剧烈燃烧，发出白光，放出热量，生成能使澄清石灰水变浑浊的气体',
        steps: [
            {caption: '① 点燃木炭：在空气中发出红光，缓慢燃烧', sparkColors: ''},
            {caption: '② 放入氧气中剧烈燃烧，发出白光，放出热量'},
            {caption: '③ 结论：碳与氧气反应生成二氧化碳，能使澄清石灰水变浑浊', sparkColors: ''},
        ],
    },
    // 硫在氧气中燃烧：蓝紫色火焰
    'chemistry-formulas-10': {
        vessel: 'none',
        flameColor: '#9d8df1',
        sparkColors: ['#b8a9f5', '#9d8df1', '#d6ccf7'],
        caption: '现象：发出明亮的蓝紫色火焰，放出热量，生成有刺激性气味的气体',
        steps: [
            {caption: '① 点燃硫粉：在空气中发出微弱的淡蓝色火焰', sparkColors: ''},
            {caption: '② 伸入盛有氧气的集气瓶中，发出明亮的蓝紫色火焰，放出热量'},
            {caption: '③ 结论：生成有刺激性气味的二氧化硫气体', sparkColors: ''},
        ],
    },
    // 铁在氧气中燃烧：火星四射
    'chemistry-formulas-11': {
        vessel: 'none',
        flameColor: '#ff7a45',
        sparkColors: ['#ffd591', '#ff9c6e', '#ff4d4f'],
        caption: '现象：剧烈燃烧，火星四射，放出大量的热，生成黑色固体',
        steps: [
            {caption: '① 把打磨过的细铁丝绕成螺旋状，下端系一根火柴，点燃火柴预热', sparkColors: ''},
            {caption: '② 铁丝在氧气中剧烈燃烧，火星四射，放出大量的热'},
            {caption: '③ 结论：生成黑色固体四氧化三铁', sparkColors: ''},
        ],
    },
    // 过氧化氢分解制氧气：常温催化，大量气泡
    'chemistry-formulas-12': {
        vessel: 'testTube',
        liquidColor: '#e8f2f8',
        bubbleColor: '#6ba8c9',
        caption: '现象：常温下迅速产生大量气泡（二氧化锰作催化剂，本身不变）',
        steps: [
            {caption: '① 试管中加入过氧化氢溶液，再放入少量二氧化锰催化剂', bubbleColor: ''},
            {caption: '② 常温下迅速产生大量气泡，氧气不断逸出'},
            {caption: '③ 用带火星的木条检验：木条复燃，证明生成了氧气（二氧化锰本身不变）'},
        ],
    },
    // 加热高锰酸钾制氧气：紫色固体 + 加热
    'chemistry-formulas-13': {
        vessel: 'testTube',
        liquidColor: '#e3dcef',
        bubbleColor: '#9d8df1',
        heating: true,
        flameColor: '#ff9c6e',
        caption: '现象：加热后导管口有连续气泡冒出，暗紫色固体逐渐变化',
        steps: [
            {caption: '① 试管口略向下倾斜，加入暗紫色高锰酸钾固体，连接好导管（管口塞一团棉花）', heating: false, bubbleColor: ''},
            {caption: '② 点燃酒精灯加热：导管口有连续气泡冒出'},
            {caption: '③ 用排水法收集氧气；检验：带火星的木条复燃', heating: false},
        ],
    },
    // 氯酸钾催化分解制氧气：加热 + 催化
    'chemistry-formulas-14': {
        vessel: 'testTube',
        liquidColor: '#f0ece4',
        bubbleColor: '#c9a86b',
        heating: true,
        flameColor: '#ff9c6e',
        caption: '现象：加热并加入二氧化锰催化后，有气泡连续冒出',
        steps: [
            {caption: '① 试管中加入氯酸钾与二氧化锰的混合物，试管口略向下倾斜', heating: false, bubbleColor: ''},
            {caption: '② 加热并用二氧化锰催化：有气泡连续冒出'},
            {caption: '③ 收集并检验氧气：带火星的木条复燃', heating: false},
        ],
    },
    // 实验室制二氧化碳：烧杯中石灰石与稀盐酸反应
    'chemistry-formulas-15': {
        vessel: 'beaker',
        liquidColor: '#e8f2f8',
        bubbleColor: '#6ba8c9',
        caption: '现象：块状石灰石表面产生大量气泡，固体逐渐溶解变小',
        steps: [
            {caption: '① 烧杯中加入块状石灰石（或大理石），倒入稀盐酸', bubbleColor: ''},
            {caption: '② 石灰石表面立即产生大量气泡，反应开始'},
            {caption: '③ 固体逐渐溶解变小；检验：气体能使燃着的木条熄灭（二氧化碳）'},
        ],
    },
    // 二氧化碳通入澄清石灰水：白色沉淀
    'chemistry-formulas-18': {
        vessel: 'beaker',
        liquidColor: '#dce8ee',
        sedimentColor: '#ffffff',
        caption: '现象：澄清石灰水变浑浊，白色碳酸钙沉淀逐渐沉降到杯底',
        steps: [
            {caption: '① 烧杯中盛有澄清石灰水，溶液透明', sedimentColor: ''},
            {caption: '② 通入二氧化碳，石灰水开始变浑浊（生成碳酸钙）'},
            {caption: '③ 白色沉淀逐渐沉降到杯底'},
        ],
    },
    // 探究唾液对淀粉的消化作用：37℃ 水浴加热
    'biology-experiments-4': {
        vessel: 'testTube',
        liquidColor: '#f3ead3',
        heating: true,
        flameColor: '#ff9c6e',
        caption: '现象：37℃ 温水水浴约 10 分钟；取出滴加碘液后，加唾液的 A 管不变蓝（淀粉被分解），加清水的 B 管变蓝',
        steps: [
            {caption: '① A、B 两试管分别加入等量淀粉液，A 管加唾液，B 管加等量清水', heating: false},
            {caption: '② 放入 37℃ 温水浴约 10 分钟（模拟人体口腔温度）'},
            {caption: '③ 取出滴加碘液：A 管不变蓝（淀粉被唾液分解），B 管变蓝', heating: false},
        ],
    },
    // 验证光合作用产生氧气：阳光下金鱼藻不断冒气泡
    'biology-experiments-5': {
        vessel: 'beaker',
        liquidColor: '#dceee2',
        bubbleColor: '#7fb8a4',
        caption: '现象：阳光下金鱼藻不断冒出气泡，试管内气体逐渐增多，取出后能使带火星的卫生香复燃',
        steps: [
            {caption: '① 大烧杯中放入金鱼藻，倒扣一支装满水的试管，整体置于阳光下', bubbleColor: ''},
            {caption: '② 阳光下金鱼藻光合作用不断冒出气泡（氧气），试管内气体逐渐增多'},
            {caption: '③ 收集气体后用带火星的卫生香检验：卫生香复燃'},
        ],
    },
    // 探究馒头在口腔中的变化：37℃ 水浴加热
    'biology-experiments-10': {
        vessel: 'testTube',
        liquidColor: '#f3ead3',
        heating: true,
        flameColor: '#ff9c6e',
        caption: '现象：37℃ 水浴后滴加碘液：1 号（碎屑+唾液）不变蓝，2 号（碎屑+清水）变蓝，3 号（整块+唾液）表层变浅',
        steps: [
            {caption: '① 1 号加馒头碎屑和唾液，2 号加馒头碎屑和清水，3 号加整块馒头和唾液', heating: false},
            {caption: '② 三支试管放入 37℃ 温水浴 10 分钟（模拟口腔温度）'},
            {caption: '③ 取出滴加碘液：1 号不变蓝，2 号变蓝，3 号表层变浅', heating: false},
        ],
    },
    // 物理实验 1-15：无合适可视化原语，均为纯文字分步
    // 测量固体的密度
    'physics-experiments-1': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：ρ=m/V，用天平测质量、排水法测体积。',
        steps: [
            {caption: '① 器材准备：天平、量筒、烧杯、水、细线、待测固体（如小石块）'},
            {caption: '② 用天平测出固体的质量 m'},
            {caption: '③ 量筒中倒入适量水，读出示数 V₁'},
            {caption: '④ 用细线拴住固体缓慢浸没水中，读出 V₂，固体体积 V=V₂−V₁'},
            {caption: '⑤ 计算密度 ρ=m/(V₂−V₁)；先测质量再测体积，可减小误差'},
        ],
    },
    // 测量液体的密度
    'physics-experiments-2': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：ρ=(m₁−m₂)/V，测「剩余法」避免烧杯壁残留造成误差。',
        steps: [
            {caption: '① 器材准备：天平、量筒、烧杯、待测液体（如盐水）'},
            {caption: '② 用天平测出烧杯和液体的总质量 m₁'},
            {caption: '③ 将部分液体倒入量筒，读出体积 V'},
            {caption: '④ 再用天平测出剩余液体和烧杯的质量 m₂，则倒入量筒的液体质量 m=m₁−m₂'},
            {caption: '⑤ 计算密度 ρ=(m₁−m₂)/V'},
        ],
    },
    // 探究杠杆的平衡条件
    'physics-experiments-3': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：动力×动力臂=阻力×阻力臂，即 F₁L₁=F₂L₂。',
        steps: [
            {caption: '① 器材准备：杠杆、支架、钩码（或弹簧测力计）、刻度尺'},
            {caption: '② 调节杠杆两端的平衡螺母，使杠杆在水平位置平衡（便于直接读出力臂）'},
            {caption: '③ 在杠杆两侧挂钩码并移动位置，多次改变力和力臂（也可用弹簧测力计竖直拉动），记录数据'},
            {caption: '④ 结论：动力×动力臂=阻力×阻力臂，即 F₁L₁=F₂L₂'},
        ],
    },
    // 伏安法测电阻
    'physics-experiments-4': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：R=U/I，电流表串联、电压表并联，多次测量取平均。',
        steps: [
            {caption: '① 器材准备：电源、开关、电流表、电压表、滑动变阻器、待测电阻、导线'},
            {caption: '② 按电路图连接：电流表与电阻串联，电压表与电阻并联，滑动变阻器串联接入起保护和改变电压的作用'},
            {caption: '③ 闭合开关，读出电阻两端的电压 U 和通过电阻的电流 I'},
            {caption: '④ 由 R=U/I 计算电阻；移动滑片多次测量求平均值，减小误差'},
        ],
    },
    // 探究凸透镜成像的规律
    'physics-experiments-5': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：物距不同，成倒立缩小实像、倒立放大实像或正立放大虚像。',
        steps: [
            {caption: '① 器材准备：光具座、凸透镜、蜡烛（或 LED 光源）、光屏、刻度尺'},
            {caption: '② 将蜡烛、凸透镜、光屏依次放在光具座上，调节三者中心在同一高度'},
            {caption: '③ 移动蜡烛改变物距，移动光屏找到清晰的像，多次实验记录'},
            {caption: '④ 结论：u＞2f 成倒立、缩小的实像（照相机）；f＜u＜2f 成倒立、放大的实像（投影仪）；u＜f 成正立、放大的虚像（放大镜）'},
        ],
    },
    // 探究平面镜成像的特点
    'physics-experiments-6': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：像与物等大、等距，连线与镜面垂直，像是虚像。',
        steps: [
            {caption: '① 器材准备：玻璃板、两支相同的蜡烛、刻度尺、白纸、支架'},
            {caption: '② 用玻璃板代替平面镜竖直放置（便于确定像的位置）'},
            {caption: '③ 拿一支未点燃的相同蜡烛在玻璃板后移动，直到与像完全重合，比较像与物的大小'},
            {caption: '④ 用刻度尺测像、物到玻璃板的距离'},
            {caption: '⑤ 结论：像与物大小相等、到镜面距离相等、连线与镜面垂直，平面镜成虚像'},
        ],
    },
    // 探究影响滑动摩擦力大小的因素
    'physics-experiments-7': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：滑动摩擦力与压力、接触面粗糙程度有关，与接触面积和速度无关。',
        steps: [
            {caption: '① 器材准备：弹簧测力计、木块、砝码、粗糙程度不同的接触面（木板、毛巾等）'},
            {caption: '② 用弹簧测力计沿水平方向匀速拉动木块，拉力等于滑动摩擦力（二力平衡）'},
            {caption: '③ 控制变量：分别改变压力大小（加砝码）和接触面粗糙程度（铺毛巾等），测出各组摩擦力'},
            {caption: '④ 结论：压力越大、接触面越粗糙，滑动摩擦力越大；与接触面积大小和运动速度无关'},
        ],
    },
    // 探究压力的作用效果跟什么因素有关
    'physics-experiments-8': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：压力作用效果与压力大小、受力面积有关（转换法）。',
        steps: [
            {caption: '① 器材准备：海绵（或细沙）、小桌、砝码'},
            {caption: '② 通过海绵（或沙子）的凹陷程度显示压力的作用效果（转换法）'},
            {caption: '③ 控制变量：改变压力大小（加砝码）和受力面积大小（小桌正放、倒放），观察凹陷程度'},
            {caption: '④ 结论：受力面积一定时，压力越大作用效果越明显；压力一定时，受力面积越小作用效果越明显'},
        ],
    },
    // 探究浮力的大小跟哪些因素有关
    'physics-experiments-9': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：F浮=G−F拉；浮力与排开液体的体积和液体密度有关。',
        steps: [
            {caption: '① 器材准备：弹簧测力计、圆柱体（或石块）、水、盐水、烧杯（溢水杯）'},
            {caption: '② 称重法测浮力：先测物重 G，再把物体浸入液体读拉力 F拉，F浮=G−F拉'},
            {caption: '③ 控制变量：改变物体浸入液体中的体积和液体密度，比较浮力大小'},
            {caption: '④ 结论：浮力与排开液体的体积和液体密度有关，与浸没后的深度无关'},
            {caption: '⑤ 用溢水杯验证阿基米德原理：F浮=G排'},
        ],
    },
    // 测量滑轮组的机械效率
    'physics-experiments-10': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：η=Gh/(Fs)×100%，同一滑轮组重物越重效率越高。',
        steps: [
            {caption: '① 器材准备：滑轮组、铁架台、弹簧测力计、刻度尺、钩码、细绳'},
            {caption: '② 竖直匀速拉动弹簧测力计，读出拉力 F'},
            {caption: '③ 测出物体上升高度 h 和绳端移动距离 s（s=nh，n 为承担物重的绳子段数）'},
            {caption: '④ 计算机械效率 η=W有用/W总×100%=Gh/(Fs)×100%'},
            {caption: '⑤ 结论：同一滑轮组提升的重物越重，机械效率越高；动滑轮越重、摩擦越大，机械效率越低'},
        ],
    },
    // 探究电流与电压、电阻的关系
    'physics-experiments-11': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：电阻一定时电流与电压成正比；电压一定时电流与电阻成反比。',
        steps: [
            {caption: '① 器材准备：电源、开关、电流表、电压表、滑动变阻器、不同阻值的定值电阻、导线'},
            {caption: '② 保持电阻不变：用滑动变阻器改变定值电阻两端的电压，记录多组 U、I'},
            {caption: '③ 保持电压不变：更换不同阻值的定值电阻，调节滑动变阻器使电压表示数不变，记录 I'},
            {caption: '④ 结论：电阻一定时，电流与电压成正比；电压一定时，电流与电阻成反比'},
        ],
    },
    // 探究水的沸腾
    'physics-experiments-12': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：沸腾时继续吸热但温度不变；标准大气压下沸点为 100℃。',
        steps: [
            {caption: '① 器材准备：铁架台、酒精灯、烧杯、温度计、石棉网、盖板、水'},
            {caption: '② 用酒精灯加热烧杯中的水，观察温度变化和水中气泡情况并记录'},
            {caption: '③ 沸腾前气泡上升过程中逐渐变小；沸腾时气泡上升逐渐变大、到水面破裂'},
            {caption: '④ 结论：水沸腾时继续吸热但温度保持不变，这个温度叫沸点；标准大气压下为 100℃，液面上方气压越低沸点越低'},
        ],
    },
    // 探究光的反射定律
    'physics-experiments-13': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：反射光线与入射光线分居法线两侧，反射角等于入射角。',
        steps: [
            {caption: '① 器材准备：平面镜、可折转的光屏（纸板）、激光笔、量角器'},
            {caption: '② 光屏竖直放置在平面镜上，激光笔沿光屏射向镜面，描出入射光线和反射光线'},
            {caption: '③ 将光屏的一半向后折转，折转后看不到反射光线：反射光线、入射光线、法线在同一平面内'},
            {caption: '④ 用量角器量出反射角与入射角：两角相等'},
            {caption: '⑤ 结论：反射光线和入射光线分居法线两侧，反射角等于入射角，光路可逆'},
        ],
    },
    // 探究二力平衡的条件
    'physics-experiments-14': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：二力平衡需同体、等大、反向、共线。',
        steps: [
            {caption: '① 器材准备：小车（或小卡片）、带定滑轮的支架、钩码、细线'},
            {caption: '② 小车两端细线跨过定滑轮挂钩码，使小车受水平方向两个拉力'},
            {caption: '③ 改变两端钩码个数，观察小车运动状态（比较力的大小关系）'},
            {caption: '④ 把小车扭转一个角度再松手，观察是否恢复静止（验证二力是否共线）'},
            {caption: '⑤ 结论：作用在同一物体上的两个力平衡时，大小相等、方向相反、作用在同一条直线上'},
        ],
    },
    // 探究影响导体电阻大小的因素
    'physics-experiments-15': {
        vessel: 'none',
        textOnly: true,
        caption: '原理：电阻与材料、长度、横截面积有关（转换法+控制变量法）。',
        steps: [
            {caption: '① 器材准备：电源、开关、电流表（或小灯泡）、不同规格的电阻丝、导线'},
            {caption: '② 将不同规格的电阻丝分别接入电路，通过电流表示数（或灯泡亮度）判断电阻大小（转换法）'},
            {caption: '③ 控制变量逐一比较材料、长度、横截面积对电阻的影响'},
            {caption: '④ 结论：同种材料、横截面积相同时，导体越长电阻越大；长度相同时，横截面积越大电阻越小；大多数金属导体电阻随温度升高而增大'},
        ],
    },
};

/**
 * 根据条目 id 查找现象动画配置。
 * @returns 场景配置；条目无动画时返回 null（调用方不显示按钮）
 */
export function getSceneAnimation(itemId: string): SceneConfig | null {
    return SCENE_ANIMATIONS[itemId] ?? null;
}
