<template>
  <el-dialog
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      @opened="handleDialogOpened"
      title="导入文本"
      width="780px"
      destroy-on-close
  >
    <el-tabs v-model="activeTab">
      <!-- 手动输入 -->
      <el-tab-pane label="手动输入" name="manual">
        <el-form :model="manualForm" label-width="80px">
          <el-form-item label="标题">
            <el-input v-model="manualForm.title" placeholder="输入标题"/>
          </el-form-item>
          <el-form-item label="标签">
            <el-select
                v-model="manualForm.tags"
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
          <el-form-item label="内容">
            <el-input
                v-model="manualForm.content"
                type="textarea"
                :rows="10"
                placeholder="粘贴或输入文本内容..."
            />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 批量导入 -->
      <el-tab-pane label="批量导入" name="batch">
        <el-alert
            title="批量导入格式说明"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
        >
          <p>每篇文章使用以下格式，多篇文章用 --- 分隔：</p>
          <pre style="background: #f5f7fa; padding: 10px; margin-top: 8px;">
标题：文章标题
标签：标签1,标签2
作者：作者名
---
文章内容...
---
标题：另一篇文章
...</pre>
        </el-alert>
        <el-input
            v-model="batchContent"
            type="textarea"
            :rows="12"
            placeholder="粘贴批量导入的文本..."
        />
      </el-tab-pane>

      <!-- 文件导入 -->
      <el-tab-pane label="文件导入" name="file">
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
          <el-form :model="fileForm" label-width="80px" style="margin-top: 16px">
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
                          <el-tag size="small" style="margin-right: 8px">{{ result.author }}</el-tag>
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
                          <el-tag size="small" style="margin-right: 4px" v-for="tag in item.tags.slice(0, 2)" :key="tag">{{ tag }}</el-tag>
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

      <!-- 诗词库 -->
      <el-tab-pane label="诗词库" name="poetry">
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
                    <el-tag size="small">{{ poem.author }}</el-tag>
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
      </el-tab-pane>

      <!-- 成语库 -->
      <el-tab-pane label="成语库" name="idiom">
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
      </el-tab-pane>

      <!-- 地图 -->
      <el-tab-pane label="地图" name="poetryMap">
        <div class="poetry-map-tab">
          <div class="library-map-controls">
            <el-select
                v-model="mapCategory"
                placeholder="类型"
                size="small"
                style="width: 110px"
                @change="handleMapCategoryChange"
            >
              <el-option label="全部" value=""/>
              <el-option label="诗词" value="poetry"/>
              <el-option label="成语" value="idiom"/>
            </el-select>

            <el-select
                v-model="mapDynasty"
                placeholder="选择朝代显示疆域"
                clearable
                size="small"
                style="width: 160px; margin-left: 8px"
                :disabled="mapCategory === 'idiom'"
                @change="handleMapDynastyChange"
            >
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

            <el-select
                v-model="mapAuthor"
                placeholder="选择作者"
                clearable
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                size="small"
                style="width: 180px; margin-left: 8px"
                :disabled="mapCategory === 'idiom'"
                @change="handleMapAuthorChange"
            >
              <el-option
                  v-for="author in availableAuthors"
                  :key="author"
                  :label="author"
                  :value="author"
              />
            </el-select>

            <el-checkbox
                v-if="mapAuthor.length"
                v-model="showAuthorRoute"
                size="small"
                style="margin-left: 8px"
            >
              生平路线
            </el-checkbox>

            <el-button
                size="small"
                style="margin-left: auto"
                @click="clearMapOverlays"
            >
              清除图层
            </el-button>
          </div>

          <div class="library-map-legend">
            <span class="map-legend-item">
              <span class="map-legend-pin"></span>诗词
            </span>
            <span class="map-legend-item">
              <span class="map-legend-circle"></span>成语
            </span>
          </div>

          <div ref="inlineMapContainer" class="standalone-map-container"></div>

          <div v-if="selectedPoetries.length > 0 || selectedIdioms.length > 0" class="map-selected-bar">
            <span v-if="selectedPoetries.length > 0">已选 <strong>{{ selectedPoetries.length }}</strong> 首诗词</span>
            <span v-if="selectedPoetries.length > 0 && selectedIdioms.length > 0">，</span>
            <span v-if="selectedIdioms.length > 0">已选 <strong>{{ selectedIdioms.length }}</strong> 条成语</span>
            <span style="color: #909399; margin-left: 6px">可返回对应库继续查看或在此继续点选</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleImport" :loading="importing">
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
              <a href="https://siliconflow.cn/" target="_blank" style="color: #409eff">SiliconFlow</a>
              - 注册即送 2000 万 Tokens
            </li>
            <li>
              <a href="https://platform.deepseek.com/" target="_blank" style="color: #409eff">DeepSeek</a>
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

  <!-- 地点作品列表弹窗 -->
  <el-dialog
      v-model="showLocationDialog"
      :title="locationDialogTitle"
      width="480px"
      destroy-on-close
  >
    <div style="max-height: 400px; overflow-y: auto;">
      <div
          v-for="poem in locationDialogPoems"
          :key="poem.id"
          style="padding: 10px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #e4e7ed; cursor: pointer;"
          :style="{ background: selectedPoetries.some(p => p.id === poem.id) ? '#f0f9eb' : '#fff', borderColor: selectedPoetries.some(p => p.id === poem.id) ? '#b3e19d' : '#e4e7ed' }"
          @click="togglePoetryInDialog(poem)"
      >
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-checkbox
              :model-value="selectedPoetries.some(p => p.id === poem.id)"
              @click.stop
              @update:model-value="togglePoetryInDialog(poem)"
          />
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: bold; color: #303133;">{{ poem.title }}</div>
            <div style="font-size: 12px; color: #606266; margin-top: 2px;">
              {{ poem.author }} · {{ poem.dynasty }}
              <span v-if="poem.year" style="color: #e6a23c; margin-left: 6px;">{{ formatYear(poem.year) }}</span>
            </div>
            <div style="font-size: 12px; color: #909399; margin-top: 4px; line-height: 1.5;">
              {{ poem.content.split(/\n/).filter(l => l.trim()).slice(0, 2).join(' / ') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="showLocationDialog = false">关闭</el-button>
    </template>
  </el-dialog>

  <!-- 地点成语列表弹窗 -->
  <el-dialog
      v-model="showIdiomLocationDialog"
      :title="idiomLocationDialogTitle"
      width="480px"
      destroy-on-close
  >
    <div style="max-height: 400px; overflow-y: auto;">
      <div
          v-for="item in idiomLocationDialogIdioms"
          :key="item.id"
          style="padding: 10px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #e4e7ed; cursor: pointer;"
          :style="{ background: selectedIdioms.some(s => s.id === item.id) ? '#fdf6ec' : '#fff', borderColor: selectedIdioms.some(s => s.id === item.id) ? '#f5dab1' : '#e4e7ed' }"
          @click="toggleIdiomInDialog(item)"
      >
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-checkbox
              :model-value="selectedIdioms.some(s => s.id === item.id)"
              @click.stop
              @update:model-value="toggleIdiomInDialog(item)"
          />
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px">
              <span style="font-size: 14px; font-weight: bold; color: #303133;">{{ item.title }}</span>
              <el-tag size="small" type="warning">成语</el-tag>
              <el-tag size="small" type="info">{{ item.category }}</el-tag>
            </div>
            <div v-if="item.pinyin" style="font-size: 12px; color: #909399; margin-top: 2px;">
              {{ item.pinyin }}
            </div>
            <div style="font-size: 12px; color: #606266; margin-top: 4px; line-height: 1.5;">
              {{ item.meaning }}
            </div>
            <div v-if="item.source" style="font-size: 11px; color: #909399; margin-top: 4px;">
              出处：{{ item.source }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="showIdiomLocationDialog = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {ref, computed, watch, nextTick, onUnmounted} from 'vue';
import {useTextMemoryStore} from '@/stores/textMemory';
import {useWordsStore} from '@/stores/words';
import {UploadFilled, Setting, Location} from '@element-plus/icons-vue';
import {ElMessage} from 'element-plus';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  searchPoetry,
  fetchAllPoetry,
  fetchPoetryByDynasty,
  DYNASTY_LIST,
  getRandomPoetry,
  type PoetryItem,
  type PoetryDynasty
} from '@/utils/poetry-service';
import {parseLocation} from '@/utils/poetry-location';
import {getTerritoryByDynasty, getDynastyCodeByName} from '@/utils/dynasty-territory';
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

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'import', articles: any[]): void;
  (e: 'openWordSettings'): void;
}>();

const textStore = useTextMemoryStore();
const activeTab = ref('manual');
const importing = ref(false);
const activeCollapse = ref(['plain']); // 默认展开普通文本格式说明

const importButtonText = computed(() => {
  if ((activeTab.value === 'poetry' || activeTab.value === 'poetryMap') && selectedPoetries.value.length > 0) {
    return `导入 ${selectedPoetries.value.length} 首`;
  }
  if (activeTab.value === 'idiom' && selectedIdioms.value.length > 0) {
    return `导入 ${selectedIdioms.value.length} 条成语`;
  }
  return '导入';
});

// 现有标签
const existingTags = computed(() => textStore.allTags);

// 手动输入表单
const manualForm = ref({
  title: '',
  tags: [] as string[],
  content: ''
});

// 批量导入
const batchContent = ref('');

// 文件导入
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

// 内嵌地图
const inlineMapContainer = ref<HTMLDivElement>();
let inlineMap: L.Map | null = null;
let inlineMarkerLayer: L.LayerGroup | null = null;
let inlineTerritoryLayer: L.FeatureGroup | null = null;
let inlineRouteLayer: L.LayerGroup | null = null;

const mapDynasty = ref('');
const mapAuthor = ref<string[]>([]);
const mapCategory = ref<'' | 'poetry' | 'idiom'>('');
const showAuthorRoute = ref(false);

// 地点作品弹窗
const showLocationDialog = ref(false);
const locationDialogTitle = ref('');
const locationDialogPoems = ref<PoetryItem[]>([]);

// 地点成语弹窗
const showIdiomLocationDialog = ref(false);
const idiomLocationDialogTitle = ref('');
const idiomLocationDialogIdioms = ref<IdiomItem[]>([]);

function openLocationDialog(poems: PoetryItem[]) {
  if (!poems.length) return;
  locationDialogTitle.value = poems[0].location || '未知地点';
  locationDialogPoems.value = poems;
  showLocationDialog.value = true;
}

function togglePoetryInDialog(poem: PoetryItem) {
  const index = selectedPoetries.value.findIndex(p => p.id === poem.id);
  if (index > -1) {
    selectedPoetries.value.splice(index, 1);
  } else {
    selectedPoetries.value.push(poem);
  }
  if (activeTab.value === 'poetryMap') {
    if (mapAuthor.value.length) {
      renderAuthorMarkers(mapAuthor.value);
    } else {
      renderInlineMarkers();
    }
  }
}

function openIdiomLocationDialog(items: IdiomItem[]) {
  if (!items.length) return;
  idiomLocationDialogTitle.value = items[0].location || '未知地点';
  idiomLocationDialogIdioms.value = items;
  showIdiomLocationDialog.value = true;
}

function toggleIdiomInDialog(item: IdiomItem) {
  const index = selectedIdioms.value.findIndex(s => s.id === item.id);
  if (index > -1) {
    selectedIdioms.value.splice(index, 1);
  } else {
    selectedIdioms.value.push(item);
  }
  if (activeTab.value === 'poetryMap') {
    renderInlineMarkers();
  }
}

const availableAuthors = computed(() => {
  const set = new Set<string>();
  const dynasty = mapDynasty.value;
  allLibraryPoems.value.forEach(p => {
    if (!p.author || p.author === '佚名') return;
    if (dynasty) {
      const match = p.dynastyCode === dynasty || p.dynasty?.includes(getDynastyName(dynasty as PoetryDynasty));
      if (match) set.add(p.author);
    } else {
      set.add(p.author);
    }
  });
  return Array.from(set).sort();
});

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

// ==================== 内嵌地图功能 ====================

function initInlineMap() {
  if (!inlineMapContainer.value) return;
  const container = inlineMapContainer.value;
  // tab 切换动画或 Dialog 打开动画期间容器尺寸可能为 0，延迟重试
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    setTimeout(initInlineMap, 300);
    return;
  }
  if (inlineMap) {
    inlineMap.remove();
    inlineMap = null;
  }
  // 强制清理容器，防止 destroy-on-close 后 Leaflet 状态残留
  container.innerHTML = '';
  delete (container as any)._leaflet_id;
  // 移除 leaflet 可能添加的类名
  container.classList.remove('leaflet-container', 'leaflet-touch', 'leaflet-fade-anim', 'leaflet-grab', 'leaflet-dragging');
  container.removeAttribute('tabindex');

  inlineMap = L.map(container, {
    center: [35.0, 105.0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
    attribution: '&copy; 高德地图',
  }).addTo(inlineMap);

  L.control.zoom({ position: 'bottomright' }).addTo(inlineMap);

  inlineMarkerLayer = L.layerGroup().addTo(inlineMap);
  inlineTerritoryLayer = L.featureGroup().addTo(inlineMap);
  inlineRouteLayer = L.layerGroup().addTo(inlineMap);

  nextTick(() => {
    inlineMap?.invalidateSize();
    renderInlineMarkers();
    if (mapDynasty.value) renderTerritory(mapDynasty.value);
    if (mapAuthor.value.length) renderAuthorMarkers(mapAuthor.value);
    // 部分环境下首次渲染尺寸为 0，延迟再校正一次
    setTimeout(() => {
      inlineMap?.invalidateSize();
    }, 300);
  });
}

function getMapDisplayPoems(): PoetryItem[] {
  if (mapCategory.value === 'idiom') return [];
  let poems = allLibraryPoems.value.filter(p => p.location);
  if (mapAuthor.value.length) {
    poems = poems.filter(p => mapAuthor.value.includes(p.author));
  } else if (mapDynasty.value) {
    poems = poems.filter(p => p.dynastyCode === mapDynasty.value || p.dynasty?.includes(getDynastyName(mapDynasty.value as PoetryDynasty)));
  }
  return poems;
}

function getMapDisplayIdioms(): IdiomItem[] {
  if (mapCategory.value === 'poetry') return [];
  return allIdioms.value.filter(it => it.location);
}

function renderInlineMarkers() {
  if (!inlineMap || !inlineMarkerLayer) return;
  inlineMarkerLayer.clearLayers();

  // 诗词标记
  renderPoetryMarkers();
  // 成语标记
  renderIdiomMarkers();
}

function renderPoetryMarkers() {
  if (!inlineMap || !inlineMarkerLayer) return;

  const poems = getMapDisplayPoems();
  if (!poems.length) return;

  // 按坐标分组
  const locationMap = new Map<string, PoetryItem[]>();
  poems.forEach(poem => {
    const coord = parseLocation(poem.location);
    if (!coord) return;
    const key = `${coord.lng},${coord.lat}`;
    const list = locationMap.get(key) || [];
    list.push(poem);
    locationMap.set(key, list);
  });

  locationMap.forEach((list) => {
    const coord = parseLocation(list[0].location);
    if (!coord) return;

    const hasMultiple = list.length > 1;
    const isSelected = list.some(p => selectedPoetries.value.some(s => s.id === p.id));
    const allSelected = list.every(p => selectedPoetries.value.some(s => s.id === p.id));

    const marker = L.circleMarker([coord.lat, coord.lng], {
      radius: hasMultiple ? 9 : 6,
      fillColor: allSelected ? '#67c23a' : (isSelected ? '#95d475' : (hasMultiple ? '#f56c6c' : '#409eff')),
      color: '#fff',
      weight: hasMultiple ? 2.5 : 1.5,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(inlineMarkerLayer!);

    if (hasMultiple) {
      const authors = [...new Set(list.map(p => p.author))].join('、');
      const selectedCount = list.filter(p => selectedPoetries.value.some(s => s.id === p.id)).length;
      marker.bindTooltip(
        `<div style="font-size:13px;font-weight:bold">${list[0].location}</div>
         <div style="font-size:12px;color:#666">共 ${list.length} 首作品 · 已选 ${selectedCount} 首</div>
         <div style="font-size:11px;color:#999;margin-top:2px">${authors}</div>
         <div style="font-size:11px;color:#e6a23c;margin-top:2px">点击展开列表</div>`,
        { direction: 'top', offset: [0, -6] }
      );
    } else {
      const poem = list[0];
      const lines = poem.content.split(/\n/).filter(l => l.trim());
      const preview = lines.slice(0, 2).join('<br>');
      const yearStr = formatYear(poem.year);
      const yearHtml = yearStr ? `<div style="font-size:11px;color:#e6a23c;margin-bottom:2px">创作时间：${yearStr}</div>` : '';
      marker.bindTooltip(
        `<div style="font-size:13px;font-weight:bold">${poem.title}</div>
         <div style="font-size:12px;color:#666;margin-bottom:2px">${poem.author} · ${poem.dynasty}</div>
         ${yearHtml}
         <div style="font-size:12px;line-height:1.5">${preview}</div>
         <div style="font-size:11px;color:#999;margin-top:4px">${poem.location}</div>`,
        { direction: 'top', offset: [0, -6] }
      );
    }

    marker.on('click', () => {
      if (list.length === 1) {
        selectPoetry(list[0]);
        renderInlineMarkers();
      } else {
        openLocationDialog(list);
      }
    });
  });
}

function renderIdiomMarkers() {
  if (!inlineMap || !inlineMarkerLayer) return;
  const idioms = getMapDisplayIdioms();
  if (!idioms.length) return;

  // 按坐标分组
  const locationMap = new Map<string, IdiomItem[]>();
  idioms.forEach(item => {
    const coord = parseLocation(item.location);
    if (!coord) return;
    const key = `${coord.lng},${coord.lat}`;
    const list = locationMap.get(key) || [];
    list.push(item);
    locationMap.set(key, list);
  });

  locationMap.forEach((list) => {
    const coord = parseLocation(list[0].location);
    if (!coord) return;

    const hasMultiple = list.length > 1;
    const isSelected = list.some(it => selectedIdioms.value.some(s => s.id === it.id));
    const allSelected = list.every(it => selectedIdioms.value.some(s => s.id === it.id));

    // 成语用方形标记区分诗词
    const size = hasMultiple ? 18 : 14;
    const fill = allSelected ? '#67c23a' : (isSelected ? '#95d475' : '#e6a23c');
    const idiomIcon = L.divIcon({
      className: 'idiom-inline-marker',
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${fill};border:2px solid #fff;
        box-shadow:0 0 0 1.5px ${fill}, 0 1px 4px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:bold;color:#fff;
      ">${hasMultiple ? list.length : ''}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const marker = L.marker([coord.lat, coord.lng], { icon: idiomIcon }).addTo(inlineMarkerLayer!);

    if (hasMultiple) {
      const selectedCount = list.filter(it => selectedIdioms.value.some(s => s.id === it.id)).length;
      const titles = list.slice(0, 3).map(it => it.title).join('、') + (list.length > 3 ? '...' : '');
      marker.bindTooltip(
        `<div style="font-size:13px;font-weight:bold">${list[0].location}</div>
         <div style="font-size:12px;color:#666">共 ${list.length} 条成语 · 已选 ${selectedCount} 条</div>
         <div style="font-size:11px;color:#909399;margin-top:2px">${titles}</div>
         <div style="font-size:11px;color:#e6a23c;margin-top:2px">点击展开列表</div>`,
        { direction: 'top', offset: [0, -6] }
      );
    } else {
      const it = list[0];
      marker.bindTooltip(
        `<div style="font-size:13px;font-weight:bold">${it.title}</div>
         <div style="font-size:11px;color:#e6a23c;margin-bottom:2px">成语 · ${it.category}</div>
         <div style="font-size:12px;line-height:1.5;color:#666">${it.meaning}</div>
         ${it.source ? `<div style="font-size:11px;color:#909399;margin-top:3px">出处：${it.source}</div>` : ''}
         <div style="font-size:11px;color:#999;margin-top:2px">${it.location}</div>`,
        { direction: 'top', offset: [0, -6] }
      );
    }

    marker.on('click', () => {
      if (list.length === 1) {
        selectIdiom(list[0]);
        renderInlineMarkers();
      } else {
        openIdiomLocationDialog(list);
      }
    });
  });
}

function renderTerritory(dynastyCode: string) {
  if (!inlineMap || !inlineTerritoryLayer) return;
  inlineTerritoryLayer.clearLayers();

  const territory = getTerritoryByDynasty(dynastyCode);
  if (!territory) return;

  const polygons: L.Polygon[] = [];

  const drawPoly = (poly: any) => {
    const latlngs = poly.coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
    const polygon = L.polygon(latlngs, {
      color: poly.color,
      fillColor: poly.fillColor,
      weight: 2,
      fillOpacity: 0.25,
    }).bindTooltip(poly.name, { direction: 'center', sticky: true });
    polygons.push(polygon);
    inlineTerritoryLayer!.addLayer(polygon);

    poly.centers.forEach((c: any) => {
      L.circleMarker([c.lat, c.lng], {
        radius: 4,
        fillColor: poly.color,
        color: '#fff',
        weight: 1,
        fillOpacity: 1,
      }).bindTooltip(c.name, { direction: 'top' }).addTo(inlineTerritoryLayer!);
    });
  };

  drawPoly(territory.main);
  territory.others.forEach(drawPoly);

  if (polygons.length) {
    inlineMap.fitBounds(inlineTerritoryLayer.getBounds().pad(0.1));
  }
}

function extractSortYear(year?: string | number): number {
  if (year == null) return Infinity;
  if (typeof year === 'number') return year;
  const m = String(year).match(/(-?\d+)/);
  return m ? parseInt(m[1], 10) : Infinity;
}

function formatYear(year?: string | number): string {
  if (year == null) return '';
  const n = Number(year);
  if (Number.isNaN(n)) return String(year);
  return n < 0 ? `公元前${Math.abs(n)}年` : `公元${n}年`;
}

function getPoemPreview(poem: PoetryItem): string {
  const lines = poem.content.split(/\n/).filter(l => l.trim());
  return lines.slice(0, 2).join('<br>');
}

function addRouteArrows(coords: L.LatLngExpression[], layer: L.LayerGroup, color: string) {
  if (!inlineMap || coords.length < 2) return;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = inlineMap.latLngToContainerPoint(L.latLng(coords[i]));
    const p2 = inlineMap.latLngToContainerPoint(L.latLng(coords[i + 1]));
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI - 90;
    const mid = L.latLng(
      (L.latLng(coords[i]).lat + L.latLng(coords[i + 1]).lat) / 2,
      (L.latLng(coords[i]).lng + L.latLng(coords[i + 1]).lng) / 2,
    );
    const arrowIcon = L.divIcon({
      className: 'route-arrow',
      html: `<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid ${color};transform:rotate(${angle}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker(mid, { icon: arrowIcon, interactive: false }).addTo(layer);
  }
}

const AUTHOR_COLORS = ['#e6a23c', '#409eff', '#67c23a', '#f56c6c', '#9b59b6', '#e74c3c', '#1abc9c', '#3498db'];

function renderAuthorMarkers(authors: string[]) {
  if (!inlineMap || !inlineRouteLayer) return;
  inlineRouteLayer.clearLayers();

  if (!authors.length) return;

  let authorPoems = allLibraryPoems.value.filter(p => authors.includes(p.author) && p.location);
  if (mapDynasty.value) {
    authorPoems = authorPoems.filter(p => p.dynastyCode === mapDynasty.value || p.dynasty?.includes(getDynastyName(mapDynasty.value as PoetryDynasty)));
  }
  if (!authorPoems.length) return;

  // 按作者分组，各自分配颜色
  const authorColorMap = new Map<string, string>();
  authors.forEach((a, i) => authorColorMap.set(a, AUTHOR_COLORS[i % AUTHOR_COLORS.length]));

  const grouped = new Map<string, PoetryItem[]>();
  authorPoems.forEach(p => {
    const list = grouped.get(p.author) || [];
    list.push(p);
    grouped.set(p.author, list);
  });

  let globalIdx = 0;
  const allCoords: L.LatLngExpression[] = [];

  grouped.forEach((poems, author) => {
    const color = authorColorMap.get(author) || '#e6a23c';
    const coords: L.LatLngExpression[] = [];

    // 按坐标再分组
    const locationMap = new Map<string, PoetryItem[]>();
    poems.forEach(p => {
      const coord = parseLocation(p.location);
      if (!coord) return;
      const key = `${coord.lng},${coord.lat}`;
      const list = locationMap.get(key) || [];
      list.push(p);
      locationMap.set(key, list);
    });

    const sortedLocations = Array.from(locationMap.entries()).sort((a, b) => {
      const ya = extractSortYear(a[1][0].year);
      const yb = extractSortYear(b[1][0].year);
      if (ya !== yb) return ya - yb;
      return a[1][0].title.localeCompare(b[1][0].title, 'zh');
    });

    sortedLocations.forEach(([, list]) => {
      const coord = parseLocation(list[0].location);
      if (!coord) return;
      coords.push([coord.lat, coord.lng]);
      allCoords.push([coord.lat, coord.lng]);
      globalIdx++;

      const hasMultiple = list.length > 1;
      const isSelected = list.some(p => selectedPoetries.value.some(s => s.id === p.id));
      const allSelected = list.every(p => selectedPoetries.value.some(s => s.id === p.id));
      const bgColor = allSelected ? '#67c23a' : (isSelected ? '#95d475' : color);
      const num = globalIdx;

      const iconHtml = hasMultiple
        ? `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${bgColor};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:bold;border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
            cursor:pointer;
          ">${num}+</div>`
        : `<div style="
            width:20px;height:20px;border-radius:50%;
            background:${bgColor};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:bold;border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
            cursor:pointer;
          ">${num}</div>`;

      const icon = L.divIcon({
        className: 'author-route-marker',
        html: iconHtml,
        iconSize: hasMultiple ? [22, 22] : [20, 20],
        iconAnchor: hasMultiple ? [11, 11] : [10, 10],
      });

      if (hasMultiple) {
        const selectedCount = list.filter(p => selectedPoetries.value.some(s => s.id === p.id)).length;
        const marker = L.marker([coord.lat, coord.lng], { icon })
          .bindTooltip(
            `<div style="font-size:13px;font-weight:bold">${list[0].location}</div>
             <div style="font-size:12px;color:#666">${author} · 共 ${list.length} 首 · 已选 ${selectedCount} 首</div>
             <div style="font-size:11px;color:#e6a23c;margin-top:2px">点击展开列表</div>`,
            { direction: 'top' }
          )
          .addTo(inlineRouteLayer!);

        marker.on('click', () => {
          openLocationDialog(list);
        });
      } else {
        const poem = list[0];
        const preview = getPoemPreview(poem);
        const yearStr = formatYear(poem.year);
        const yearHtml = yearStr ? `<div style="font-size:11px;color:#e6a23c;margin-bottom:2px">创作时间：${yearStr}</div>` : '';
        const marker = L.marker([coord.lat, coord.lng], { icon })
          .bindTooltip(
            `<div style="font-size:13px;font-weight:bold">${poem.title}</div>
             <div style="font-size:12px;color:#666;margin-bottom:2px">${poem.author} · ${poem.dynasty}</div>
             ${yearHtml}
             <div style="font-size:12px;line-height:1.5">${preview}</div>
             <div style="font-size:11px;color:#999;margin-top:4px">${poem.location}</div>`,
            { direction: 'top' }
          )
          .addTo(inlineRouteLayer!);

        marker.on('click', () => {
          selectPoetry(poem);
          renderAuthorMarkers(authors);
        });
      }
    });

    if (showAuthorRoute.value && coords.length > 1) {
      L.polyline(coords, {
        color: color,
        weight: 4,
        dashArray: '6, 6',
        opacity: 0.9,
      }).addTo(inlineRouteLayer!);
      addRouteArrows(coords, inlineRouteLayer!, color);
    }
  });

  if (allCoords.length && inlineMap) {
    const group = L.featureGroup(inlineRouteLayer.getLayers());
    inlineMap.fitBounds(group.getBounds().pad(0.15));
  }
}

function handleMapDynastyChange(val: string) {
  if (!inlineMap) initInlineMap();
  if (val) {
    renderTerritory(val);
  } else if (inlineTerritoryLayer) {
    inlineTerritoryLayer.clearLayers();
  }
  if (!mapAuthor.value.length) {
    renderInlineMarkers();
  }
}

function handleMapAuthorChange(val: string[]) {
  if (!inlineMap) initInlineMap();
  if (inlineMarkerLayer) inlineMarkerLayer.clearLayers();
  if (val.length) {
    renderAuthorMarkers(val);
    // 全部/成语模式下，作者路线之外仍显示成语标记
    renderIdiomMarkers();
  } else {
    if (inlineRouteLayer) inlineRouteLayer.clearLayers();
    renderInlineMarkers();
  }
}

async function handleMapCategoryChange(val: string) {
  // 切换到成语类时，禁用朝代/作者并清掉路线、疆域
  if (val === 'idiom') {
    mapAuthor.value = [];
    mapDynasty.value = '';
    if (inlineRouteLayer) inlineRouteLayer.clearLayers();
    if (inlineTerritoryLayer) inlineTerritoryLayer.clearLayers();
  }

  // 确保成语库已加载
  if (val !== 'poetry' && allIdioms.value.length === 0) {
    try {
      allIdioms.value = await fetchAllIdioms();
      hasLoadedIdioms.value = true;
    } catch (e) {
      console.error('加载成语库失败', e);
    }
  }

  if (!inlineMap) {
    initInlineMap();
    return;
  }

  if (mapAuthor.value.length) {
    renderAuthorMarkers(mapAuthor.value);
  } else {
    renderInlineMarkers();
  }
}

function clearMapOverlays() {
  if (inlineTerritoryLayer) inlineTerritoryLayer.clearLayers();
  if (inlineRouteLayer) inlineRouteLayer.clearLayers();
  if (inlineMarkerLayer) inlineMarkerLayer.clearLayers();
  mapCategory.value = '';
  mapDynasty.value = '';
  mapAuthor.value = [];
  showAuthorRoute.value = false;
  if (inlineMap) {
    inlineMap.setView([35.0, 105.0], 4);
    renderInlineMarkers();
  }
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

// 解析批量导入内容
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

    let contentStarted = false;
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
      } else if (trimmedLine.startsWith('标签：') || trimmedLine.startsWith('标签:')) {
        article.tags = trimmedLine.replace(/^标签[：:]\s*/, '').split(/[,，]/).map(t => t.trim()).filter(Boolean);
      } else {
        contentStarted = true;
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

// 导入
function handleImport() {
  importing.value = true;

  try {
    let articles: any[] = [];

    switch (activeTab.value) {
      case 'manual':
        if (!manualForm.value.title || !manualForm.value.content) {
          ElMessage.warning('请填写标题和内容');
          return;
        }
        articles = [{
          title: manualForm.value.title,
          content: manualForm.value.content,
          tags: manualForm.value.tags,
          author: '',
          source: ''
        }];
        break;

      case 'batch':
        if (!batchContent.value.trim()) {
          ElMessage.warning('请输入批量导入内容');
          return;
        }
        articles = parseBatchContent(batchContent.value);
        if (articles.length === 0) {
          ElMessage.warning('未能解析出有效文章，请检查格式');
          return;
        }
        break;

      case 'file':
        if (!fileContent.value) {
          ElMessage.warning('请先选择文件');
          return;
        }
        articles = [{
          title: fileForm.value.title || '未命名',
          content: fileContent.value,
          tags: fileForm.value.tags,
          author: '',
          source: ''
        }];
        break;

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

      case 'poetry':
      case 'poetryMap':
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
        break;

      case 'idiom':
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
        break;

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
    resetForm();
  } finally {
    importing.value = false;
  }
}

// 重置表单
function resetForm() {
  manualForm.value = {title: '', tags: [], content: ''};
  batchContent.value = '';
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
  activeTab.value = 'manual';
}

// 关闭对话框
function handleClose() {
  emit('update:modelValue', false);
  resetForm();
}

function handleDialogOpened() {
  if (activeTab.value === 'poetryMap') {
    const tasks: Promise<any>[] = [];
    if (!hasLoadedLibrary.value) {
      tasks.push(fetchAllPoetry().then(all => {
        allLibraryPoems.value = Object.values(all).flat();
        hasLoadedLibrary.value = true;
      }));
    }
    if (!hasLoadedIdioms.value) {
      tasks.push(fetchAllIdioms().then(items => {
        allIdioms.value = items;
        hasLoadedIdioms.value = true;
      }));
    }
    if (tasks.length) {
      Promise.all(tasks).then(() => initInlineMap());
    } else {
      initInlineMap();
    }
  }
}

watch(mapDynasty, () => {
  const valid = availableAuthors.value;
  const removed = mapAuthor.value.filter(a => !valid.includes(a));
  if (removed.length) {
    mapAuthor.value = mapAuthor.value.filter(a => valid.includes(a));
    if (inlineRouteLayer) inlineRouteLayer.clearLayers();
    if (activeTab.value === 'poetryMap') {
      if (mapAuthor.value.length) {
        renderAuthorMarkers(mapAuthor.value);
      } else {
        renderInlineMarkers();
      }
    }
  }
});

watch(activeTab, (tab) => {
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
  } else if (tab === 'poetryMap') {
    nextTick(() => {
      const tasks: Promise<any>[] = [];
      if (!hasLoadedLibrary.value) {
        tasks.push(fetchAllPoetry().then(all => {
          allLibraryPoems.value = Object.values(all).flat();
          hasLoadedLibrary.value = true;
        }));
      }
      if (!hasLoadedIdioms.value) {
        tasks.push(fetchAllIdioms().then(items => {
          allIdioms.value = items;
          hasLoadedIdioms.value = true;
        }));
      }
      if (tasks.length) {
        Promise.all(tasks).then(() => {
          if (props.modelValue) initInlineMap();
        });
      } else if (props.modelValue) {
        if (!inlineMap) initInlineMap();
        else {
          inlineMap.invalidateSize();
          renderInlineMarkers();
        }
      }
    });
  }
});

watch(poetryResults, () => {
  if (activeTab.value === 'poetryMap' && inlineMap && !mapAuthor.value.length) {
    renderInlineMarkers();
  }
});

watch(showAuthorRoute, () => {
  if (activeTab.value === 'poetryMap' && mapAuthor.value.length) {
    renderAuthorMarkers(mapAuthor.value);
  }
});

onUnmounted(() => {
  if (inlineMap) {
    inlineMap.remove();
    inlineMap = null;
  }
  inlineMarkerLayer = null;
  inlineTerritoryLayer = null;
  inlineRouteLayer = null;
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
      background: var(--utools-primary-light);
      color: var(--utools-primary);
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

.library-map-controls {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: var(--utools-bg-secondary);
  border: 1px solid var(--utools-border-light);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.library-map-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: var(--utools-bg-secondary);
  border-left: 1px solid var(--utools-border-light);
  border-right: 1px solid var(--utools-border-light);
  font-size: 12px;
  color: var(--utools-text-secondary);

  .map-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .map-legend-pin {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #409eff;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 0 0 1px #409eff;
  }

  .map-legend-circle {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #e6a23c;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 0 0 1.5px #e6a23c;
  }
}

.standalone-map-container {
  height: 400px;
  background: #f0f0f0;
  border: 1px solid var(--utools-border-light);
  border-radius: 0 0 8px 8px;
}

.map-selected-bar {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--utools-success-light);
  border-radius: 6px;
  font-size: 13px;
  color: var(--utools-success);
}

.author-route-marker {
  background: transparent !important;
  border: none !important;
}

.route-arrow {
  background: transparent !important;
  border: none !important;
}
</style>
