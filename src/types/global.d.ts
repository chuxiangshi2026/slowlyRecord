/// <reference types="utools-api-types" />
// 引入 utools-api 与 element
// 全局window对象声明
interface Window {
    // 把utoolsApits声明加入到全局对象,否则无法正常提示
    utools: UToolsApi
    posthog: any
    services: {
        constanst: {
            audioBaseUrl: string
            tableName: ''
        }
        getAppVerson: () => string;
        wordModel: {
            // 添加词
            addVocabulary: (text?:string) => Promise<Word>
            deleteWrodObj: (text: string) => Promise<DbReturn>
            getAllWords: () => Word[]
            getNeedLearnList: () => Word[]
            getAllAndNeedList: () => {allWords: Word[], needLearnWords: Word[], doneList:Word[]}
            addWordToNextLevel: (text: string) => void
            addWordToPreviousLevel: (text: string) => void
            importWordList: (list:Word[]) => void
            minimizeDbSize: Function
            getUtoolsSetting: () => UtoolState
            setUtoolsSetting: (setting: Partial<UtoolState>) => void
            getAppVersionFromDb: () => {version:string}
            setAppVerson: (verson:string) => void
            updateWordTranslate: (word:string, explain: string[]) => void
        }
    }
}


interface UtoolsAction {
    code: 'add_vocabulary' | 'kill' | string
    type: string
    payload: any
    optional: { type: string; payload: any }[]
}
interface PluginEnterAction {
    code: string
    type: string
    payload: any
}

