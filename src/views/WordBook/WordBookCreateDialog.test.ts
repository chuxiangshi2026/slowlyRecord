// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/vue';
import {createPinia, setActivePinia} from 'pinia';
import '@testing-library/jest-dom';
import WordBookCreateDialog from './WordBookCreateDialog.vue';
import type {Word} from '@/types/words';

const hoisted = vi.hoisted(() => ({store: undefined as any}));
vi.mock('@/stores/wordBook', () => ({useWordBookStore: () => hoisted.store}));
vi.mock('element-plus', async importOriginal => ({
  ...(await importOriginal() as any),
  ElMessage: {success: vi.fn(), error: vi.fn()},
}));

function words(count: number): Word[] {
  return Array.from({length: count}, (_, index) => ({
    _id: `id-${index}`,
    text: `word${index}`,
    explains: `释义${index}`,
    isReview: true,
    ctime: new Date(),
    learnDate: new Date(),
    explainedHidden: false,
    level: 0,
    remember: false,
    image: '不应带入学习页',
  }));
}

describe('WordBookCreateDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    hoisted.store = {
      chapters: [],
      loadChapters: vi.fn(() => Promise.resolve()),
      createChapter: vi.fn(() => Promise.resolve({result: {ok: true}, chapter: {_id: 'chapter-1'}})),
      appendChapter: vi.fn(),
    };
  });

  it('将当前筛选结果按 12 词分页，并以学习快照创建章节', async () => {
    const view = render(WordBookCreateDialog, {
      props: {modelValue: false, words: words(13), defaultName: '前缀 pre'},
      global: {
        plugins: [createPinia()],
        stubs: {
          ElDialog: {props: ['modelValue'], template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>'},
          ElButton: {props: ['disabled', 'loading'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'},
        },
      },
    });
    await view.rerender({modelValue: true});
    expect(screen.getByText('每页 12 词 · 将生成 2 页')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', {name: '生成并查看章节'}));

    await waitFor(() => expect(hoisted.store.createChapter).toHaveBeenCalled());
    const [chapterName, pageTitle, snapshots] = hoisted.store.createChapter.mock.calls[0];
    expect(chapterName).toBe('前缀 pre');
    expect(pageTitle).toBe('前缀 pre');
    expect(snapshots).toHaveLength(13);
    expect(snapshots[0]).toEqual({sourceId: 'id-0', text: 'word0', explains: '释义0', phonetic: undefined});
    expect(view.emitted('created')?.[0]).toEqual(['chapter-1']);
  });
});
