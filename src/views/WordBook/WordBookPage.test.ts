// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/vue';
import {createPinia, setActivePinia} from 'pinia';
import {createMemoryHistory, createRouter} from 'vue-router';
import {reactive} from 'vue';
import '@testing-library/jest-dom';
import WordBookPage from './WordBookPage.vue';

const hoisted = vi.hoisted(() => ({store: undefined as any, unlocked: true}));
vi.mock('@/stores/wordBook', () => ({useWordBookStore: () => hoisted.store}));
vi.mock('element-plus', async importOriginal => ({
  ...(await importOriginal() as any),
  ElMessage: {error: vi.fn()},
}));

const chapter = {
  _id: 'chapter-1',
  type: 'word_book_chapter',
  name: '测试章节',
  ctime: 1,
  utime: 1,
  pages: [{
    id: 'page-1',
    title: '词根 spect · 第 1 页',
    order: 1,
    attempts: 0,
    words: [
      {sourceId: 'w1', text: 'respect', explains: '尊敬'},
      {sourceId: 'w2', text: 'inspect', explains: '检查'},
    ],
  }],
};

async function setup(routePage = 'page-1') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{path: '/word-book/:chapterId/page/:pageId', component: WordBookPage}],
  });
  await router.push(`/word-book/chapter-1/page/${routePage}`);
  await router.isReady();
  return render(WordBookPage, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ElButton: {props: ['disabled', 'loading'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'},
        ElResult: {props: ['title', 'subTitle'], template: '<div><h2>{{ title }}</h2><p>{{ subTitle }}</p><slot name="extra" /></div>'},
        ElEmpty: {props: ['description'], template: '<div>{{ description }}</div>'},
      },
    },
  });
}

describe('WordBookPage', () => {
  beforeEach(() => {
    hoisted.unlocked = true;
    hoisted.store = reactive({
      chapters: [chapter],
      loading: false,
      loadChapters: vi.fn(() => Promise.resolve()),
      getChapter: vi.fn(() => chapter),
      chapterUnlocked: vi.fn(() => true),
      pageUnlocked: vi.fn(() => hoisted.unlocked),
      completePage: vi.fn(() => Promise.resolve({ok: true})),
    });
  });

  it('没记住的卡移到队尾，全部记住后保存成绩', async () => {
    await setup();
    expect(document.querySelectorAll('.word-node')).toHaveLength(2);
    await fireEvent.click(screen.getByRole('button', {name: '开始本页闯关'}));
    expect(screen.getByText('respect', {selector: '.practice-word'})).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', {name: '显示释义'}));
    await fireEvent.click(screen.getByRole('button', {name: '没记住，稍后再来'}));
    expect(screen.getByText('inspect', {selector: '.practice-word'})).toBeInTheDocument();
    expect(screen.getByText('重出 1 次')).toBeInTheDocument();

    for (let index = 0; index < 2; index++) {
      await fireEvent.click(screen.getByRole('button', {name: '显示释义'}));
      await fireEvent.click(screen.getByRole('button', {name: '记住了'}));
    }
    await waitFor(() => expect(screen.getByText(/本页过关/)).toBeInTheDocument());
    expect(hoisted.store.completePage).toHaveBeenCalledWith('chapter-1', 'page-1', 1);
  });

  it('锁定学习页不可进入练习', async () => {
    hoisted.unlocked = false;
    await setup();
    expect(screen.getByText('本页尚未解锁')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '开始本页闯关'})).not.toBeInTheDocument();
  });
});
