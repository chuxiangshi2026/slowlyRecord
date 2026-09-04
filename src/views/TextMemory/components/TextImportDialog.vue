<template>
  <el-dialog
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      @opened="handleDialogOpened"
      title="添加 / 导入文本"
      width="780px"
      destroy-on-close
  >
    <el-tabs v-model="activeTab">
      <!-- 手动添加（默认）：顶部选择类型，字段随类型切换 -->
      <el-tab-pane label="手动添加" name="manual">
        <div class="type-bar">
          <span class="type-bar-label">类型</span>
          <el-radio-group v-model="manualType" size="small">
            <el-radio-button label="text">普通文本</el-radio-button>
            <el-radio-button label="poetry">诗词</el-radio-button>
            <el-radio-button label="idiom">成语</el-radio-button>
            <el-radio-button label="knowledge">知识条目</el-radio-button>
            <el-radio-button label="timeline">时间线事件</el-radio-button>
            <el-radio-button label="peg">宫殿桩</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 普通文本：内嵌共享编辑表单 -->
        <TextEditForm v-if="manualType === 'text'" ref="manualFormRef" @submit="handleManualSubmit" />

        <!-- 诗词 -->
        <el-form v-else-if="manualType === 'poetry'" label-width="80px">
          <el-form-item label="标题">
            <el-input v-model="manualPoetryForm.title" placeholder="诗词标题，如《静夜思》" maxlength="100"/>
          </el-form-item>
          <el-form-item label="朝代">
            <el-select v-model="manualPoetryForm.dynasty" placeholder="选择朝代" clearable filterable allow-create style="width: 100%">
              <el-option v-for="d in POETRY_DYNASTY_OPTIONS" :key="d" :label="d" :value="d"/>
            </el-select>
          </el-form-item>
          <el-form-item label="作者">
            <el-input v-model="manualPoetryForm.author" placeholder="作者（可选）" maxlength="50"/>
          </el-form-item>
          <el-form-item label="年份">
            <el-input v-model="manualPoetryForm.year" type="number" placeholder="创作年份（可选，用于时间线；负数=公元前）"/>
          </el-form-item>
          <el-form-item label="地点">
            <el-input v-model="manualPoetryForm.location" placeholder="创作地点（可选，用于地图）"/>
          </el-form-item>
          <el-form-item label="正文">
            <el-input v-model="manualPoetryForm.content" type="textarea" :rows="8" placeholder="请输入诗词正文..."/>
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="manualPoetryForm.tags" multiple filterable allow-create placeholder="选择或输入标签" style="width: 100%">
              <el-option v-for="tag in existingTags" :key="tag" :label="tag" :value="tag"/>
            </el-select>
          </el-form-item>
        </el-form>

        <!-- 成语 -->
        <el-form v-else-if="manualType === 'idiom'" label-width="80px">
          <el-form-item label="成语">
            <el-input v-model="manualIdiomForm.title" placeholder="如：画蛇添足" maxlength="50"/>
          </el-form-item>
          <el-form-item label="释义">
            <el-input v-model="manualIdiomForm.meaning" type="textarea" :rows="4" placeholder="请输入释义..."/>
          </el-form-item>
          <el-form-item label="出处">
            <el-input v-model="manualIdiomForm.source" placeholder="出处（可选）"/>
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="manualIdiomForm.tags" multiple filterable allow-create placeholder="选择或输入标签" style="width: 100%">
              <el-option v-for="tag in existingTags" :key="tag" :label="tag" :value="tag"/>
            </el-select>
          </el-form-item>
        </el-form>

        <!-- 知识条目 -->
        <el-form v-else-if="manualType === 'knowledge'" label-width="80px">
          <el-form-item label="所属知识集">
            <el-input v-model="manualKnowledgeForm.setName" placeholder="知识集名称（可选），如：常识"/>
          </el-form-item>
          <el-form-item label="名称/问题">
            <el-input v-model="manualKnowledgeForm.question" placeholder="如：水的化学式"/>
          </el-form-item>
          <el-form-item label="答案/释义">
            <el-input v-model="manualKnowledgeForm.answer" type="textarea" :rows="4" placeholder="请输入答案或释义..."/>
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="manualKnowledgeForm.tags" multiple filterable allow-create placeholder="选择或输入标签" style="width: 100%">
              <el-option v-for="tag in existingTags" :key="tag" :label="tag" :value="tag"/>
            </el-select>
          </el-form-item>
        </el-form>

        <!-- 时间线事件 -->
        <el-form v-else-if="manualType === 'timeline'" label-width="80px">
          <el-form-item label="事件名">
            <el-input v-model="timelineManualForm.title" placeholder="事件名称"/>
          </el-form-item>
          <el-form-item label="年份">
            <el-input v-model="timelineManualForm.year" type="number" placeholder="公元年份，负数=公元前"/>
          </el-form-item>
          <el-form-item label="区域">
            <el-select v-model="timelineManualForm.region" style="width: 100%">
              <el-option v-for="r in TIMELINE_REGIONS" :key="r.code" :label="r.label" :value="r.code"/>
            </el-select>
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="timelineManualForm.content" type="textarea" :rows="5" placeholder="具体事件描述..."/>
          </el-form-item>
          <el-form-item label="标签">
            <el-select v-model="timelineManualForm.tags" multiple filterable allow-create placeholder="选择或输入标签" style="width: 100%">
              <el-option v-for="tag in existingTags" :key="tag" :label="tag" :value="tag"/>
            </el-select>
          </el-form-item>
        </el-form>

        <!-- 宫殿桩 -->
        <el-form v-else label-width="80px">
          <el-form-item label="所属宫殿">
            <el-select v-model="manualPegForm.palaceId" placeholder="选择宫殿" style="width: 100%" @change="handlePegPalaceChange">
              <el-option v-for="p in palaceStore.palaces" :key="p._id" :label="p.name" :value="p._id"/>
              <el-option label="新建宫殿..." value="__new__"/>
            </el-select>
          </el-form-item>
          <el-form-item label="顺序号">
            <el-input v-model="manualPegForm.order" type="number" placeholder="插入位置（可选，默认追加到末尾）"/>
          </el-form-item>
          <el-form-item label="桩名">
            <el-input v-model="manualPegForm.name" placeholder="如：大门"/>
          </el-form-item>
          <el-form-item label="备选桩">
            <el-input v-model="manualPegForm.alternates" placeholder="多个备选桩用逗号分隔（可选）"/>
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="manualPegForm.description" type="textarea" :rows="3" placeholder="桩的描述（可选）"/>
          </el-form-item>
        </el-form>

        <div class="manual-form-actions">
          <el-button type="primary" @click="handleManualSave">添加</el-button>
        </div>
      </el-tab-pane>

      <!-- 批量导入：顶部选择类型，格式说明随类型切换 -->
      <el-tab-pane label="批量导入" name="batch">
        <div class="type-bar">
          <span class="type-bar-label">类型</span>
          <el-radio-group v-model="batchType" size="small">
            <el-radio-button label="text">普通文本</el-radio-button>
            <el-radio-button label="poetry">诗词</el-radio-button>
            <el-radio-button label="idiom">成语</el-radio-button>
            <el-radio-button label="knowledge">知识条目</el-radio-button>
            <el-radio-button label="timeline">时间线事件</el-radio-button>
          </el-radio-group>
        </div>
        <el-alert
            title="批量导入格式说明"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
        >
          <p>{{ batchFormatTip.desc }}</p>
          <pre style="background: #f5f7fa; padding: 10px; margin-top: 8px; white-space: pre-wrap;">{{ batchFormatTip.example }}</pre>
        </el-alert>
        <el-input
            v-model="batchContent"
            type="textarea"
            :rows="12"
            :placeholder="batchPlaceholder"
        />
      </el-tab-pane>

      <!-- 文件导入：顶部选择类型，影响导入后的分类归属 -->
      <el-tab-pane label="文件导入" name="file">
        <div class="type-bar">
          <span class="type-bar-label">类型</span>
          <el-radio-group v-model="fileType" size="small">
            <el-radio-button label="text">普通文本</el-radio-button>
            <el-radio-button label="poetry">诗词</el-radio-button>
            <el-radio-button label="idiom">成语</el-radio-button>
            <el-radio-button label="knowledge">知识条目</el-radio-button>
            <el-radio-button label="timeline">时间线事件</el-radio-button>
          </el-radio-group>
        </div>
        <!-- 文件格式说明 -->
        <el-alert
            title="文件导入格式说明"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
        >
          <div class="file-format-desc">
            <p class="format-title">支持格式：<span class="format-tags">.txt</span> <span class="format-tags">.md</span>
              <span class="format-tags">.doc</span> <span class="format-tags">.docx</span></p>

            <el-collapse v-model="activeCollapse" style="margin-top: 12px;">
              <el-collapse-item title="📄 普通文本文件（推荐）" name="plain">
                <div class="format-detail">
                  <p>直接将文件内容作为一篇文章导入，导入后可编辑标题和标签。</p>
                  <div class="example-box">
                    <div class="example-header">
                      <span>示例内容：</span>
                    </div>
                    <pre class="example-content">静夜思

床前明月光，
疑是地上霜。
举头望明月，
低头思故乡。</pre>
                  </div>
                </div>
              </el-collapse-item>

              <el-collapse-item title="📋 带元数据格式（高级）" name="metadata">
                <div class="format-detail">
                  <p>在文件开头添加元数据，自动识别标题、作者、标签等信息。</p>
                  <div class="meta-fields">
                    <div class="meta-field"><span class="meta-key">标题：</span>文章标题</div>
                    <div class="meta-field"><span class="meta-key">作者：</span>作者名称</div>
                    <div class="meta-field"><span class="meta-key">标签：</span>标签1,标签2,标签3</div>
                    <div class="meta-field"><span class="meta-key">来源：</span>文章来源</div>
                  </div>
                  <div class="example-box">
                    <div class="example-header">
                      <span>示例内容：</span>
                    </div>
                    <pre class="example-content">标题：静夜思
作者：李白
标签：唐诗,古诗,必背
---
床前明月光，
疑是地上霜。
举头望明月，
低头思故乡。</pre>
                  </div>
                  <p class="format-tip">💡 提示：元数据和正文之间用 <code>---</code> 分隔</p>
                </div>
              </el-collapse-item>

              <el-collapse-item title="📦 批量导入格式" name="batch">
                <div class="format-detail">
                  <p>一个文件包含多篇文章，每篇用 <code>---</code> 分隔。</p>
                  <div class="example-box">
                    <div class="example-header">
                      <span>示例内容：</span>
                    </div>
                    <pre class="example-content">标题：春晓
作者：孟浩然
标签：唐诗
---
春眠不觉晓，
处处闻啼鸟。
---
标题：登鹳雀楼
作者：王之涣
---
白日依山尽，
黄河入海流。</pre>
                  </div>
                  <p class="format-tip">⚠️ 注意：使用批量格式时，将自动拆分为多篇文章导入</p>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-alert>

        <el-upload
            class="upload-area"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            accept=".txt,.md,.doc,.docx"
        >
          <el-icon class="el-icon--upload">
            <upload-filled/>
          </el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 .txt, .md, .doc, .docx 格式文件，最大 10MB
            </div>
          </template>
        </el-upload>
        <div v-if="fileContent" class="file-preview">
          <h4>文件内容预览：</h4>
          <el-input
              v-model="fileContent"
              type="textarea"
              :rows="6"
              placeholder="文件内容..."
          />
          <el-form v-if="fileType === 'text' || fileType === 'poetry' || fileType === 'idiom'" :model="fileForm" label-width="80px" style="margin-top: 16px">
            <el-form-item label="标题">
              <el-input v-model="fileForm.title" placeholder="输入标题（默认使用文件名）"/>
            </el-form-item>
            <el-form-item label="标签">
              <el-select
                  v-model="fileForm.tags"
                  multiple
                  filterable
                  allow-create
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
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 联网导入 -->
      <!--      <el-tab-pane label="联网导入" name="online">
              <el-form :model="onlineForm" label-width="100px">
                <el-form-item label="导入方式">
                  <el-radio-group v-model="onlineForm.type">
                    <el-radio label="url">网页链接</el-radio>
                    <el-radio label="search">关键词搜索</el-radio>
                  </el-radio-group>
                </el-form-item>

                <template v-if="onlineForm.type === 'url'">
                  <el-form-item label="网页链接">
                    <el-input
                      v-model="onlineForm.url"
                      placeholder="输入网页链接..."
                    />
                  </el-form-item>
                </template>

                <template v-if="onlineForm.type === 'search'">
                  <el-form-item label="搜索关键词">
                    <el-input
                      v-model="onlineForm.keyword"
                      placeholder="输入诗词名、文章名或作者..."
                    >
                      <template #append>
                        <el-button @click="handleSearch">搜索</el-button>
                      </template>
                    </el-input>
                  </el-form-item>

                  <div v-if="searchResults.length > 0" class="search-results">
                    <h4>搜索结果：</h4>
                    <el-radio-group v-model="selectedResult">
                      <el-radio
                        v-for="(result, index) in searchResults"
                        :key="index"
                        :label="index"
                        border
                        style="margin-bottom: 10px; width: 100%"
                      >
                        <div style="text-align: left">
                          <strong>{{ result.title }}</strong>
                          <p style="margin: 4px 0; color: #666; font-size: 12px">
                            {{ result.content.substring(0, 100) }}...
                          </p>
                        </div>
                      </el-radio>
                    </el-radio-group>
                  </div>
                </template>

                <el-form-item label="标签">
                  <el-select
                    v-model="onlineForm.tags"
                    multiple
                    filterable
                    allow-create
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
              </el-form>
            </el-tab-pane>-->

      <!-- AI 搜索 -->
      <!--      <el-tab-pane label="AI 搜索" name="ai">
              <div class="ai-search-header">
                <el-alert
                  title="使用 AI 搜索古诗词和文章"
                  type="info"
                  :closable="false"
                  show-icon
                >
                  <template #default>
                    <span>通过 AI 大模型搜索或生成诗词文章内容</span>
                    <el-button
                      link
                      type="primary"
                      :icon="Setting"
                      @click="showAIConfig = true"
                      style="margin-left: 12px"
                    >
                      配置 API
                    </el-button>
                  </template>
                </el-alert>
              </div>

              <el-form :model="aiForm" label-width="80px">
                <el-form-item label="搜索类型">
                  <el-radio-group v-model="aiForm.type">
                    <el-radio label="auto">自动判断</el-radio>
                    <el-radio label="poetry">古诗词</el-radio>
                    <el-radio label="article">文章散文</el-radio>
                  </el-radio-group>
                </el-form-item>

                <el-form-item label="关键词">
                  <el-input
                    v-model="aiForm.keyword"
                    placeholder="输入诗词名、作者、主题或任意关键词..."
                  >
                    <template #append>
                      <el-button @click="handleAISearch" :loading="aiSearching">
                        AI 搜索
                      </el-button>
                    </template>
                  </el-input>
                </el-form-item>

                <template v-if="aiForm.type === 'poetry' || aiForm.type === 'auto'">
                  <el-form-item label="朝代">
                    <el-select v-model="aiForm.dynasty" placeholder="选择朝代（可选）" clearable>
                      <el-option label="先秦" value="先秦" />
                      <el-option label="两汉" value="两汉" />
                      <el-option label="魏晋南北朝" value="魏晋南北朝" />
                      <el-option label="隋" value="隋" />
                      <el-option label="唐" value="唐" />
                      <el-option label="宋" value="宋" />
                      <el-option label="元" value="元" />
                      <el-option label="明" value="明" />
                      <el-option label="清" value="清" />
                      <el-option label="近现代" value="近现代" />
                      <el-option label="楚辞" value="楚辞" />
                      <el-option label="汉乐府" value="汉" />
                      <el-option label="魏晋" value="魏晋" />
                      <el-option label="明清" value="明清" />
                    </el-select>
                  </el-form-item>
                </template>

                <template v-if="aiForm.type === 'article'">
                  <el-form-item label="文章类型">
                    <el-select v-model="aiForm.articleType" placeholder="选择文章类型">
                      <el-option label="散文" value="essay" />
                      <el-option label="现代散文" value="prose" />
                      <el-option label="现代诗歌" value="poetry" />
                      <el-option label="古文" value="classic" />
                    </el-select>
                  </el-form-item>
                </template>

                <el-form-item label="标签">
                  <el-select
                    v-model="aiForm.tags"
                    multiple
                    filterable
                    allow-create
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
              </el-form>

              <div v-if="aiResults.length > 0" class="ai-results">
                <h4>AI 搜索结果：</h4>
                <el-scrollbar height="300px">
                  <el-card
                    v-for="(result, index) in aiResults"
                    :key="index"
                    shadow="hover"
                    style="margin-bottom: 12px; cursor: pointer"
                    @click="selectAIResult(result)"
                    :class="{ 'selected': selectedAIResult?._id === result._id }"
                  >
                    <template #header>
                      <div style="display: flex; justify-content: space-between; align-items: center">
                        <span style="font-weight: bold">{{ result.title }}</span>
                        <div>
                          <el-tag size="small" type="info" style="margin-right: 8px">{{ result.author }}</el-tag>
                          <el-tag size="small" type="success" v-if="result.source === 'ai'">AI</el-tag>
                        </div>
                      </div>
                    </template>
                    <div style="white-space: pre-line; font-size: 14px; line-height: 1.8">
                      {{ result.content }}
                    </div>
                  </el-card>
                </el-scrollbar>
              </div>

              <div v-else-if="!aiSearching" class="ai-placeholder">
                <el-empty description="请输入关键词进行 AI 搜索">
                  <template #description>
                    <p>请输入关键词进行 AI 搜索</p>
                    <p style="font-size: 12px; color: #999; margin-top: 8px">
                      例如：李白、静夜思、春天、月亮、励志等
                    </p>
                  </template>
                </el-empty>
              </div>
            </el-tab-pane>-->

      <!-- 考试资料库 -->
      <!--      <el-tab-pane label="考试资料" name="exam">
              <el-form :model="examForm" label-width="100px">
                <el-form-item label="考试类型">
                  <el-select v-model="examForm.type" placeholder="选择考试类型" clearable @change="handleExamTypeChange">
                    <el-option label="专升本" value="专升本" />
                    <el-option label="考研" value="考研" />
                    <el-option label="考公/行测" value="考公" />
                    <el-option label="职称考试" value="职称" />
                    <el-option label="英语四六级" value="四六级" />
                    <el-option label="考研英语" value="考研英语" />
                  </el-select>
                </el-form-item>
                <el-form-item label="科目">
                  <el-select v-model="examForm.subject" placeholder="选择科目" clearable :disabled="!examForm.type">
                    <el-option
                      v-for="subject in examSubjects"
                      :key="subject"
                      :label="subject"
                      :value="subject"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="搜索">
                  <el-input
                    v-model="examForm.keyword"
                    placeholder="输入关键词搜索考试资料..."
                  >
                    <template #append>
                      <el-button @click="handleExamSearch">搜索</el-button>
                    </template>
                  </el-input>
                </el-form-item>
              </el-form>

              <div v-if="examResults.length > 0" class="exam-results">
                <h4>考试资料：</h4>
                <el-scrollbar height="300px">
                  <el-card
                    v-for="(item, index) in examResults"
                    :key="index"
                    shadow="hover"
                    style="margin-bottom: 12px; cursor: pointer"
                    @click="selectExamItem(item)"
                    :class="{ 'selected': selectedExamItem?._id === item._id }"
                  >
                    <template #header>
                      <div style="display: flex; justify-content: space-between; align-items: center">
                        <span style="font-weight: bold">{{ item.title }}</span>
                        <div>
                          <el-tag size="small" type="info" style="margin-right: 4px" v-for="tag in item.tags.slice(0, 2)" :key="tag">{{ tag }}</el-tag>
                        </div>
                      </div>
                    </template>
                    <div style="white-space: pre-line; font-size: 14px; line-height: 1.8; max-height: 150px; overflow: hidden">
                      {{ item.content.substring(0, 200) }}{{ item.content.length > 200 ? '...' : '' }}
                    </div>
                  </el-card>
                </el-scrollbar>
              </div>

              <div v-else class="exam-placeholder">
                <el-empty description="请选择考试类型或输入关键词搜索">
                  <template #description>
                    <p>请选择考试类型或输入关键词搜索</p>
                    <p style="font-size: 12px; color: #999; margin-top: 8px">
                      支持：专升本、考研、考公、职称、四六级等考试资料
                    </p>
                  </template>
                </el-empty>
              </div>
            </el-tab-pane>-->

      <!-- 内置库：诗词库/成语库/时间线/知识库/宫殿桩库 二级切换 -->
      <el-tab-pane label="内置库" name="library">
        <el-radio-group v-model="libTab" size="small" style="margin-bottom: 16px">
          <el-radio-button label="poetry">诗词库</el-radio-button>
          <el-radio-button label="idiom">成语库</el-radio-button>
          <el-radio-button label="timeline">时间线</el-radio-button>
          <el-radio-button label="knowledge">知识库</el-radio-button>
          <el-radio-button label="pegPacks">宫殿桩库</el-radio-button>
        </el-radio-group>

        <!-- 诗词库 -->
        <div v-if="libTab === 'poetry'">
          <el-form :model="poetryForm" label-width="60px" size="small">
            <el-form-item label="朝代">
              <el-select v-model="poetryForm.dynasty" placeholder="全部" clearable style="width: 100%">
                <el-option label="先秦" value="xianqin"/>
                <el-option label="两汉" value="han"/>
                <el-option label="魏晋南北朝" value="weijin"/>
                <el-option label="隋" value="sui"/>
                <el-option label="唐" value="tang"/>
                <el-option label="宋" value="song"/>
                <el-option label="元" value="yuan"/>
                <el-option label="明" value="ming"/>
                <el-option label="清" value="qing"/>
                <el-option label="近现代" value="xiandai"/>
              </el-select>
            </el-form-item>
            <el-form-item label="搜索">
              <el-input
                  v-model="poetryForm.keyword"
                  placeholder="诗词名、作者或诗句..."
                  clearable
                  @keyup.enter="handlePoetrySearch"
              >
                <template #append>
                  <el-button @click="handlePoetrySearch">搜索</el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-form>

          <div v-if="poetryLoading" class="poetry-loading">
            <el-skeleton :rows="5" animated />
          </div>

          <div v-else-if="poetryResults.length > 0" class="poetry-results">
            <div class="poetry-toolbar">
              <el-checkbox
                  :model-value="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @change="handleSelectAll"
                  size="small"
              >
                全选
              </el-checkbox>
              <span class="poetry-selected-count" v-if="selectedPoetries.length > 0">
                已选 {{ selectedPoetries.length }} 首
              </span>
            </div>
            <el-scrollbar height="340px">
              <el-card
                  v-for="(poem, index) in poetryResults"
                  :key="poem.id"
                  shadow="hover"
                  style="margin-bottom: 10px; cursor: pointer"
                  @click="selectPoetry(poem)"
                  :class="{ 'selected': selectedPoetries.some(p => p.id === poem.id) }"
                  size="small"
              >
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center">
                    <div style="display: flex; align-items: center; gap: 6px">
                      <el-checkbox
                          :model-value="selectedPoetries.some(p => p.id === poem.id)"
                          @click.stop
                          @change="selectPoetry(poem)"
                      />
                      <span style="font-weight: bold; font-size: 13px">{{ poem.title }}</span>
                    </div>
                    <div>
                      <el-tag size="small" type="info" style="margin-right: 6px">{{ poem.dynasty }}</el-tag>
                      <el-tag size="small" type="info">{{ poem.author }}</el-tag>
                    </div>
                  </div>
                </template>
                <div style="white-space: pre-line; font-size: 12px; line-height: 1.6; margin-bottom: 6px; color: var(--utools-text-secondary)">
                  {{ poem.content.substring(0, 80) }}{{ poem.content.length > 80 ? '...' : '' }}
                </div>
                <div v-if="poem.location" style="font-size: 11px; color: #909399">
                  <el-icon size="12"><Location /></el-icon> {{ poem.location }}
                </div>
              </el-card>
            </el-scrollbar>
          </div>

          <div v-else class="poetry-placeholder">
            <el-empty description="请选择朝代或输入关键词搜索"/>
          </div>
        </div>

        <!-- 成语库 -->
        <div v-else-if="libTab === 'idiom'">
          <el-form :model="idiomForm" label-width="60px" size="small">
            <el-form-item label="分类">
              <el-select v-model="idiomForm.category" placeholder="全部" clearable style="width: 100%">
                <el-option
                    v-for="cat in IDIOM_CATEGORIES"
                    :key="cat.code"
                    :label="cat.name"
                    :value="cat.code"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="搜索">
              <el-input
                  v-model="idiomForm.keyword"
                  placeholder="成语、释义或拼音..."
                  clearable
                  @keyup.enter="handleIdiomSearch"
              >
                <template #append>
                  <el-button @click="handleIdiomSearch">搜索</el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-form>

          <div v-if="idiomLoading" class="idiom-loading">
            <el-skeleton :rows="5" animated />
          </div>

          <div v-else-if="idiomResults.length > 0" class="idiom-results">
            <div class="idiom-toolbar">
              <el-checkbox
                  :model-value="isAllIdiomsSelected"
                  :indeterminate="isIdiomsIndeterminate"
                  @change="handleSelectAllIdioms"
                  size="small"
              >
                全选
              </el-checkbox>
              <span class="idiom-selected-count" v-if="selectedIdioms.length > 0">
                已选 {{ selectedIdioms.length }} 条
              </span>
            </div>
            <el-scrollbar height="340px">
              <el-card
                  v-for="item in idiomResults"
                  :key="item.id"
                  shadow="hover"
                  style="margin-bottom: 10px; cursor: pointer"
                  @click="selectIdiom(item)"
                  :class="{ 'selected': selectedIdioms.some(s => s.id === item.id) }"
                  size="small"
              >
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center">
                    <div style="display: flex; align-items: center; gap: 6px">
                      <el-checkbox
                          :model-value="selectedIdioms.some(s => s.id === item.id)"
                          @click.stop
                          @change="selectIdiom(item)"
                      />
                      <span style="font-weight: bold; font-size: 13px">{{ item.title }}</span>
                      <span v-if="item.pinyin" style="font-size: 12px; color: #909399; margin-left: 4px">{{ item.pinyin }}</span>
                    </div>
                    <el-tag size="small" type="info">{{ item.category }}</el-tag>
                  </div>
                </template>
                <div style="font-size: 12px; line-height: 1.6; color: var(--utools-text-primary)">
                  <span style="color: #909399">【释义】</span>{{ item.meaning }}
                </div>
                <div v-if="item.source" style="font-size: 12px; line-height: 1.6; color: var(--utools-text-secondary); margin-top: 4px">
                  <span style="color: #909399">【出处】</span>{{ item.source }}
                </div>
                <div v-if="item.example" style="font-size: 12px; line-height: 1.6; color: var(--utools-text-secondary); margin-top: 4px">
                  <span style="color: #909399">【例句】</span>{{ item.example }}
                </div>
              </el-card>
            </el-scrollbar>
          </div>

          <div v-else class="idiom-placeholder">
            <el-empty description="请选择分类或输入关键词搜索"/>
          </div>
        </div>

        <!-- 时间线：本地库 + AI 生成（手动/批量已由手动添加、批量导入 tab 覆盖） -->
        <div v-else-if="libTab === 'timeline'">
          <el-radio-group v-model="timelineSubTab" size="small" style="margin-bottom: 16px">
            <el-radio-button label="library">本地库</el-radio-button>
            <el-radio-button label="ai">AI 生成</el-radio-button>
          </el-radio-group>

          <!-- 本地库 -->
          <div v-if="timelineSubTab === 'library'">
            <el-form :model="timelineForm" label-width="60px" size="small">
              <el-form-item label="分类">
                <el-select v-model="timelineForm.category" placeholder="全部" clearable style="width: 100%">
                  <el-option v-for="c in TIMELINE_CATEGORIES" :key="c.code" :label="c.label" :value="c.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="区域">
                <el-select v-model="timelineForm.region" placeholder="全部" clearable style="width: 100%">
                  <el-option v-for="r in TIMELINE_REGIONS" :key="r.code" :label="r.label" :value="r.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="朝代">
                <el-select v-model="timelineForm.era" placeholder="全部" clearable filterable style="width: 100%">
                  <el-option v-for="e in availableTimelineEras" :key="e" :label="e" :value="e" />
                </el-select>
              </el-form-item>
              <el-form-item label="年号">
                <el-select v-model="timelineForm.reign" placeholder="全部" clearable filterable style="width: 100%">
                  <el-option v-for="r in availableTimelineReigns" :key="r" :label="r" :value="r" />
                </el-select>
              </el-form-item>
              <el-form-item label="年份">
                <div style="display: flex; align-items: center; gap: 6px; width: 100%">
                  <el-input v-model="timelineForm.yearFrom" type="number" placeholder="起始" style="flex: 1" />
                  <span style="color: #909399">—</span>
                  <el-input v-model="timelineForm.yearTo" type="number" placeholder="结束" style="flex: 1" />
                </div>
              </el-form-item>
              <el-form-item label="搜索">
                <el-input v-model="timelineForm.keyword" placeholder="事件名、人物、关键词..." clearable @keyup.enter="handleTimelineSearch">
                  <template #append><el-button @click="handleTimelineSearch">搜索</el-button></template>
                </el-input>
              </el-form-item>
            </el-form>

            <div v-if="timelineLoading" class="poetry-loading"><el-skeleton :rows="5" animated /></div>

            <div v-else-if="timelineResults.length > 0" class="poetry-results">
              <div class="poetry-toolbar">
                <el-checkbox :model-value="isAllTimelineSelected" @change="handleSelectAllTimeline" size="small">全选</el-checkbox>
                <span class="poetry-selected-count" v-if="selectedTimelineEvents.length > 0">已选 {{ selectedTimelineEvents.length }} 个</span>
              </div>
              <el-scrollbar height="340px">
                <el-card
                  v-for="(ev, idx) in timelineResults"
                  :key="idx"
                  shadow="hover"
                  style="margin-bottom: 10px; cursor: pointer"
                  @click="selectTimelineEvent(ev)"
                  :class="{ selected: selectedTimelineEvents.some(s => s.title === ev.title && s.year === ev.year) }"
                  size="small"
                >
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center">
                      <div style="display: flex; align-items: center; gap: 6px">
                        <el-checkbox :model-value="selectedTimelineEvents.some(s => s.title === ev.title && s.year === ev.year)" @click.stop @change="selectTimelineEvent(ev)" />
                        <span style="font-weight: bold; font-size: 13px">{{ ev.title }}</span>
                      </div>
                      <div>
                        <el-tag size="small" type="info" style="margin-right: 6px" v-if="ev.year">{{ ev.year < 0 ? `前${Math.abs(ev.year)}` : ev.year }}</el-tag>
                        <el-tag size="small" type="info" v-if="ev.era">{{ ev.era }}</el-tag>
                      </div>
                    </div>
                  </template>
                  <div style="white-space: pre-line; font-size: 12px; line-height: 1.6; margin-bottom: 6px; color: var(--utools-text-secondary)">
                    {{ ev.content.substring(0, 80) }}{{ ev.content.length > 80 ? '...' : '' }}
                  </div>
                  <div v-if="ev.location" style="font-size: 11px; color: #909399">📍 {{ ev.location }}</div>
                </el-card>
              </el-scrollbar>
            </div>

            <div v-else class="poetry-placeholder"><el-empty description="请选择分类/区域或输入关键词搜索"/></div>
          </div>

          <!-- AI 生成 -->
          <div v-else>
            <el-alert title="AI 批量生成历史事件" type="info" :closable="false" style="margin-bottom: 12px">
              输入主题或年代范围（如「唐代大事」「工业革命」「一战」），AI 自动整理一批事件供挑选导入。可在下方选择 AI，未填 API Key 时使用「单词列表 → 设置」中的默认配置。
            </el-alert>
            <el-form :model="timelineAiForm" label-width="70px" size="small" style="margin-bottom: 12px">
              <el-form-item label="AI 提供商">
                <el-select v-model="timelineAiForm.provider" placeholder="使用默认 AI" clearable style="width: 100%">
                  <el-option v-for="p in AI_PROVIDER_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="API Key" v-if="timelineAiForm.provider">
                <el-input v-model="timelineAiForm.apiKey" type="password" show-password placeholder="留空则使用单词列表设置中的 Key" />
              </el-form-item>
            </el-form>
            <el-input v-model="timelineAiTopic" placeholder="输入主题，如 唐代大事 / 工业革命 / 法国大革命">
              <template #append><el-button @click="handleTimelineAiGenerate" :loading="timelineAiLoading">生成</el-button></template>
            </el-input>

            <div v-if="timelineAiResults.length > 0" class="poetry-results" style="margin-top: 16px">
              <div class="poetry-toolbar">
                <span class="poetry-selected-count" v-if="selectedTimelineAi.length > 0">已选 {{ selectedTimelineAi.length }} 个</span>
              </div>
              <el-scrollbar height="320px">
                <el-card
                  v-for="(ev, idx) in timelineAiResults"
                  :key="idx"
                  shadow="hover"
                  style="margin-bottom: 10px; cursor: pointer"
                  @click="selectTimelineAi(ev)"
                  :class="{ selected: selectedTimelineAi.some(s => s.title === ev.title && s.year === ev.year) }"
                  size="small"
                >
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center">
                      <div style="display: flex; align-items: center; gap: 6px">
                        <el-checkbox :model-value="selectedTimelineAi.some(s => s.title === ev.title && s.year === ev.year)" @click.stop @change="selectTimelineAi(ev)" />
                        <span style="font-weight: bold; font-size: 13px">{{ ev.title }}</span>
                      </div>
                      <el-tag size="small" type="info" v-if="ev.year">{{ ev.year < 0 ? `前${Math.abs(ev.year)}` : ev.year }}</el-tag>
                    </div>
                  </template>
                  <div style="white-space: pre-line; font-size: 12px; line-height: 1.6; color: var(--utools-text-secondary)">
                    {{ ev.content.substring(0, 80) }}{{ ev.content.length > 80 ? '...' : '' }}
                  </div>
                </el-card>
              </el-scrollbar>
            </div>
            <div v-else-if="!timelineAiLoading" class="poetry-placeholder"><el-empty description="输入主题后点击生成"/></div>
          </div>
        </div>

        <!-- 知识库：当前宿主分类（text）的内置知识包导入列表，按「可否作桩库」分组 -->
        <div v-else-if="libTab === 'knowledge'">
          <el-input
              v-model="knowledgeKeyword"
              class="lib-search"
              size="small"
              clearable
              :prefix-icon="Search"
              placeholder="搜索知识库名称或描述"
          />
          <div v-if="knowledgeGroups.length === 0" class="import-empty">
            {{ knowledgeKeyword.trim() ? '没有匹配的知识库' : '暂无可导入的知识库' }}
          </div>
          <div
              v-for="g in knowledgeGroups"
              :key="g.label"
              class="import-group"
          >
            <div class="import-group-title">{{ g.label }}</div>
            <div
                v-for="p in g.packs"
                :key="p.id"
                class="import-pack-row"
                :class="{ imported: isKnowledgeImported(p.id) }"
            >
              <div class="import-pack-info">
                <div class="import-pack-name">
                  <span v-if="packEmojis(p.id)" class="pack-emojis">{{ packEmojis(p.id) }}</span>
                  {{ p.name }}
                  <span class="import-pack-count">{{ p.itemCount }} 条</span>
                </div>
                <div class="import-pack-desc" :title="p.description">{{ p.description }}</div>
              </div>
              <el-button
                  size="small"
                  type="primary"
                  :disabled="isKnowledgeImported(p.id)"
                  :loading="knowledgeImportingId === p.id"
                  @click="handleImportKnowledge(p.id)"
              >
                {{ isKnowledgeImported(p.id) ? '已导入' : '导入' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 宫殿桩库：usableAsPeg 包导入为记忆宫殿 -->
        <div v-else>
          <el-input
              v-model="pegKeyword"
              class="lib-search"
              size="small"
              clearable
              :prefix-icon="Search"
              placeholder="搜索桩库名称或描述"
          />
          <div v-if="filteredPegPacks.length === 0" class="import-empty">
            {{ pegKeyword.trim() ? '没有匹配的桩库' : '暂无可导入的桩库' }}
          </div>
          <div
              v-for="p in filteredPegPacks"
              :key="p.id"
              class="import-pack-row"
              :class="{ imported: isPegImported(p.id) }"
          >
            <div class="import-pack-info">
              <div class="import-pack-name">
                <span v-if="packEmojis(p.id)" class="pack-emojis">{{ packEmojis(p.id) }}</span>
                {{ p.name }}
                <span class="import-pack-count">{{ p.itemCount }} 桩</span>
              </div>
              <div class="import-pack-desc" :title="p.description">{{ p.description }}</div>
            </div>
            <el-button
                size="small"
                type="primary"
                :disabled="isPegImported(p.id)"
                :loading="pegImportingId === p.id"
                @click="handleImportPeg(p.id)"
            >
              {{ isPegImported(p.id) ? '已导入' : '导入' }}
            </el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button v-if="showFooterImport" type="primary" @click="handleImport" :loading="importing">
        {{ importButtonText }}
      </el-button>
    </template>
  </el-dialog>

  <!-- AI 配置对话框 -->
  <el-dialog
      v-model="showAIConfig"
      title="AI 搜索配置"
      width="500px"
      destroy-on-close
  >
    <el-alert
        title="使用单词列表中的 AI 设置"
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
    >
      <template #default>
        <p>AI 搜索将使用「单词列表」设置中的 API Key。</p>
        <p style="font-size: 12px; color: #666; margin-top: 4px">
          请在「单词列表 → 设置」中配置 DeepSeek、通义千问、Kimi、GLM 等 API Key
        </p>
      </template>
    </el-alert>

    <el-form :model="aiConfigForm" label-width="100px">
      <el-form-item label="启用 AI">
        <el-switch v-model="aiConfigForm.enabled"/>
      </el-form-item>

      <el-form-item label="AI 提供商">
        <el-select v-model="aiConfigForm.provider" style="width: 100%">
          <el-option label="智谱 GLM（免费/有额度）" value="glm"/>
          <el-option label="DeepSeek" value="deepseek"/>
          <el-option label="通义千问" value="qwen"/>
          <el-option label="Kimi 月之暗面" value="kimi"/>
          <el-option label="Ollama 本地模型" value="ollama"/>
          <el-option label="SiliconFlow" value="siliconflow"/>
          <el-option label="OpenRouter" value="openrouter"/>
          <el-option label="自定义" value="custom"/>
        </el-select>
      </el-form-item>

      <template v-if="aiConfigForm.provider === 'custom'">
        <el-form-item label="API 地址">
          <el-input
              v-model="aiConfigForm.apiUrl"
              placeholder="https://api.example.com/v1/chat/completions"
          />
        </el-form-item>
        <el-form-item label="模型名称">
          <el-input
              v-model="aiConfigForm.model"
              placeholder="模型名称"
          />
        </el-form-item>
      </template>

      <el-form-item label="API Key">
        <el-input
            v-model="aiConfigForm.apiKey"
            type="password"
            show-password
            placeholder="优先使用单词列表中的设置，也可在此处覆盖"
        />
      </el-form-item>

      <el-form-item>
        <el-button
            @click="handleTestAI"
            :loading="aiTesting"
            :type="aiTestResult === true ? 'success' : aiTestResult === false ? 'danger' : 'default'"
        >
          <template v-if="aiTestResult === true">连接成功</template>
          <template v-else-if="aiTestResult === false">连接失败</template>
          <template v-else>测试连接</template>
        </el-button>
        <el-button link type="primary" @click="openWordSettings">
          打开单词列表设置
        </el-button>
      </el-form-item>

      <el-alert
          title="免费 API 推荐"
          type="success"
          :closable="false"
          style="margin-top: 16px"
      >
        <template #default>
          <ul style="margin: 8px 0; padding-left: 20px">
            <li>
              <strong>智谱 GLM-4-Flash</strong> - 免费使用，在单词列表设置中申请
            </li>
            <li>
              <a href="https://siliconflow.cn/" target="_blank" style="color: var(--utools-text-secondary)">SiliconFlow</a>
              - 注册即送 2000 万 Tokens
            </li>
            <li>
              <a href="https://platform.deepseek.com/" target="_blank" style="color: var(--utools-text-secondary)">DeepSeek</a>
              - 价格便宜，效果优秀
            </li>
          </ul>
        </template>
      </el-alert>
    </el-form>

    <template #footer>
      <el-button @click="showAIConfig = false">取消</el-button>
      <el-button type="primary" @click="handleSaveAIConfig">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {ref, computed, watch, nextTick} from 'vue';
import {useTextMemoryStore} from '@/stores/textMemory';
import {Search, UploadFilled, Setting, Location} from '@element-plus/icons-vue';
import {ElMessage} from 'element-plus';
import {
  searchPoetry,
  fetchAllPoetry,
  type PoetryItem,
  type PoetryDynasty
} from '@/utils/poetry-service';
import {
  smartSearchWithAI,
  getAISearchConfig,
  saveAISearchConfig,
  testAIConnection,
  type AISearchConfig,
  type AISearchResult
} from '@/utils/ai-search-api';
import {
  fetchAllIdioms,
  filterIdioms,
  IDIOM_CATEGORIES,
  type IdiomItem
} from '@/utils/idiom-service';
import {
  fetchAllTimelineEvents,
  filterTimelineEvents,
  mapLibraryEventToArticle,
  parseBatchTimeline,
  parseFigures,
  parseRelations,
  collectEras,
  collectReigns,
  TIMELINE_CATEGORIES,
  TIMELINE_REGIONS,
  type LibraryTimelineEvent
} from '@/utils/timeline-service';
import { generateTimelineEventsWithAI } from '@/utils/ai-search-api';
import type { TimelineCategory, TimelineRegion } from '@/types/text-memory';
import { useKnowledgeMemoryStore } from '@/stores/knowledgeMemory';
import { useMemoryPalaceStore } from '@/stores/memoryPalace';
import { loadPackPreviews } from '@/utils/knowledge-pack-preview';
import type { KnowledgePackInfo } from '@/types/knowledge-memory';
import TextEditForm from './TextEditForm.vue';

interface Props {
  modelValue: boolean;
  // 打开时定位到的一级 tab（manual/batch/file/library），默认手动添加；
  // 兼容旧值：poetry/idiom/timeline/knowledge/pegPacks 视为内置库二级
  initialTab?: string;
  // 内置库 tab 打开时定位到的二级面板（poetry/idiom/timeline/knowledge/pegPacks）
  initialLibTab?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'import', articles: any[]): void;
  (e: 'openWordSettings'): void;
}>();

const textStore = useTextMemoryStore();
const knowledgeStore = useKnowledgeMemoryStore();
const palaceStore = useMemoryPalaceStore();

// 内置库二级面板取值
type LibTab = 'poetry' | 'idiom' | 'timeline' | 'knowledge' | 'pegPacks';
const LIB_SUB_TABS: LibTab[] = ['poetry', 'idiom', 'timeline', 'knowledge', 'pegPacks'];

// 统一的「添加/导入」入口，默认停在内置库 tab；打开时由 initialTab/initialLibTab 定位
const activeTab = ref('library');
const libTab = ref<LibTab>('poetry');

// 按 props 解析初始 tab 定位（打开对话框与重置表单时调用）
function applyInitialTab() {
  const t = props.initialTab || 'library';
  if ((LIB_SUB_TABS as string[]).includes(t)) {
    // 旧调用方式：initialTab 直接传内置库二级名
    activeTab.value = 'library';
    libTab.value = t as LibTab;
  } else {
    activeTab.value = t;
    if (props.initialLibTab && (LIB_SUB_TABS as string[]).includes(props.initialLibTab)) {
      libTab.value = props.initialLibTab as LibTab;
    }
  }
}
applyInitialTab();

const importing = ref(false);
const timelineSubTab = ref<'library' | 'ai'>('library');
const activeCollapse = ref(['plain']); // 默认展开普通文本格式说明

const importButtonText = computed(() => {
  if (activeTab.value === 'library') {
    if (libTab.value === 'poetry' && selectedPoetries.value.length > 0) {
      return `导入 ${selectedPoetries.value.length} 首`;
    }
    if (libTab.value === 'idiom' && selectedIdioms.value.length > 0) {
      return `导入 ${selectedIdioms.value.length} 条成语`;
    }
    if (libTab.value === 'timeline') {
      const n = selectedTimelineEvents.value.length + selectedTimelineAi.value.length;
      if (n > 0) return `导入 ${n} 个事件`;
    }
  }
  return '导入';
});

// 现有标签
const existingTags = computed(() => textStore.allTags);

// 底部「导入」按钮仅对批量/文件/内置库汇聚型面板有效；
// 手动添加、知识库、宫殿桩库各自有提交/导入按钮
const showFooterImport = computed(() => {
  if (activeTab.value === 'manual') return false;
  if (activeTab.value === 'library' && (libTab.value === 'knowledge' || libTab.value === 'pegPacks')) return false;
  return true;
});

// ==================== 手动添加 ====================
// 手动添加类型：普通文本/诗词/成语/知识条目/时间线事件/宫殿桩
type ManualType = 'text' | 'poetry' | 'idiom' | 'knowledge' | 'timeline' | 'peg';
const manualType = ref<ManualType>('text');
const manualFormRef = ref<InstanceType<typeof TextEditForm>>();

// 手动添加-诗词
const POETRY_DYNASTY_OPTIONS = ['先秦', '两汉', '魏晋南北朝', '隋', '唐', '宋', '元', '明', '清', '近现代'];
const manualPoetryForm = ref({
  title: '',
  dynasty: '',
  author: '',
  year: '' as number | '',
  location: '',
  content: '',
  tags: [] as string[],
});

// 手动添加-成语
const manualIdiomForm = ref({
  title: '',
  meaning: '',
  source: '',
  tags: [] as string[],
});

// 手动添加-知识条目
const manualKnowledgeForm = ref({
  setName: '',
  question: '',
  answer: '',
  tags: [] as string[],
});

// 手动添加-宫殿桩
const manualPegForm = ref({
  palaceId: '',
  order: '' as number | '',
  name: '',
  alternates: '', // 逗号分隔
  description: '',
});

// 「新建宫殿...」仅作引导提示，宫殿创建在宫殿视图完成
function handlePegPalaceChange(val: string) {
  if (val === '__new__') {
    manualPegForm.value.palaceId = '';
    ElMessage.info('请先在「宫殿」视图中创建宫殿，再回来添加桩');
  }
}

// 点击「添加」：按当前类型分发保存逻辑
async function handleManualSave() {
  switch (manualType.value) {
    case 'text':
      // 触发内嵌表单校验与提交
      manualFormRef.value?.submit();
      break;
    case 'poetry':
      saveManualPoetry();
      break;
    case 'idiom':
      saveManualIdiom();
      break;
    case 'knowledge':
      await saveManualKnowledge();
      break;
    case 'timeline':
      saveManualTimeline();
      break;
    case 'peg':
      await saveManualPeg();
      break;
  }
}

// 普通文本表单提交成功：作为单篇文章走统一 import 通道（父级添加并关闭对话框）
function handleManualSubmit(article: any) {
  emit('import', [article]);
}

// 诗词：保存为 category='poetry' 的 TextArticle
function saveManualPoetry() {
  const f = manualPoetryForm.value;
  if (!f.title.trim() || !f.content.trim()) {
    ElMessage.warning('请填写标题和正文');
    return;
  }
  emit('import', [{
    title: f.title.trim(),
    content: f.content.trim(),
    author: f.author.trim() || undefined,
    dynasty: f.dynasty || undefined,
    year: f.year === '' ? undefined : Number(f.year),
    location: f.location.trim() || undefined,
    tags: f.tags,
    category: 'poetry',
  }]);
}

// 成语：保存为 category='idiom' 的 TextArticle（内容与成语库导入格式一致）
function saveManualIdiom() {
  const f = manualIdiomForm.value;
  if (!f.title.trim() || !f.meaning.trim()) {
    ElMessage.warning('请填写成语和释义');
    return;
  }
  const content = [
    `【释义】${f.meaning.trim()}`,
    f.source.trim() && `【出处】${f.source.trim()}`,
  ].filter(Boolean).join('\n');
  emit('import', [{
    title: f.title.trim(),
    content,
    tags: ['成语', ...f.tags],
    source: f.source.trim() || undefined,
    category: 'idiom',
  }]);
}

// 时间线事件：复用原 timeline 手动子 tab 的保存路径（buildManualEvent → mapLibraryEventToArticle）
function saveManualTimeline() {
  const ev = buildManualEvent();
  if (!ev) return;
  emit('import', [mapLibraryEventToArticle(ev)]);
}

// 知识条目：保存到知识库 store（自建条目），成功后保留知识集/标签便于连续录入
async function saveManualKnowledge() {
  const f = manualKnowledgeForm.value;
  if (!f.question.trim() || !f.answer.trim()) {
    ElMessage.warning('请填写名称/问题与答案/释义');
    return;
  }
  try {
    await knowledgeStore.addCustomItem({
      setName: f.setName.trim() || undefined,
      question: f.question.trim(),
      answer: f.answer.trim(),
      tags: f.tags.length ? [...f.tags] : undefined,
    });
    ElMessage.success('已保存到知识库');
    manualKnowledgeForm.value = {...manualKnowledgeForm.value, question: '', answer: ''};
  } catch (e) {
    ElMessage.error('保存失败，请重试');
  }
}

// 宫殿桩：向所选宫殿的 loci 追加一个桩（备选桩存 alternates）
async function saveManualPeg() {
  const f = manualPegForm.value;
  if (!f.palaceId || f.palaceId === '__new__') {
    ElMessage.warning('请选择所属宫殿');
    return;
  }
  if (!f.name.trim()) {
    ElMessage.warning('请填写桩名');
    return;
  }
  const palace = palaceStore.palaces.find(p => p._id === f.palaceId);
  if (!palace) {
    ElMessage.error('宫殿不存在，请刷新后重试');
    return;
  }
  const alternates = f.alternates.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const newLocus = {
    order: 0, // 占位，updatePalace 会按数组顺序重排
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    alternates: alternates.length ? alternates : undefined,
  };
  const loci = [...palace.loci];
  const insertIdx = f.order === ''
    ? loci.length
    : Math.min(Math.max(Number(f.order) - 1, 0), loci.length);
  loci.splice(insertIdx, 0, newLocus);
  try {
    const result = await palaceStore.updatePalace({...palace, loci});
    if (result.ok) {
      ElMessage.success(`已在「${palace.name}」添加桩「${newLocus.name}」`);
      manualPegForm.value = {...manualPegForm.value, order: '', name: '', alternates: '', description: ''};
    } else {
      ElMessage.error('保存失败');
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  }
}

// ==================== 知识库（text 分类内置包） ====================
const knowledgePacks = computed(() => knowledgeStore.packList.filter(p => p.category === 'text'));
const knowledgeImportingId = ref('');
// 知识库搜索关键词
const knowledgeKeyword = ref('');
// 包配图缩略预览（packId → emoji 串），切到 tab 时按需加载
const packPreviews = ref<Record<string, string>>({});

// 关键词匹配：名称或描述包含即可
function matchPackKeyword(info: KnowledgePackInfo, keyword: string): boolean {
  if (!keyword) return true;
  return info.name.toLowerCase().includes(keyword) || info.description.toLowerCase().includes(keyword);
}

// 缩略配图串：只取按需加载的预览（不读 store 包内容，避免多余请求）
function packEmojis(packId: string): string {
  return packPreviews.value[packId] || '';
}

// 导入候选分组：可用作宫殿桩库的包优先展示，空组不渲染标题
const knowledgeGroups = computed<Array<{label: string; packs: KnowledgePackInfo[]}>>(() => {
  const kw = knowledgeKeyword.value.trim().toLowerCase();
  const filtered = knowledgePacks.value.filter(p => matchPackKeyword(p, kw));
  return [
    {label: '可用作记忆宫殿桩库', packs: filtered.filter(p => p.usableAsPeg)},
    {label: '普通知识库', packs: filtered.filter(p => !p.usableAsPeg)},
  ].filter(g => g.packs.length > 0);
});

function isKnowledgeImported(packId: string): boolean {
  return knowledgeStore.importedIds.includes(packId);
}

async function handleImportKnowledge(packId: string) {
  knowledgeImportingId.value = packId;
  try {
    await knowledgeStore.importPack(packId);
    ElMessage.success('导入成功');
  } finally {
    knowledgeImportingId.value = '';
  }
}

// ==================== 宫殿桩库（usableAsPeg 包） ====================
const pegPacks = computed(() => palaceStore.listPegPacks());
const pegImportingId = ref('');
// 桩库搜索关键词
const pegKeyword = ref('');

const filteredPegPacks = computed(() => {
  const kw = pegKeyword.value.trim().toLowerCase();
  return pegPacks.value.filter(p => matchPackKeyword(p, kw));
});

// 已存在对应 sourcePackId 的宫殿则视为已导入
function isPegImported(packId: string): boolean {
  return palaceStore.palaces.some(p => p.sourcePackId === packId);
}

async function handleImportPeg(packId: string) {
  pegImportingId.value = packId;
  try {
    const { result, palace } = await palaceStore.importPackAsPalace(packId);
    if (result.ok) {
      ElMessage.success(`已导入宫殿「${palace.name}」`);
    } else {
      ElMessage.error('导入失败');
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败');
  } finally {
    pegImportingId.value = '';
  }
}

// ==================== 批量导入 ====================
// 批量导入类型（宫殿桩为结构化数据，不支持批量文本导入）
type BatchType = 'text' | 'poetry' | 'idiom' | 'knowledge' | 'timeline';
const batchType = ref<BatchType>('text');
const batchContent = ref('');

// 各类型格式说明
const BATCH_FORMAT_TIPS: Record<BatchType, { desc: string; example: string; placeholder: string }> = {
  text: {
    desc: '每篇文章使用以下格式，多篇文章用 --- 分隔：',
    example: '标题：文章标题\n标签：标签1,标签2\n作者：作者名\n---\n文章内容...\n---\n标题：另一篇文章\n...',
    placeholder: '粘贴批量导入的文本...',
  },
  poetry: {
    desc: '格式同普通文本，另支持「朝代：/年份：/地点：」元数据；导入后归类为诗词：',
    example: '标题：静夜思\n作者：李白\n朝代：唐\n年份：726\n地点：扬州\n标签：唐诗\n---\n床前明月光，\n疑是地上霜。',
    placeholder: '粘贴批量诗词文本，用 --- 分隔...',
  },
  idiom: {
    desc: '标题即成语，正文为释义，另支持「出处：」元数据；导入后归类为成语：',
    example: '标题：画蛇添足\n出处：《战国策·齐策二》\n标签：寓言\n---\n比喻做了多余的事，反而弄巧成拙。',
    placeholder: '粘贴批量成语文本，用 --- 分隔...',
  },
  knowledge: {
    desc: '每条一个问答对，多条用 --- 分隔；「知识集：」可省，「答案：」之后的内容并入答案；保存到知识库：',
    example: '知识集：常识\n问题：水的化学式\n答案：H₂O\n---\n问题：光年是什么单位\n答案：长度单位',
    placeholder: '粘贴批量知识条目，用 --- 分隔...',
  },
  timeline: {
    desc: '多事件用 --- 分隔，每段可写「标题：/分类：/区域：/年份：/年号：/时代：/地点：/标签：/背景：/人物：/关系：」元数据，其余行作为正文。人物：人名|头衔|简介；关系：甲|乙|关系|说明：',
    example: '标题：贞观之治\n分类：politics\n区域：china\n年份：627\n时代：唐\n地点：长安\n标签：盛世\n---\n唐太宗李世民即位后励精图治...',
    placeholder: '粘贴批量事件文本，用 --- 分隔...',
  },
};

const batchFormatTip = computed(() => BATCH_FORMAT_TIPS[batchType.value]);
const batchPlaceholder = computed(() => BATCH_FORMAT_TIPS[batchType.value].placeholder);

// ==================== 文件导入 ====================
// 文件导入类型：影响导入后的 category 归属（知识条目/时间线按对应批量格式解析）
const fileType = ref<BatchType>('text');
const fileContent = ref('');
const fileForm = ref({
  title: '',
  tags: [] as string[]
});

// 联网导入
const onlineForm = ref({
  type: 'search',
  url: '',
  keyword: '',
  tags: [] as string[]
});
const searchResults = ref<any[]>([]);
const selectedResult = ref<number | null>(null);

// 诗词库
const poetryForm = ref({
  dynasty: '' as PoetryDynasty | '',
  keyword: '',
  tags: [] as string[]
});
const allLibraryPoems = ref<PoetryItem[]>([]);
const poetryResults = ref<PoetryItem[]>([]);
const selectedPoetries = ref<PoetryItem[]>([]);
const poetryLoading = ref(false);
const hasLoadedLibrary = ref(false);

const isAllSelected = computed(() => {
  return poetryResults.value.length > 0 && poetryResults.value.every(p => selectedPoetries.value.some(s => s.id === p.id));
});

const isIndeterminate = computed(() => {
  return selectedPoetries.value.length > 0 && selectedPoetries.value.length < poetryResults.value.length;
});

// 成语库
const idiomForm = ref({
  category: '',
  keyword: '',
});
const allIdioms = ref<IdiomItem[]>([]);
const idiomResults = ref<IdiomItem[]>([]);
const selectedIdioms = ref<IdiomItem[]>([]);
const idiomLoading = ref(false);
const hasLoadedIdioms = ref(false);

const isAllIdiomsSelected = computed(() => {
  return idiomResults.value.length > 0 && idiomResults.value.every(p => selectedIdioms.value.some(s => s.id === p.id));
});

const isIdiomsIndeterminate = computed(() => {
  return selectedIdioms.value.length > 0 && idiomResults.value.some(p => selectedIdioms.value.some(s => s.id === p.id))
      && !isAllIdiomsSelected.value;
});

// ==================== 时间线 ====================
// 本地库
const timelineForm = ref({
  category: '' as TimelineCategory | '',
  region: '' as TimelineRegion | '',
  era: '',
  reign: '',
  yearFrom: '',
  yearTo: '',
  keyword: '',
});
const allTimelineEvents = ref<LibraryTimelineEvent[]>([]);
const timelineResults = ref<LibraryTimelineEvent[]>([]);
const selectedTimelineEvents = ref<LibraryTimelineEvent[]>([]);
const timelineLoading = ref(false);
const hasLoadedTimeline = ref(false);

// 朝代/时代、年号/时期候选（库加载后计算）
const availableTimelineEras = computed(() => collectEras(allTimelineEvents.value, timelineForm.value.region));
const availableTimelineReigns = computed(() => collectReigns(allTimelineEvents.value, timelineForm.value.era));

// 区域变化清空朝代/年号；朝代变化清空年号
watch(() => timelineForm.value.region, () => {
  timelineForm.value.era = '';
  timelineForm.value.reign = '';
});
watch(() => timelineForm.value.era, () => {
  timelineForm.value.reign = '';
});

// 时间线事件手动表单（手动添加 tab 的「时间线事件」类型使用）
const timelineManualForm = ref({
  title: '',
  content: '',
  category: 'politics' as TimelineCategory,
  region: 'china' as TimelineRegion,
  year: '' as number | '',
  reign: '',
  era: '',
  location: '',
  figures: '',   // 每行: 人名|头衔|简介
  relations: '', // 每行: 甲|乙|关系|说明
  background: '',
  tags: [] as string[],
});

// AI 生成
const timelineAiTopic = ref('');
const timelineAiLoading = ref(false);
const timelineAiResults = ref<LibraryTimelineEvent[]>([]);
const selectedTimelineAi = ref<LibraryTimelineEvent[]>([]);
const timelineAiForm = ref({
  provider: '' as '' | 'deepseek' | 'qwen' | 'kimi' | 'glm' | 'ollama' | 'siliconflow' | 'openrouter' | 'custom',
  apiKey: '',
});

// AI 提供商选项（label 与 ai-search-api 的 PROVIDER_CONFIGS 对齐）
const AI_PROVIDER_OPTIONS = [
  { label: '智谱 GLM（免费/有额度）', value: 'glm' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问', value: 'qwen' },
  { label: 'Kimi 月之暗面', value: 'kimi' },
  { label: 'Ollama 本地模型', value: 'ollama' },
  { label: 'SiliconFlow', value: 'siliconflow' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: '自定义', value: 'custom' },
] as const;

const isAllTimelineSelected = computed(() => {
  return timelineResults.value.length > 0 && timelineResults.value.every(p => selectedTimelineEvents.value.some(s => s.title === p.title && s.year === p.year));
});

function selectTimelineEvent(ev: LibraryTimelineEvent) {
  const idx = selectedTimelineEvents.value.findIndex(s => s.title === ev.title && s.year === ev.year);
  if (idx > -1) {
    selectedTimelineEvents.value.splice(idx, 1);
  } else {
    selectedTimelineEvents.value.push(ev);
  }
}

function handleSelectAllTimeline(val: boolean) {
  if (val) {
    const set = new Map<string, LibraryTimelineEvent>();
    selectedTimelineEvents.value.forEach(p => set.set(p.title + p.year, p));
    timelineResults.value.forEach(p => { if (!set.has(p.title + p.year)) set.set(p.title + p.year, p); });
    selectedTimelineEvents.value = Array.from(set.values());
  } else {
    const ids = new Set(timelineResults.value.map(p => p.title + p.year));
    selectedTimelineEvents.value = selectedTimelineEvents.value.filter(p => !ids.has(p.title + p.year));
  }
}

async function handleTimelineSearch() {
  timelineLoading.value = true;
  try {
    if (!hasLoadedTimeline.value || allTimelineEvents.value.length === 0) {
      allTimelineEvents.value = await fetchAllTimelineEvents();
      hasLoadedTimeline.value = true;
    }
    timelineResults.value = filterTimelineEvents(allTimelineEvents.value, {
      category: timelineForm.value.category || undefined,
      region: timelineForm.value.region || undefined,
      era: timelineForm.value.era || undefined,
      reign: timelineForm.value.reign || undefined,
      yearFrom: timelineForm.value.yearFrom || undefined,
      yearTo: timelineForm.value.yearTo || undefined,
      keyword: timelineForm.value.keyword,
    });
    const hasFilter = timelineForm.value.keyword || timelineForm.value.category || timelineForm.value.region
      || timelineForm.value.era || timelineForm.value.reign || timelineForm.value.yearFrom || timelineForm.value.yearTo;
    if (hasFilter) {
      if (timelineResults.value.length > 0) {
        ElMessage.success(`找到 ${timelineResults.value.length} 个事件`);
      } else {
        ElMessage.info('未找到匹配的事件');
      }
    }
  } catch (e) {
    console.error('时间线搜索失败', e);
    ElMessage.error('搜索失败，请重试');
  } finally {
    timelineLoading.value = false;
  }
}

// 把手动表单构造为事件
function buildManualEvent(): LibraryTimelineEvent | null {
  const f = timelineManualForm.value;
  if (!f.title || !f.content) {
    ElMessage.warning('请填写事件名和描述');
    return null;
  }
  return {
    title: f.title,
    content: f.content,
    category: f.category,
    region: f.region,
    year: f.year === '' ? undefined : Number(f.year),
    reign: f.reign || undefined,
    era: f.era || undefined,
    location: f.location || undefined,
    figures: parseFigures(f.figures),
    relations: parseRelations(f.relations),
    background: f.background || undefined,
    tags: f.tags,
  };
}

async function handleTimelineAiGenerate() {
  if (!timelineAiTopic.value.trim()) {
    ElMessage.warning('请输入主题，如"唐代大事""工业革命"');
    return;
  }
  timelineAiLoading.value = true;
  timelineAiResults.value = [];
  selectedTimelineAi.value = [];
  try {
    // 选了具体 provider 时构造覆盖配置，否则用默认（getAISearchConfig）
    let configOverride: AISearchConfig | undefined;
    if (timelineAiForm.value.provider) {
      const base = getAISearchConfig();
      configOverride = {
        ...base,
        provider: timelineAiForm.value.provider,
        apiKey: timelineAiForm.value.apiKey || base.apiKey,
      };
    }
    const results = await generateTimelineEventsWithAI(timelineAiTopic.value, { count: 8 }, configOverride);
    if (results.length > 0) {
      timelineAiResults.value = results;
      ElMessage.success(`AI 生成 ${results.length} 个事件`);
    } else {
      ElMessage.info('AI 未返回有效事件，请检查配置或换主题');
    }
  } finally {
    timelineAiLoading.value = false;
  }
}

function selectTimelineAi(ev: LibraryTimelineEvent) {
  const idx = selectedTimelineAi.value.findIndex(s => s.title === ev.title && s.year === ev.year);
  if (idx > -1) selectedTimelineAi.value.splice(idx, 1);
  else selectedTimelineAi.value.push(ev);
}

// AI 搜索
const aiForm = ref({
  keyword: '',
  type: 'auto' as 'poetry' | 'article' | 'auto',
  dynasty: '',
  articleType: 'essay' as 'essay' | 'prose' | 'poetry' | 'classic',
  tags: [] as string[]
});
const aiResults = ref<AISearchResult[]>([]);
const selectedAIResult = ref<AISearchResult | null>(null);
const aiSearching = ref(false);

// AI 配置
const showAIConfig = ref(false);
const aiConfigForm = ref<AISearchConfig>(getAISearchConfig());
const aiTesting = ref(false);
const aiTestResult = ref<boolean | null>(null);

// 考试资料
const examForm = ref({
  type: '',
  subject: '',
  keyword: '',
  tags: [] as string[]
});
const examResults = ref<PoetryItem[]>([]);
const selectedExamItem = ref<PoetryItem | null>(null);
const examSubjects = computed(() => {
  const subjectMap: Record<string, string[]> = {
    '专升本': ['语文', '英语', '数学', '政治', '文学常识', '古诗词'],
    '考研': ['政治', '英语', '数学', '专业课', '古诗词', '文学'],
    '考公': ['行测', '申论', '常识判断', '言语理解', '数量关系'],
    '职称': ['计算机', '英语', '专业知识', '综合能力'],
    '四六级': ['词汇', '阅读', '写作', '翻译', '听力'],
    '考研英语': ['词汇', '阅读', '写作', '翻译', '长难句']
  };
  return examForm.value.type ? (subjectMap[examForm.value.type] || []) : [];
});

// 诗词数据现在从 poetry-api.ts 导入

// 处理文件选择
function handleFileChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => {
    fileContent.value = e.target?.result as string;
    // 默认使用文件名作为标题
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    if (!fileForm.value.title) {
      fileForm.value.title = fileName;
    }
  };
  reader.readAsText(file.raw);
}

// 搜索诗词 - 使用本地诗词库
async function handlePoetrySearch() {
  const { dynasty, keyword } = poetryForm.value;

  poetryLoading.value = true;

  try {
    // 首次加载全库
    if (!hasLoadedLibrary.value || allLibraryPoems.value.length === 0) {
      const all = await fetchAllPoetry();
      allLibraryPoems.value = Object.values(all).flat();
      hasLoadedLibrary.value = true;
    }

    let results = allLibraryPoems.value;

    // 按朝代筛选
    if (dynasty) {
      results = results.filter(p => p.dynastyCode === dynasty || p.dynasty?.includes(getDynastyName(dynasty)));
    }

    // 按关键词筛选
    if (keyword) {
      const kw = keyword.toLowerCase();
      results = results.filter(p =>
        p.title.toLowerCase().includes(kw) ||
        p.author.toLowerCase().includes(kw) ||
        p.content.toLowerCase().includes(kw)
      );
    }

    poetryResults.value = results;

    if (results.length > 0) {
      ElMessage.success(`找到 ${results.length} 首相关诗词`);
    } else {
      ElMessage.info('未找到匹配的诗词，请尝试其他关键词');
    }
  } catch (error) {
    console.error('搜索失败:', error);
    ElMessage.error('搜索失败，请重试');
  } finally {
    poetryLoading.value = false;
  }
}

// 获取朝代名称
function getDynastyName(code: PoetryDynasty): string {
  const names: Record<PoetryDynasty, string> = {
    xianqin: '先秦',
    han: '两汉',
    weijin: '魏晋南北朝',
    sui: '隋',
    tang: '唐',
    song: '宋',
    yuan: '元',
    ming: '明',
    qing: '清',
    xiandai: '近现代',
  };
  return names[code] || code;
}

// 选择诗词（多选切换）
function selectPoetry(poem: PoetryItem) {
  const index = selectedPoetries.value.findIndex(p => p.id === poem.id);
  if (index > -1) {
    selectedPoetries.value.splice(index, 1);
  } else {
    selectedPoetries.value.push(poem);
  }
}

// 全选/取消全选
function handleSelectAll(val: boolean) {
  if (val) {
    const newSet = new Map<string, PoetryItem>();
    selectedPoetries.value.forEach(p => newSet.set(p.id, p));
    poetryResults.value.forEach(p => {
      if (!newSet.has(p.id)) {
        newSet.set(p.id, p);
      }
    });
    selectedPoetries.value = Array.from(newSet.values());
  } else {
    const resultIds = new Set(poetryResults.value.map(p => p.id));
    selectedPoetries.value = selectedPoetries.value.filter(p => !resultIds.has(p.id));
  }
}

// ==================== 成语库 ====================

async function handleIdiomSearch() {
  idiomLoading.value = true;
  try {
    if (!hasLoadedIdioms.value || allIdioms.value.length === 0) {
      allIdioms.value = await fetchAllIdioms();
      hasLoadedIdioms.value = true;
    }

    idiomResults.value = filterIdioms(allIdioms.value, idiomForm.value.keyword, {
      category: idiomForm.value.category || undefined,
    });

    if (idiomForm.value.keyword || idiomForm.value.category) {
      if (idiomResults.value.length > 0) {
        ElMessage.success(`找到 ${idiomResults.value.length} 条成语`);
      } else {
        ElMessage.info('未找到匹配的成语');
      }
    }
  } catch (error) {
    console.error('成语搜索失败:', error);
    ElMessage.error('搜索失败，请重试');
  } finally {
    idiomLoading.value = false;
  }
}

function selectIdiom(item: IdiomItem) {
  const index = selectedIdioms.value.findIndex(p => p.id === item.id);
  if (index > -1) {
    selectedIdioms.value.splice(index, 1);
  } else {
    selectedIdioms.value.push(item);
  }
}

function handleSelectAllIdioms(val: boolean) {
  if (val) {
    const newSet = new Map<string, IdiomItem>();
    selectedIdioms.value.forEach(p => newSet.set(p.id, p));
    idiomResults.value.forEach(p => {
      if (!newSet.has(p.id)) {
        newSet.set(p.id, p);
      }
    });
    selectedIdioms.value = Array.from(newSet.values());
  } else {
    const resultIds = new Set(idiomResults.value.map(p => p.id));
    selectedIdioms.value = selectedIdioms.value.filter(p => !resultIds.has(p.id));
  }
}

// 考试类型改变
function handleExamTypeChange() {
  examForm.value.subject = '';
  examResults.value = [];
  selectedExamItem.value = null;
}

// 搜索考试资料 - 使用本地诗词库
async function handleExamSearch() {
  const {type, subject, keyword} = examForm.value;

  if (!type && !keyword) {
    ElMessage.warning('请选择考试类型或输入关键词');
    return;
  }

  try {
    // 使用新的本地诗词服务搜索
    const searchTags: string[] = [];
    if (type) searchTags.push(type);
    if (subject) searchTags.push(subject);

    const results = await searchPoetry(keyword || '', {
      tags: searchTags.length > 0 ? searchTags : undefined,
    });

    examResults.value = results;

    if (examResults.value.length > 0) {
      ElMessage.success(`找到 ${examResults.value.length} 条相关资料`);
    } else {
      ElMessage.info('未找到相关资料，请尝试其他关键词');
    }
  } catch (error) {
    console.error('搜索失败:', error);
    ElMessage.error('搜索失败，请重试');
  }
}

// 选择考试资料
function selectExamItem(item: PoetryItem) {
  selectedExamItem.value = item;
}

// AI 搜索
async function handleAISearch() {
  if (!aiForm.value.keyword.trim()) {
    ElMessage.warning('请输入搜索关键词');
    return;
  }

  const config = getAISearchConfig();
  if (!config.enabled || !config.apiKey) {
    ElMessage.warning('请先配置 AI API Key');
    showAIConfig.value = true;
    return;
  }

  aiSearching.value = true;
  aiResults.value = [];
  selectedAIResult.value = null;

  try {
    const results = await smartSearchWithAI(
        aiForm.value.keyword,
        {
          type: aiForm.value.type,
          dynasty: aiForm.value.dynasty || undefined,
          articleType: aiForm.value.articleType
        },
        config
    );

    if (results.length > 0) {
      aiResults.value = results;
      ElMessage.success(`AI 找到 ${results.length} 个结果`);
    } else {
      ElMessage.info('未找到相关内容，请尝试其他关键词');
    }
  } catch (error) {
    console.error('AI 搜索失败:', error);
    ElMessage.error('搜索失败，请检查配置和网络');
  } finally {
    aiSearching.value = false;
  }
}

// 选择 AI 结果
function selectAIResult(result: AISearchResult) {
  selectedAIResult.value = result;
}

// 测试 AI 连接
async function handleTestAI() {
  aiTesting.value = true;
  aiTestResult.value = null;

  try {
    const result = await testAIConnection(aiConfigForm.value);
    aiTestResult.value = result;
    if (result) {
      ElMessage.success('连接成功');
    } else {
      ElMessage.error('连接失败，请检查 API Key 和配置');
    }
  } catch (error) {
    aiTestResult.value = false;
    ElMessage.error('连接失败');
  } finally {
    aiTesting.value = false;
  }
}

// 保存 AI 配置
function handleSaveAIConfig() {
  saveAISearchConfig(aiConfigForm.value);
  ElMessage.success('配置已保存');
  showAIConfig.value = false;
  aiTestResult.value = null;
}

// 打开单词列表设置
function openWordSettings() {
  // 关闭当前对话框
  showAIConfig.value = false;
  // 触发自定义事件，让父组件打开设置
  emit('openWordSettings');
}

// 处理搜索 - 使用本地诗词库搜索
async function handleSearch() {
  const keyword = onlineForm.value.keyword;
  const url = onlineForm.value.url;

  if (!keyword && !url) {
    ElMessage.warning('请输入搜索关键词或网页链接');
    return;
  }

  // 如果是URL模式，尝试抓取网页内容
  if (onlineForm.value.type === 'url' && url) {
    ElMessage.info('正在抓取网页内容...');
    try {
      // 由于跨域限制，这里提示用户手动复制
      searchResults.value = [{
        title: '网页内容导入',
        content: '由于浏览器安全限制，无法直接抓取网页。请手动打开网页，复制内容后使用「手动输入」功能导入。'
      }];
      ElMessage.info('请手动复制网页内容导入');
    } catch (error) {
      ElMessage.error('抓取失败，请手动复制内容');
    }
    return;
  }

  // 搜索模式 - 搜索本地诗词库
  if (keyword) {
    ElMessage.info('正在搜索本地诗词库...');
    try {
      // 使用新的本地诗词服务搜索
      const results = await searchPoetry(keyword);

      if (results.length > 0) {
        searchResults.value = results.map(p => ({
          title: `${p.title} - ${p.author}`,
          content: p.content,
          author: p.author,
          source: p.dynasty,
          location: p.location
        }));
        ElMessage.success(`找到 ${results.length} 个结果`);
      } else {
        ElMessage.info('未找到相关内容，请尝试其他关键词');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      ElMessage.error('搜索失败，请重试');
    }
  }
}

// 解析批量导入内容（普通文本/诗词/成语共用；支持 标题/作者/来源/出处/朝代/年份/地点/标签 元数据）
function parseBatchContent(content: string): any[] {
  const articles: any[] = [];
  const sections = content.split(/---+/).filter(s => s.trim());

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const article: any = {
      title: '',
      author: '',
      source: '',
      tags: [],
      content: ''
    };

    const contentLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('标题：') || trimmedLine.startsWith('标题:')) {
        article.title = trimmedLine.replace(/^标题[：:]\s*/, '');
      } else if (trimmedLine.startsWith('作者：') || trimmedLine.startsWith('作者:')) {
        article.author = trimmedLine.replace(/^作者[：:]\s*/, '');
      } else if (trimmedLine.startsWith('来源：') || trimmedLine.startsWith('来源:')) {
        article.source = trimmedLine.replace(/^来源[：:]\s*/, '');
      } else if (trimmedLine.startsWith('出处：') || trimmedLine.startsWith('出处:')) {
        article.source = trimmedLine.replace(/^出处[：:]\s*/, '');
      } else if (trimmedLine.startsWith('朝代：') || trimmedLine.startsWith('朝代:')) {
        article.dynasty = trimmedLine.replace(/^朝代[：:]\s*/, '');
      } else if (trimmedLine.startsWith('年份：') || trimmedLine.startsWith('年份:')) {
        const y = trimmedLine.replace(/^年份[：:]\s*/, '');
        article.year = y ? Number(y) : undefined;
      } else if (trimmedLine.startsWith('地点：') || trimmedLine.startsWith('地点:')) {
        article.location = trimmedLine.replace(/^地点[：:]\s*/, '');
      } else if (trimmedLine.startsWith('标签：') || trimmedLine.startsWith('标签:')) {
        article.tags = trimmedLine.replace(/^标签[：:]\s*/, '').split(/[,，]/).map(t => t.trim()).filter(Boolean);
      } else {
        contentLines.push(line);
      }
    }

    article.content = contentLines.join('\n').trim();

    if (article.title && article.content) {
      articles.push(article);
    }
  }

  return articles;
}

// 解析批量知识条目（--- 分隔；元数据：知识集/问题（或名称）/答案（或释义）/标签，答案之后的行并入答案）
function parseBatchKnowledge(content: string): { setName?: string; question: string; answer: string; tags?: string[] }[] {
  const sections = content.split(/---+/).map(s => s.trim()).filter(Boolean);
  const items: { setName?: string; question: string; answer: string; tags?: string[] }[] = [];
  const metaRe = (key: string) => new RegExp(`^${key}[：:]\\s*`);
  for (const section of sections) {
    const lines = section.split('\n');
    const item: { setName?: string; question?: string; answer?: string; tags?: string[] } = {};
    const answerExtra: string[] = [];
    let inAnswer = false;
    for (const line of lines) {
      const t = line.trim();
      if (!inAnswer && !t) continue;
      if (!inAnswer && metaRe('知识集').test(t)) {
        item.setName = t.replace(metaRe('知识集'), '');
      } else if (!inAnswer && (metaRe('问题').test(t) || metaRe('名称').test(t))) {
        const re = metaRe('问题').test(t) ? metaRe('问题') : metaRe('名称');
        item.question = t.replace(re, '');
      } else if (!inAnswer && (metaRe('答案').test(t) || metaRe('释义').test(t))) {
        const re = metaRe('答案').test(t) ? metaRe('答案') : metaRe('释义');
        item.answer = t.replace(re, '');
        inAnswer = true;
      } else if (!inAnswer && metaRe('标签').test(t)) {
        item.tags = t.replace(metaRe('标签'), '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
      } else if (inAnswer) {
        answerExtra.push(line);
      }
    }
    if (answerExtra.length) {
      item.answer = [item.answer || '', ...answerExtra].join('\n').trim();
    }
    if (item.question && item.answer) {
      items.push(item as { setName?: string; question: string; answer: string; tags?: string[] });
    }
  }
  return items;
}

// 批量知识条目保存到知识库 store（不走文章 import 通道）
async function importKnowledgeItems(items: { setName?: string; question: string; answer: string; tags?: string[] }[]): Promise<boolean> {
  try {
    for (const it of items) {
      await knowledgeStore.addCustomItem(it);
    }
    ElMessage.success(`已保存 ${items.length} 条知识条目到知识库`);
    return true;
  } catch (e) {
    ElMessage.error('保存失败，请重试');
    return false;
  }
}

// 按类型给批量/文件导入的文章补充 category 归属
function applyBatchCategory(articles: any[], type: BatchType): any[] {
  if (type === 'poetry') {
    return articles.map(a => ({...a, category: 'poetry'}));
  }
  if (type === 'idiom') {
    return articles.map(a => ({...a, category: 'idiom', tags: ['成语', ...(a.tags || [])]}));
  }
  return articles;
}

// 导入
async function handleImport() {
  if (importing.value) return;
  importing.value = true;

  let emitted = false;
  try {
    let articles: any[] = [];

    switch (activeTab.value) {
      case 'batch': {
        if (!batchContent.value.trim()) {
          ElMessage.warning('请输入批量导入内容');
          return;
        }
        if (batchType.value === 'timeline') {
          // 复用原 timeline tab 的批量解析逻辑（--- 分隔 + 元数据行）
          const evs = parseBatchTimeline(batchContent.value);
          if (evs.length === 0) {
            ElMessage.warning('未能解析出有效事件，请检查格式');
            return;
          }
          articles = evs.map(mapLibraryEventToArticle);
        } else if (batchType.value === 'knowledge') {
          const items = parseBatchKnowledge(batchContent.value);
          if (items.length === 0) {
            ElMessage.warning('未能解析出有效条目，请检查格式');
            return;
          }
          if (await importKnowledgeItems(items)) {
            batchContent.value = '';
          }
          return;
        } else {
          articles = applyBatchCategory(parseBatchContent(batchContent.value), batchType.value);
          if (articles.length === 0) {
            ElMessage.warning('未能解析出有效文章，请检查格式');
            return;
          }
        }
        break;
      }

      case 'file': {
        if (!fileContent.value) {
          ElMessage.warning('请先选择文件');
          return;
        }
        if (fileType.value === 'timeline') {
          const evs = parseBatchTimeline(fileContent.value);
          if (evs.length === 0) {
            ElMessage.warning('未能从文件解析出有效事件，请检查格式');
            return;
          }
          articles = evs.map(mapLibraryEventToArticle);
        } else if (fileType.value === 'knowledge') {
          const items = parseBatchKnowledge(fileContent.value);
          if (items.length === 0) {
            ElMessage.warning('未能从文件解析出有效条目，请检查格式');
            return;
          }
          if (await importKnowledgeItems(items)) {
            fileContent.value = '';
          }
          return;
        } else {
          articles = applyBatchCategory([{
            title: fileForm.value.title || '未命名',
            content: fileContent.value,
            tags: fileForm.value.tags,
            author: '',
            source: ''
          }], fileType.value);
        }
        break;
      }

      case 'online':
        if (selectedResult.value !== null && searchResults.value[selectedResult.value]) {
          const result = searchResults.value[selectedResult.value];
          articles = [{
            title: result.title,
            content: result.content,
            tags: onlineForm.value.tags,
            author: '',
            source: onlineForm.value.url || ''
          }];
        } else {
          ElMessage.warning('请选择搜索结果');
          return;
        }
        break;

      case 'library': {
        if (libTab.value === 'poetry') {
          if (selectedPoetries.value.length > 0) {
            articles = selectedPoetries.value.map(poem => ({
              title: poem.title,
              content: poem.content,
              tags: [...poem.tags, ...poetryForm.value.tags],
              author: poem.author,
              source: poem.source || poem.dynasty,
              dynasty: poem.dynasty,
              location: poem.location,
              category: 'poetry'
            }));
          } else {
            ElMessage.warning('请至少选择一首诗词');
            return;
          }
        } else if (libTab.value === 'idiom') {
          if (selectedIdioms.value.length > 0) {
            articles = selectedIdioms.value.map(it => ({
              title: it.title,
              content: [
                it.pinyin && `【拼音】${it.pinyin}`,
                `【释义】${it.meaning}`,
                it.source && `【出处】${it.source}`,
                it.story && `【典故】${it.story}`,
                it.example && `【例句】${it.example}`,
              ].filter(Boolean).join('\n'),
              tags: ['成语', it.category, ...it.tags].filter(Boolean),
              author: '',
              source: it.source || '成语库',
              category: 'idiom',
              location: it.location,
            }));
          } else {
            ElMessage.warning('请至少选择一条成语');
            return;
          }
        } else if (libTab.value === 'timeline') {
          const evs: LibraryTimelineEvent[] = timelineSubTab.value === 'ai'
            ? [...selectedTimelineAi.value]
            : [...selectedTimelineEvents.value];
          if (evs.length === 0) {
            ElMessage.warning('请选择至少一个事件');
            return;
          }
          articles = evs.map(mapLibraryEventToArticle);
        }
        break;
      }

      case 'exam':
        if (selectedExamItem.value) {
          const item = selectedExamItem.value;
          articles = [{
            title: item.title,
            content: item.content,
            tags: [...item.tags, ...examForm.value.tags],
            author: item.author,
            source: item.source || item.dynasty,
            location: item.location
          }];
        } else {
          ElMessage.warning('请选择一条考试资料');
          return;
        }
        break;

      case 'ai':
        if (selectedAIResult.value) {
          articles = [{
            title: selectedAIResult.value.title,
            content: selectedAIResult.value.content,
            tags: [...selectedAIResult.value.tags, ...aiForm.value.tags],
            author: selectedAIResult.value.author,
            source: selectedAIResult.value.source
          }];
        } else {
          ElMessage.warning('请选择一个 AI 搜索结果');
          return;
        }
        break;
    }

    emit('import', articles);
    emitted = true;
    resetForm();
  } finally {
    if (!emitted) {
      importing.value = false;
    }
  }
}

// 重置表单
function resetForm() {
  manualType.value = 'text';
  manualPoetryForm.value = {title: '', dynasty: '', author: '', year: '', location: '', content: '', tags: []};
  manualIdiomForm.value = {title: '', meaning: '', source: '', tags: []};
  manualKnowledgeForm.value = {setName: '', question: '', answer: '', tags: []};
  manualPegForm.value = {palaceId: '', order: '', name: '', alternates: '', description: ''};
  batchType.value = 'text';
  batchContent.value = '';
  fileType.value = 'text';
  fileContent.value = '';
  fileForm.value = {title: '', tags: []};
  onlineForm.value = {type: 'search', url: '', keyword: '', tags: []};
  searchResults.value = [];
  selectedResult.value = null;
  poetryForm.value = {dynasty: '', keyword: '', tags: []};
  poetryResults.value = [];
  selectedPoetries.value = [];
  idiomForm.value = {category: '', keyword: ''};
  idiomResults.value = [];
  selectedIdioms.value = [];
  examForm.value = {type: '', subject: '', keyword: '', tags: []};
  examResults.value = [];
  selectedExamItem.value = null;
  aiForm.value = {
    keyword: '',
    type: 'auto',
    dynasty: '',
    articleType: 'essay',
    tags: []
  };
  aiResults.value = [];
  selectedAIResult.value = null;
  aiSearching.value = false;
  // 时间线
  timelineForm.value = {category: '', region: '', era: '', reign: '', yearFrom: '', yearTo: '', keyword: ''};
  timelineResults.value = [];
  selectedTimelineEvents.value = [];
  timelineManualForm.value = {
    title: '', content: '', category: 'politics', region: 'china', year: '',
    reign: '', era: '', location: '', figures: '', relations: '', background: '', tags: [],
  };
  timelineAiTopic.value = '';
  timelineAiResults.value = [];
  selectedTimelineAi.value = [];
  timelineAiForm.value = { provider: '', apiKey: '' };
  timelineSubTab.value = 'library';
  libTab.value = 'poetry';
  // 清空内置库搜索词与缩略预览缓存，避免关闭再打开残留上次过滤态
  knowledgeKeyword.value = '';
  pegKeyword.value = '';
  packPreviews.value = {};
  applyInitialTab();
}

// 关闭对话框
function handleClose() {
  emit('update:modelValue', false);
  resetForm();
}

// 打开时定位到 initialTab/initialLibTab；关闭时重置导入状态（导入成功后保持 loading，由关闭触发重置）
watch(() => props.modelValue, (val) => {
  if (val) {
    applyInitialTab();
  } else {
    importing.value = false;
  }
});

// 按内置库二级面板懒加载对应数据
function loadLibTabData(tab: LibTab) {
  if (tab === 'poetry') {
    nextTick(() => {
      if (!hasLoadedLibrary.value) {
        handlePoetrySearch();
      }
    });
  } else if (tab === 'idiom') {
    nextTick(() => {
      if (!hasLoadedIdioms.value) {
        handleIdiomSearch();
      }
    });
  } else if (tab === 'knowledge') {
    // 加载已导入清单以正确显示禁用态，失败静默；顺带加载缩略预览
    knowledgeStore.loadImportedIds().catch(() => undefined);
    loadPackPreviews(knowledgePacks.value).then(map => {
      Object.assign(packPreviews.value, map);
    });
  } else if (tab === 'pegPacks') {
    // 宫殿列表未加载时兜底加载，用于「已导入」判断
    if (palaceStore.palaces.length === 0) {
      palaceStore.loadPalaces().catch(() => undefined);
    }
    loadPackPreviews(pegPacks.value).then(map => {
      Object.assign(packPreviews.value, map);
    });
  } else if (tab === 'timeline') {
    nextTick(async () => {
      if (!hasLoadedTimeline.value) {
        try {
          allTimelineEvents.value = await fetchAllTimelineEvents();
          hasLoadedTimeline.value = true;
        } catch (e) {
          console.error('加载时间线库失败', e);
        }
      }
    });
  }
}

function handleDialogOpened() {
  // initialTab 与上次 activeTab 相同时 watch 不触发，这里兜底加载
  if (activeTab.value === 'library') {
    loadLibTabData(libTab.value);
  }
}

watch(activeTab, (tab) => {
  if (tab === 'library') {
    loadLibTabData(libTab.value);
  }
});

watch(libTab, (tab) => {
  if (activeTab.value === 'library') {
    loadLibTabData(tab);
  }
});

// 手动添加切到宫殿桩时，兜底加载宫殿列表供下拉选择
watch(manualType, (type) => {
  if (type === 'peg' && palaceStore.palaces.length === 0) {
    palaceStore.loadPalaces().catch(() => undefined);
  }
});
</script>

<style scoped lang="scss">
.upload-area {
  :deep(.el-upload-dragger) {
    width: 100%;
  }
}

.file-preview {
  margin-top: 20px;
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;

  h4 {
    margin-top: 0;
    margin-bottom: 12px;
    color: var(--utools-text-primary);
  }
}

// 类型选择器行（手动添加/批量导入/文件导入顶部共用）
.type-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;

  .type-bar-label {
    font-size: 13px;
    color: var(--utools-text-secondary);
    flex-shrink: 0;
  }
}

.search-results {
  margin-top: 16px;
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;

  h4 {
    margin-top: 0;
    margin-bottom: 12px;
  }
}

.poetry-results {
  margin-top: 16px;

  .selected {
    border: 2px solid var(--utools-primary);
  }
}

.poetry-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding: 0 4px;
}

.poetry-selected-count {
  margin-left: auto;
  font-size: 13px;
  color: var(--utools-primary);
  font-weight: 500;
}

.poetry-placeholder {
  margin-top: 20px;
}

.poetry-loading {
  margin-top: 16px;
  padding: 0 4px;
}

.idiom-results {
  margin-top: 16px;

  .selected {
    border: 2px solid var(--utools-primary);
  }
}

.idiom-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding: 0 4px;
}

.idiom-selected-count {
  margin-left: auto;
  font-size: 13px;
  color: var(--utools-primary);
  font-weight: 500;
}

.idiom-placeholder {
  margin-top: 20px;
}

.idiom-loading {
  margin-top: 16px;
  padding: 0 4px;
}

:deep(.el-radio__label) {
  width: 100%;
}

.ai-search-header {
  margin-bottom: 16px;
}

.ai-results {
  margin-top: 16px;

  .selected {
    border: 2px solid var(--utools-primary);
  }
}

.ai-placeholder {
  margin-top: 20px;
}

.exam-results {
  margin-top: 16px;

  .selected {
    border: 2px solid var(--utools-primary);
  }
}

.exam-placeholder {
  margin-top: 20px;
}

/* 文件导入格式说明样式 */
.file-format-desc {
  .format-title {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--utools-text-primary);

    .format-tags {
      display: inline-block;
      padding: 2px 8px;
      margin: 0 4px;
      background: var(--utools-bg-active);
      color: var(--utools-text-secondary);
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }
  }

  .format-detail {
    padding: 8px 0;

    p {
      margin: 0 0 12px 0;
      color: var(--utools-text-secondary);
      font-size: 13px;
      line-height: 1.6;
    }

    .meta-fields {
      background: var(--utools-bg-tertiary);
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 12px;

      .meta-field {
        font-size: 13px;
        line-height: 1.8;
        color: var(--utools-text-primary);

        .meta-key {
          color: var(--utools-primary);
          font-weight: 500;
          font-family: monospace;
        }
      }
    }

    .example-box {
      background: var(--utools-bg-tertiary);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;

      .example-header {
        padding: 8px 12px;
        background: var(--utools-bg-secondary);
        border-bottom: 1px solid var(--utools-border-light);

        span {
          font-size: 12px;
          color: var(--utools-text-secondary);
        }
      }

      .example-content {
        padding: 12px;
        margin: 0;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: var(--utools-text-primary);
        white-space: pre-wrap;
        word-break: break-all;
        background: transparent;
      }
    }

    .format-tip {
      margin: 8px 0 0 0;
      padding: 8px 12px;
      background: var(--utools-warning-light);
      border-radius: 4px;
      font-size: 12px;
      color: var(--utools-warning);

      code {
        background: rgba(0, 0, 0, 0.1);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }
    }
  }
}

/* 折叠面板样式优化 */
:deep(.el-collapse) {
  border: none;

  .el-collapse-item__header {
    font-size: 13px;
    color: var(--utools-text-primary);
    background: transparent;
    border-bottom: 1px solid var(--utools-border-light);
    padding-left: 0;
  }

  .el-collapse-item__wrap {
    background: transparent;
    border-bottom: none;
  }

  .el-collapse-item__content {
    padding-bottom: 0;
  }
}

// 手动添加表单底部操作区
.manual-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

// 知识库 / 宫殿桩库搜索框
.lib-search {
  width: 100%;
  margin-bottom: 8px;
}

// 导入候选分组标题
.import-group-title {
  padding: 8px 4px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--utools-text-secondary);

  &:first-child {
    padding-top: 4px;
  }
}

// 缩略配图（emoji 串）
.pack-emojis {
  flex-shrink: 0;
  margin-right: 6px;
  font-size: 15px;
  letter-spacing: 1px;
  line-height: 1;
}

// 知识库 / 宫殿桩库导入行（仿 KnowledgePackPanel 导入对话框）
.import-pack-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--utools-border-light);

  // 已导入的行整体置灰，弱化视觉干扰
  &.imported {
    opacity: 0.5;
  }

  &:last-child {
    border-bottom: none;
  }

  .import-pack-info {
    flex: 1;
    min-width: 0;
  }

  .import-pack-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--utools-text-primary);

    .import-pack-count {
      margin-left: 8px;
      font-size: 12px;
      font-weight: 400;
      color: var(--utools-text-tertiary);
    }
  }

  .import-pack-desc {
    margin-top: 4px;
    font-size: 12px;
    color: var(--utools-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.import-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--utools-text-secondary);
}
</style>
