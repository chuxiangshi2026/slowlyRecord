import { describe, it, expect } from 'vitest'
import { serializer } from './json-serialize-util'

describe('serializer', () => {
  describe('serialize', () => {
    it('应该正确序列化普通对象', () => {
      const data = { name: 'test', value: 123 }
      const result = serializer.serialize(data)
      expect(result).toBe('{"name":"test","value":123}')
    })

    it('Date 对象在对象属性中会被序列化为 ISO 字符串', () => {
      const date = new Date('2024-01-15T08:30:00.000Z')
      const data = { name: 'test', createdAt: date }
      const result = serializer.serialize(data)
      const parsed = JSON.parse(result)
      expect(parsed.name).toBe('test')
      expect(parsed.createdAt).toBe('2024-01-15T08:30:00.000Z')
    })

    it('Date 对象在嵌套对象中会被序列化为 ISO 字符串', () => {
      const date = new Date('2024-06-20T14:30:00.000Z')
      const data = {
        user: {
          name: '张三',
          createdAt: date
        },
        items: [1, 2, 3]
      }
      const result = serializer.serialize(data)
      const parsed = JSON.parse(result)
      expect(parsed.user.createdAt).toBe('2024-06-20T14:30:00.000Z')
    })

    it('应该正确序列化数组', () => {
      const data = [1, 2, 3, 'test']
      const result = serializer.serialize(data)
      expect(result).toBe('[1,2,3,"test"]')
    })

    it('应该正确序列化 null', () => {
      const result = serializer.serialize(null)
      expect(result).toBe('null')
    })

    it('Date 对象在数组中会被序列化为 ISO 字符串', () => {
      const date = new Date('2024-01-15T08:30:00.000Z')
      const data = [date, 'hello']
      const result = serializer.serialize(data)
      const parsed = JSON.parse(result)
      expect(parsed[0]).toBe('2024-01-15T08:30:00.000Z')
      expect(parsed[1]).toBe('hello')
    })

    it('应该正确序列化空对象', () => {
      const result = serializer.serialize({})
      expect(result).toBe('{}')
    })

    it('应该正确序列化空数组', () => {
      const result = serializer.serialize([])
      expect(result).toBe('[]')
    })

    it('应该正确序列化数字', () => {
      const result = serializer.serialize(42)
      expect(result).toBe('42')
    })

    it('应该正确序列化字符串', () => {
      const result = serializer.serialize('hello')
      expect(result).toBe('"hello"')
    })

    it('应该正确序列化布尔值', () => {
      expect(serializer.serialize(true)).toBe('true')
      expect(serializer.serialize(false)).toBe('false')
    })

    it('多个 Date 对象在对象中都会被序列化为 ISO 字符串', () => {
      const data = {
        start: new Date('2024-01-01T00:00:00.000Z'),
        end: new Date('2024-12-31T23:59:59.000Z')
      }
      const result = serializer.serialize(data)
      const parsed = JSON.parse(result)
      expect(parsed.start).toBe('2024-01-01T00:00:00.000Z')
      expect(parsed.end).toBe('2024-12-31T23:59:59.000Z')
    })

    it('应该正确序列化包含 undefined 值的对象', () => {
      const data = { name: 'test', value: undefined }
      const result = serializer.serialize(data)
      expect(result).toBe('{"name":"test"}')
    })

    it('Date 对象在深层嵌套中会被序列化为 ISO 字符串', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              date: new Date('2024-06-15T12:00:00.000Z')
            }
          }
        }
      }
      const result = serializer.serialize(data)
      const parsed = JSON.parse(result)
      expect(parsed.level1.level2.level3.date).toBe('2024-06-15T12:00:00.000Z')
    })
  })

  describe('parse', () => {
    it('应该正确解析普通 JSON 字符串', () => {
      const json = '{"name":"test","value":123}'
      const result = serializer.parse(json) as { name: string; value: number }
      expect(result.name).toBe('test')
      expect(result.value).toBe(123)
    })

    it('应该正确还原带有 Date 标记的对象', () => {
      const json = '{"name":"test","createdAt":{"__type__":"Date","__value__":"2024-01-15T08:30:00.000Z"}}'
      const result = serializer.parse(json) as { name: string; createdAt: Date }
      expect(result.name).toBe('test')
      expect(result.createdAt instanceof Date).toBe(true)
      expect(result.createdAt.toISOString()).toBe('2024-01-15T08:30:00.000Z')
    })

    it('应该正确解析嵌套的 Date 对象', () => {
      const json = '{"user":{"name":"张三","createdAt":{"__type__":"Date","__value__":"2024-06-20T14:30:00.000Z"}}}'
      const result = serializer.parse(json) as { user: { name: string; createdAt: Date } }
      expect(result.user.name).toBe('张三')
      expect(result.user.createdAt instanceof Date).toBe(true)
    })

    it('应该正确处理 null', () => {
      const result = serializer.parse('null')
      expect(result).toBeNull()
    })

    it('应该正确解析数组', () => {
      const result = serializer.parse('[1,2,3]') as number[]
      expect(result).toEqual([1, 2, 3])
    })

    it('应该正确解析包含 Date 标记的数组', () => {
      const json = '[{"__type__":"Date","__value__":"2024-01-15T08:30:00.000Z"},"hello"]'
      const result = serializer.parse(json) as [Date, string]
      expect(result[0] instanceof Date).toBe(true)
      expect(result[1]).toBe('hello')
    })

    it('应该正确处理 __value__ 为空字符串的 Date 标记', () => {
      const json = '{"date":{"__type__":"Date","__value__":""}}'
      const result = serializer.parse(json) as { date: unknown }
      expect(result.date).not.toBeInstanceOf(Date)
      expect(result.date).toEqual({ __type__: 'Date', __value__: '' })
    })

    it('不应该将普通对象误认为 Date 标记', () => {
      const json = '{"obj":{"__type__":"Other","__value__":"test"}}'
      const result = serializer.parse(json) as { obj: { __type__: string; __value__: string } }
      expect(result.obj.__type__).toBe('Other')
      expect(result.obj.__value__).toBe('test')
    })

    it('应该正确解析深层嵌套的 Date', () => {
      const json = '{"level1":{"level2":{"level3":{"date":{"__type__":"Date","__value__":"2024-06-15T12:00:00.000Z"}}}}}'
      const result = serializer.parse(json) as any
      expect(result.level1.level2.level3.date instanceof Date).toBe(true)
      expect(result.level1.level2.level3.date.toISOString()).toBe('2024-06-15T12:00:00.000Z')
    })

    it('应该正确解析包含 null 值的对象', () => {
      const json = '{"name":null,"value":123}'
      const result = serializer.parse(json) as { name: null; value: number }
      expect(result.name).toBeNull()
      expect(result.value).toBe(123)
    })
  })

  describe('序列化和反序列化的对称性', () => {
    it('序列化后再解析，Date 会变为 ISO 字符串（非 Date 实例）', () => {
      const original = {
        name: '测试',
        createdAt: new Date('2024-01-15T08:30:00.000Z'),
        count: 42
      }
      const serialized = serializer.serialize(original)
      const parsed = serializer.parse(serialized) as any

      expect(parsed.name).toBe(original.name)
      expect(parsed.count).toBe(original.count)
      expect(typeof parsed.createdAt).toBe('string')
      expect(parsed.createdAt).toBe('2024-01-15T08:30:00.000Z')
    })

    it('手动构建的 Date 标记可以被正确解析', () => {
      const data = {
        name: '测试',
        createdAt: { __type__: 'Date', __value__: '2024-01-15T08:30:00.000Z' },
        count: 42
      }
      const serialized = JSON.stringify(data)
      const parsed = serializer.parse(serialized) as any

      expect(parsed.name).toBe('测试')
      expect(parsed.count).toBe(42)
      expect(parsed.createdAt instanceof Date).toBe(true)
      expect(parsed.createdAt.toISOString()).toBe('2024-01-15T08:30:00.000Z')
    })

    it('非 Date 属性的序列化和反序列化应该对称', () => {
      const original = {
        name: '测试',
        count: 42,
        active: true,
        tags: ['a', 'b']
      }
      const serialized = serializer.serialize(original)
      const parsed = serializer.parse(serialized) as typeof original

      expect(parsed.name).toBe(original.name)
      expect(parsed.count).toBe(original.count)
      expect(parsed.active).toBe(original.active)
      expect(parsed.tags).toEqual(original.tags)
    })

    it('带有 Date 标记的复杂对象解析应该正确', () => {
      const json = JSON.stringify({
        id: 1,
        name: '复杂对象',
        dates: [
          { __type__: 'Date', __value__: '2024-01-01T00:00:00.000Z' },
          { __type__: 'Date', __value__: '2024-12-31T23:59:59.000Z' }
        ],
        nested: {
          date: { __type__: 'Date', __value__: '2024-06-15T12:00:00.000Z' },
          value: 'nested value'
        },
        active: true,
        score: 0
      })
      const parsed = serializer.parse(json) as any

      expect(parsed.id).toBe(1)
      expect(parsed.name).toBe('复杂对象')
      expect(parsed.dates[0] instanceof Date).toBe(true)
      expect(parsed.dates[1] instanceof Date).toBe(true)
      expect(parsed.nested.date instanceof Date).toBe(true)
      expect(parsed.nested.value).toBe('nested value')
      expect(parsed.active).toBe(true)
      expect(parsed.score).toBe(0)
    })

    it('多次解析 Date 标记应该产生相同结果', () => {
      const json = '{"date":{"__type__":"Date","__value__":"2024-03-15T10:00:00.000Z"}}'
      const parsed1 = serializer.parse(json) as { date: Date }
      const parsed2 = serializer.parse(json) as { date: Date }

      expect(parsed2.date.toISOString()).toBe(parsed1.date.toISOString())
    })
  })
})
