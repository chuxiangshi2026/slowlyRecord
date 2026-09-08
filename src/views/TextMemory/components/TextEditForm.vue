<template>
  <!-- 文本编辑表单主体：供 TextEditDialog（对话框壳）与 TextImportDialog（手动添加 tab）复用 -->
  <el-form
    ref="formRef"
    :model="formData"
    :rules="formRules"
    label-width="80px"
  >
    <el-form-item label="标题" prop="title">
      <el-input
        v-model="formData.title"
        placeholder="请输入标题，如《静夜思》"
        maxlength="100"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="作者">
      <el-input
        v-model="formData.author"
        placeholder="请输入作者（可选）"
        maxlength="50"
      />
    </el-form-item>

    <el-form-item label="来源">
      <el-input
        v-model="formData.source"
        placeholder="请输入来源（可选）"
        maxlength="100"
      />
    </el-form-item>

    <el-form-item label="语言">
      <el-select
        v-model="formData.language"
        placeholder="选择文章语言"
        style="width: 100%"
        @change="handleLanguageChange"
      >
        <el-option
          v-for="opt in TEXT_LANGUAGE_OPTIONS"
          :key="opt.code"
          :label="opt.label"
          :value="opt.code"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="标签">
      <el-select
        v-model="formData.tags"
        multiple
        filterable
        allow-create
        default-first-option
        placeholder="选择或输入标签"
        style="width: 100%"
      >
        <el-option
          v-for="tag in existingTags"
          :key="tag"
          :label="tag"
          :value="tag"
        />
      </el-select>
    </el-form-item>

    <el-collapse style="margin-bottom: 8px">
      <el-collapse-item title="🕒 时间线信息（可选，填写后可在时间线视图展示）" name="timeline">
        <el-form-item label="分类" label-width="80px">
          <el-select v-model="formData.category" placeholder="选择分类" clearable style="width: 100%">
            <el-option v-for="c in TIMELINE_CATEGORIES" :key="c.code" :label="c.label" :value="c.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域" label-width="80px">
          <el-select v-model="formData.region" placeholder="选择区域" clearable style="width: 100%">
            <el-option v-for="r in TIMELINE_REGIONS" :key="r.code" :label="r.label" :value="r.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="年份" label-width="80px">
          <el-input v-model="formData.year" type="number" placeholder="公元年份，负数=公元前" />
        </el-form-item>
        <el-form-item label="年号" label-width="80px">
          <el-input v-model="formData.reign" placeholder="如 贞观元年" />
        </el-form-item>
        <el-form-item label="时代" label-width="80px">
          <el-input v-model="formData.era" placeholder="如 唐 / 文艺复兴" />
        </el-form-item>
        <el-form-item label="地点" label-width="80px">
          <el-input v-model="formData.location" placeholder="发生地点" />
        </el-form-item>
        <el-form-item label="背景" label-width="80px">
          <el-input v-model="formData.background" type="textarea" :rows="2" placeholder="事件背景（可空）" />
        </el-form-item>
        <el-form-item label="人物" label-width="80px">
          <el-input v-model="formData.figures" type="textarea" :rows="3" placeholder="每行：人名|头衔|简介" />
        </el-form-item>
        <el-form-item label="关系" label-width="80px">
          <el-input v-model="formData.relations" type="textarea" :rows="3" placeholder="每行：甲|乙|关系|说明" />
        </el-form-item>
      </el-collapse-item>
    </el-collapse>

    <el-form-item label="内容" prop="content">
      <el-input
        v-model="formData.content"
        type="textarea"
        :rows="12"
        placeholder="请输入文本内容..."
        maxlength="20000"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="译文">
      <el-input
        v-model="formData.translation"
        type="textarea"
        :rows="6"
        placeholder="请输入对照译文（可选）..."
        maxlength="20000"
      />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle } from '@/types/text-memory';
import type { FormInstance, FormRules } from 'element-plus';
import { TIMELINE_CATEGORIES, TIMELINE_REGIONS, parseFigures, parseRelations } from '@/utils/timeline-service';
import { TEXT_LANGUAGE_OPTIONS, detectTextLanguage, normalizeArticleLanguage } from '@/utils/text-memory-util';

interface Props {
  // 传入则为编辑模式，表单以其为初始值；不传为新增模式
  article?: TextArticle;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  // 校验通过后提交：编辑模式回传完整 TextArticle，新增模式回传不含 _id 等字段的对象
  (e: 'submit', article: any): void;
}>();

const textStore = useTextMemoryStore();
const formRef = ref<FormInstance>();

// 判断是否为编辑模式
const isEdit = computed(() => !!props.article);

// 现有标签
const existingTags = computed(() => textStore.allTags);

// 表单数据
const formData = ref({
  title: '',
  author: '',
  source: '',
  language: 'zh',
  tags: [] as string[],
  content: '',
  translation: '',
  // 时间线字段
  category: '' as '' | 'politics' | 'literature' | 'science' | 'thought' | 'society',
  region: '' as '' | 'china' | 'west' | 'modern',
  year: '' as number | '',
  reign: '',
  era: '',
  location: '',
  background: '',
  figures: '',    // 每行: 人名|头衔|简介
  relations: '',  // 每行: 甲|乙|关系|说明
});

// 表单验证规则
const formRules: FormRules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { min: 1, max: 100, message: '标题长度1-100个字符', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请输入内容', trigger: 'blur' },
    { min: 10, message: '内容至少需要10个字符', trigger: 'blur' }
  ]
};

// 语言是否被用户手动修改过：未修改时跟随内容自动检测
let languageTouched = false;

// 用户手动选择语言后，不再随内容自动变化
function handleLanguageChange() {
  languageTouched = true;
}

// 内容变化时自动检测语言（仅用户未手动选择过语言时）
watch(() => formData.value.content, (content) => {
  if (languageTouched) return;
  formData.value.language = content.trim() ? detectTextLanguage(content) : 'zh';
});

// 监听article变化，编辑时填充数据
watch(() => props.article, (newArticle) => {
  if (newArticle) {
    // 编辑模式：以文章已有语言为准，视为用户显式值
    languageTouched = true;
    formData.value = {
      title: newArticle.title,
      author: newArticle.author || '',
      source: newArticle.source || '',
      language: normalizeArticleLanguage(newArticle.language),
      tags: [...newArticle.tags],
      content: newArticle.content,
      translation: newArticle.translation || '',
      category: (newArticle.category as any) || '',
      region: newArticle.region || '',
      year: newArticle.year ?? '',
      reign: newArticle.reign || '',
      era: newArticle.era || '',
      location: newArticle.location || '',
      background: newArticle.background || '',
      figures: (newArticle.figures || []).map(f => [f.name, f.title, f.desc].filter(Boolean).join('|')).join('\n'),
      relations: (newArticle.relations || []).map(r => [r.from, r.to, r.type, r.desc].filter(Boolean).join('|')).join('\n'),
    };
  } else {
    languageTouched = false;
    resetForm();
  }
}, { immediate: true });

// 重置表单
function resetForm() {
  formData.value = {
    title: '',
    author: '',
    source: '',
    language: 'zh',
    tags: [],
    content: '',
    translation: '',
    category: '',
    region: '',
    year: '',
    reign: '',
    era: '',
    location: '',
    background: '',
    figures: '',
    relations: '',
  };
  formRef.value?.resetFields();
}

// 校验并提交：校验通过时 emit('submit', ...)，返回是否提交成功
async function submit(): Promise<boolean> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return false;

  const timelineFields = {
    category: (formData.value.category || undefined) as any,
    region: (formData.value.region || undefined) as any,
    year: formData.value.year === '' ? undefined : Number(formData.value.year),
    reign: formData.value.reign || undefined,
    era: formData.value.era || undefined,
    location: formData.value.location || undefined,
    background: formData.value.background || undefined,
    figures: parseFigures(formData.value.figures),
    relations: parseRelations(formData.value.relations),
  };

  if (isEdit.value && props.article) {
    // 编辑模式
    const updatedArticle: TextArticle = {
      ...props.article,
      title: formData.value.title,
      author: formData.value.author,
      source: formData.value.source,
      language: formData.value.language,
      tags: formData.value.tags,
      content: formData.value.content,
      translation: formData.value.translation || undefined,
      ...timelineFields,
    };
    emit('submit', updatedArticle);
  } else {
    // 新增模式
    emit('submit', {
      title: formData.value.title,
      author: formData.value.author,
      source: formData.value.source,
      language: formData.value.language,
      tags: formData.value.tags,
      content: formData.value.content,
      translation: formData.value.translation || undefined,
      ...timelineFields,
    });
  }
  return true;
}

defineExpose({ submit, resetForm });
</script>
