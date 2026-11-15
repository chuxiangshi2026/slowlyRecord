// 在小程序 AI 环境中注册诗词 SKILL。
// 原子接口在阶段 2 接入后在此 registerAPI。
const skill = wx.modelContext.createSkill('/subPackages/ai-poetry/skill')

module.exports = skill
