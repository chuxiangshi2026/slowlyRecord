/**
 * 古诗词常见地点坐标映射
 * 用于将诗词中的地点文本转换为经纬度坐标
 */

export interface LocationCoord {
  lng: number; // 经度
  lat: number; // 纬度
  name: string; // 标准地名
  aliases?: string[]; // 别名
}

// 中国主要古诗词地点坐标库
const LOCATION_COORD_MAP: Record<string, LocationCoord> = {
  // 中原/黄河流域
  '黄河流域': { lng: 112.5, lat: 35.0, name: '黄河流域', aliases: ['中原', '河洛'] },
  '中原': { lng: 113.6, lat: 34.8, name: '中原', aliases: ['中州'] },
  '洛阳': { lng: 112.4, lat: 34.6, name: '洛阳', aliases: ['洛邑', '东都', '神都'] },
  '开封': { lng: 114.3, lat: 34.8, name: '开封', aliases: ['汴京', '汴梁', '东京'] },
  '郑州': { lng: 113.6, lat: 34.8, name: '郑州' },
  '安阳': { lng: 114.4, lat: 36.1, name: '安阳', aliases: ['邺城', '相州'] },
  '邯郸': { lng: 114.5, lat: 36.6, name: '邯郸' },
  '商丘': { lng: 115.7, lat: 34.4, name: '商丘', aliases: ['宋国', '宋都', '睢阳'] },

  // 关中/长安
  '长安': { lng: 108.9, lat: 34.3, name: '长安', aliases: ['西安', '镐京', '咸阳', '西京', '常安'] },
  '西安': { lng: 108.9, lat: 34.3, name: '西安' },
  '咸阳': { lng: 108.7, lat: 34.3, name: '咸阳' },
  '渭南': { lng: 109.5, lat: 34.5, name: '渭南' },

  // 江南
  '扬州': { lng: 119.4, lat: 32.4, name: '扬州', aliases: ['广陵', '江都'] },
  '瓜洲': { lng: 119.4, lat: 32.3, name: '瓜洲' },
  '镇江': { lng: 119.4, lat: 32.2, name: '镇江', aliases: ['京口', '润州'] },
  '南京': { lng: 118.8, lat: 32.1, name: '南京', aliases: ['金陵', '建康', '江宁', '石头城', '秦淮', '白下'] },
  '苏州': { lng: 120.6, lat: 31.3, name: '苏州', aliases: ['姑苏', '吴中', '平江'] },
  '杭州': { lng: 120.2, lat: 30.3, name: '杭州', aliases: ['临安', '钱塘', '武林'] },
  '湖州': { lng: 120.1, lat: 30.9, name: '湖州', aliases: ['吴兴'] },
  '绍兴': { lng: 120.6, lat: 30.0, name: '绍兴', aliases: ['会稽', '山阴'] },
  '嘉兴': { lng: 120.8, lat: 30.7, name: '嘉兴' },
  '无锡': { lng: 120.3, lat: 31.6, name: '无锡' },
  '常州': { lng: 119.9, lat: 31.8, name: '常州' },
  '宁波': { lng: 121.6, lat: 29.9, name: '宁波', aliases: ['明州'] },

  // 江淮
  '合肥': { lng: 117.3, lat: 31.9, name: '合肥', aliases: ['庐州'] },
  '蚌埠': { lng: 117.4, lat: 32.9, name: '蚌埠' },
  '徐州': { lng: 117.2, lat: 34.3, name: '徐州', aliases: ['彭城'] },

  // 巴蜀
  '成都': { lng: 104.1, lat: 30.7, name: '成都', aliases: ['锦官城', '益州', '蜀郡'] },
  '绵阳': { lng: 104.7, lat: 31.5, name: '绵阳' },
  '乐山': { lng: 103.8, lat: 29.6, name: '乐山' },
  '峨眉山': { lng: 103.4, lat: 29.6, name: '峨眉山' },
  '重庆': { lng: 106.5, lat: 29.6, name: '重庆', aliases: ['渝州', '巴郡', '江州'] },
  '夔州': { lng: 109.5, lat: 31.0, name: '夔州', aliases: ['奉节', '白帝城'] },
  '白帝城': { lng: 109.6, lat: 31.0, name: '白帝城' },
  '剑阁': { lng: 105.5, lat: 32.3, name: '剑阁', aliases: ['剑门关'] },

  // 荆楚
  '武汉': { lng: 114.3, lat: 30.6, name: '武汉', aliases: ['江夏', '夏口', '武昌'] },
  '荆州': { lng: 112.2, lat: 30.3, name: '荆州', aliases: ['江陵', '郢都', '南郡'] },
  '襄阳': { lng: 112.1, lat: 32.0, name: '襄阳', aliases: ['襄樊'] },
  '宜昌': { lng: 111.3, lat: 30.7, name: '宜昌', aliases: ['夷陵'] },
  '黄冈': { lng: 114.9, lat: 30.4, name: '黄冈', aliases: ['黄州'] },
  '赤壁': { lng: 113.9, lat: 29.7, name: '赤壁', aliases: ['赤壁矶'] },
  '岳阳': { lng: 113.1, lat: 29.4, name: '岳阳', aliases: ['巴陵'] },
  '长沙': { lng: 112.9, lat: 28.2, name: '长沙', aliases: ['潭州', '星城'] },
  '衡阳': { lng: 112.6, lat: 26.9, name: '衡阳' },
  '湘潭': { lng: 112.9, lat: 27.9, name: '湘潭' },

  // 江西
  '南昌': { lng: 115.9, lat: 28.7, name: '南昌', aliases: ['洪州', '豫章'] },
  '九江': { lng: 116.0, lat: 29.7, name: '九江', aliases: ['浔阳', '柴桑', '江州'] },
  '赣州': { lng: 115.0, lat: 25.9, name: '赣州', aliases: ['虔州'] },
  '庐山': { lng: 115.9, lat: 29.6, name: '庐山', aliases: ['匡庐', '南山'] },
  '景德镇': { lng: 117.2, lat: 29.3, name: '景德镇' },

  // 齐鲁
  '济南': { lng: 117.0, lat: 36.7, name: '济南', aliases: ['齐州', '历城'] },
  '青岛': { lng: 120.4, lat: 36.1, name: '青岛' },
  '曲阜': { lng: 116.9, lat: 35.6, name: '曲阜' },
  '泰安': { lng: 117.1, lat: 36.2, name: '泰安' },
  '泰山': { lng: 117.1, lat: 36.3, name: '泰山', aliases: ['岱宗', '东岳'] },
  '烟台': { lng: 121.4, lat: 37.5, name: '烟台' },
  '蓬莱': { lng: 120.8, lat: 37.8, name: '蓬莱' },

  // 燕赵/华北
  '北京': { lng: 116.4, lat: 39.9, name: '北京', aliases: ['大都', '燕京', '幽州', '北平', '蓟'] },
  '天津': { lng: 117.2, lat: 39.1, name: '天津', aliases: ['直沽'] },
  '保定': { lng: 115.5, lat: 38.9, name: '保定' },
  '石家庄': { lng: 114.5, lat: 38.0, name: '石家庄', aliases: ['常山'] },
  '承德': { lng: 117.9, lat: 40.9, name: '承德' },
  '秦皇岛': { lng: 119.6, lat: 39.9, name: '秦皇岛', aliases: ['碣石'] },
  '昌黎': { lng: 119.2, lat: 39.7, name: '昌黎', aliases: ['碣石山'] },

  // 山西
  '太原': { lng: 112.5, lat: 37.9, name: '太原', aliases: ['晋阳', '并州'] },
  '大同': { lng: 113.3, lat: 40.1, name: '大同', aliases: ['平城'] },
  '运城': { lng: 111.0, lat: 35.0, name: '运城' },
  '平遥': { lng: 112.2, lat: 37.2, name: '平遥' },
  '临汾': { lng: 111.5, lat: 36.1, name: '临汾' },

  // 西北
  '兰州': { lng: 103.8, lat: 36.1, name: '兰州', aliases: ['金城'] },
  '天水': { lng: 105.7, lat: 34.6, name: '天水', aliases: ['秦州'] },
  '敦煌': { lng: 94.7, lat: 40.1, name: '敦煌', aliases: ['沙州'] },
  '酒泉': { lng: 98.5, lat: 39.7, name: '酒泉' },
  '张掖': { lng: 100.5, lat: 38.9, name: '张掖' },
  '武威': { lng: 102.6, lat: 37.9, name: '武威', aliases: ['凉州'] },
  '西宁': { lng: 101.8, lat: 36.6, name: '西宁' },
  '银川': { lng: 106.3, lat: 38.5, name: '银川', aliases: ['兴庆'] },
  '乌鲁木齐': { lng: 87.6, lat: 43.8, name: '乌鲁木齐', aliases: ['迪化'] },
  '吐鲁番': { lng: 89.2, lat: 42.9, name: '吐鲁番' },
  '喀什': { lng: 75.9, lat: 39.5, name: '喀什', aliases: ['疏勒'] },
  '伊犁': { lng: 81.3, lat: 43.9, name: '伊犁' },

  // 西南
  '昆明': { lng: 102.8, lat: 25.0, name: '昆明', aliases: ['滇', '益州'] },
  '大理': { lng: 100.2, lat: 25.6, name: '大理', aliases: ['南诏'] },
  '丽江': { lng: 100.2, lat: 26.9, name: '丽江' },
  '贵阳': { lng: 106.6, lat: 26.6, name: '贵阳', aliases: ['黔', '筑城'] },
  '遵义': { lng: 106.9, lat: 27.7, name: '遵义' },
  '南宁': { lng: 108.3, lat: 22.8, name: '南宁', aliases: ['邕州'] },
  '桂林': { lng: 110.2, lat: 25.3, name: '桂林' },
  '柳州': { lng: 109.4, lat: 24.3, name: '柳州' },

  // 福建
  '福州': { lng: 119.3, lat: 26.1, name: '福州', aliases: ['闽', '榕城', '冶城'] },
  '厦门': { lng: 118.1, lat: 24.5, name: '厦门' },
  '泉州': { lng: 118.7, lat: 24.9, name: '泉州', aliases: ['刺桐'] },
  '武夷山': { lng: 117.9, lat: 27.7, name: '武夷山' },

  // 广东/岭南
  '广州': { lng: 113.3, lat: 23.1, name: '广州', aliases: ['羊城', '番禺', '穗'] },
  '深圳': { lng: 114.1, lat: 22.5, name: '深圳' },
  '佛山': { lng: 113.1, lat: 23.0, name: '佛山' },
  '潮州': { lng: 116.6, lat: 23.7, name: '潮州' },
  '惠州': { lng: 114.4, lat: 23.1, name: '惠州' },
  '韶关': { lng: 113.6, lat: 24.8, name: '韶关' },

  // 港澳台
  '香港': { lng: 114.2, lat: 22.3, name: '香港' },
  '澳门': { lng: 113.5, lat: 22.2, name: '澳门' },
  '台北': { lng: 121.5, lat: 25.0, name: '台北' },

  // 特殊地点
  '边塞': { lng: 103.8, lat: 36.1, name: '边塞', aliases: ['塞外', '塞北'] },
  '北方边塞': { lng: 104.0, lat: 38.0, name: '北方边塞' },
  '西域': { lng: 87.6, lat: 43.8, name: '西域', aliases: ['安西', '西陲'] },
  '漠北': { lng: 106.0, lat: 45.0, name: '漠北' },
  '江南': { lng: 120.0, lat: 31.0, name: '江南' },
  '塞北': { lng: 111.0, lat: 41.0, name: '塞北' },
  '江东': { lng: 119.0, lat: 32.0, name: '江东' },
  '岭南': { lng: 113.0, lat: 23.0, name: '岭南' },
  '淮左': { lng: 119.0, lat: 33.0, name: '淮左' },
  '潇湘': { lng: 112.5, lat: 27.5, name: '潇湘' },
  '齐鲁': { lng: 117.5, lat: 36.5, name: '齐鲁' },
  '燕赵': { lng: 115.0, lat: 39.0, name: '燕赵' },
  '吴越': { lng: 120.0, lat: 30.5, name: '吴越' },
  '荆楚': { lng: 112.0, lat: 30.5, name: '荆楚' },
  '三秦': { lng: 108.5, lat: 34.5, name: '三秦' },
  '三吴': { lng: 120.5, lat: 31.5, name: '三吴' },
  '剑桥': { lng: 0.1, lat: 52.2, name: '剑桥', aliases: ['康桥'] },
};

// 构建别名到标准名的映射
function buildAliasMap(): Map<string, string> {
  const aliasMap = new Map<string, string>();
  for (const [key, value] of Object.entries(LOCATION_COORD_MAP)) {
    aliasMap.set(key.toLowerCase(), key);
    if (value.aliases) {
      for (const alias of value.aliases) {
        aliasMap.set(alias.toLowerCase(), key);
      }
    }
  }
  return aliasMap;
}

const ALIAS_MAP = buildAliasMap();

/**
 * 根据地点文本解析坐标
 * 支持"城市/景点"格式，如"扬州/瓜洲"
 */
export function parseLocation(locationText?: string): LocationCoord | null {
  if (!locationText) return null;

  // 分割多个地点（取第一个有坐标的）
  const parts = locationText.split(/[/\\，,、；;|]/).map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    const normalized = part.toLowerCase();
    // 直接匹配
    if (LOCATION_COORD_MAP[part]) {
      return { ...LOCATION_COORD_MAP[part] };
    }
    // 别名匹配
    const standardKey = ALIAS_MAP.get(normalized);
    if (standardKey && LOCATION_COORD_MAP[standardKey]) {
      return { ...LOCATION_COORD_MAP[standardKey] };
    }
    // 模糊匹配：包含关系
    for (const [key, coord] of Object.entries(LOCATION_COORD_MAP)) {
      if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
        return { ...coord };
      }
      if (coord.aliases) {
        for (const alias of coord.aliases) {
          if (normalized.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalized)) {
            return { ...coord };
          }
        }
      }
    }
  }

  return null;
}

/**
 * 批量解析文章中带有地理位置信息的坐标
 */
export function enrichGeoLocation(articles: { location?: string; title?: string; content?: string }[]) {
  return articles.map(article => {
    let coord = parseLocation(article.location);
    // 如果 location 没有解析到，尝试从标题或内容中提取地点
    if (!coord && article.title) {
      coord = parseLocation(article.title);
    }
    return {
      ...article,
      geo: coord
    };
  });
}

/**
 * 获取所有可用地点列表
 */
export function getAllLocations(): LocationCoord[] {
  return Object.values(LOCATION_COORD_MAP).map(c => ({ ...c }));
}

export default {
  parseLocation,
  enrichGeoLocation,
  getAllLocations,
};
