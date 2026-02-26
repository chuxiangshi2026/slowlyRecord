// 将 AudioBuffer 转换为 WAV 格式的函数
export const bufferToWave = (buffer: AudioBuffer, sampleRate: number): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const frameLength = numberOfChannels * length;
    const bufferLength = 44 + frameLength * 2; // 44 bytes 是 WAV 头部大小

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // 创建 WAV 头部
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + frameLength * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, frameLength * 2, true);

    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([view], {type: 'audio/wav'});
};

/**
 * 下载音频文件返回本地地址
 * @param url 音频URL
 * @param wordId 单词ID
 * @param skipProcessing 是否跳过音频处理（直接存储原始数据，适用于百度等）
 * @param maxRetries 最大重试次数
 */
export const downloadAndStoreAudio = async (url: string, wordId: string, skipProcessing: boolean = false, maxRetries: number = 2): Promise<{
    dataUrl: string,
    objectUrl: string
} | null> => {
    // 重试逻辑
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            console.log(`第${attempt + 1}次重试下载音频...`);
            // 添加延迟避免过于频繁的请求
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
        
        const result = await downloadAudioAttempt(url, wordId, skipProcessing);
        if (result) {
            return result;
        }
    }
    
    console.error(`音频下载失败，已重试${maxRetries + 1}次`);
    return null;
};

/**
 * 单次音频下载尝试
 */
const downloadAudioAttempt = async (url: string, wordId: string, skipProcessing: boolean = false): Promise<{
    dataUrl: string,
    objectUrl: string
} | null> => {
    try {
        console.log('开始下载音频:', url.substring(0, 100));

        const response = await fetch(url);
        
        // 检查响应状态
        if (!response.ok) {
            console.error('下载失败:', response.status, response.statusText);
            return null;
        }
        
        // 检查响应内容类型
        const contentType = response.headers.get('content-type') || '';
        console.log('响应内容类型:', contentType);
        
        // 如果返回的是HTML，说明请求被拦截了
        if (contentType.includes('text/html')) {
            console.error('请求被拦截，返回了HTML页面而非音频');
            return null;
        }
        
        const blob = await response.blob();
        console.log('音频下载成功, 大小:', blob.size, '类型:', blob.type);

        // 更严格的空文件检查
        if (blob.size === 0 || !blob.type.startsWith('audio/')) {
            console.error('音频文件无效: 大小为0或类型不正确');
            return null;
        }

        const arrayBuffer = await blob.arrayBuffer();

        // 如果需要跳过处理，直接存储原始数据
        if (skipProcessing) {
            console.log('跳过处理, 直接存储原始音频');
            // 直接存储原始MP3数据到 localStorage
            const uint8Array = new Uint8Array(arrayBuffer);
            localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));

            // 创建 Data URL
            const reader = new FileReader();
            const dataUrlPromise = new Promise<string>((resolve) => {
                reader.onload = () => resolve(reader.result as string);
            });
            reader.readAsDataURL(blob);
            const dataUrl = await dataUrlPromise;
            console.log('Data URL 生成成功:', dataUrl.substring(0, 50));

            // 创建本地 URL
            return {
                dataUrl: dataUrl,
                objectUrl: URL.createObjectURL(blob)
            };
        }

        // 其他音频（如有道）进行解码处理
        // 创建一个音频上下文用于处理音频
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // 解码音频数据
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        // 降低音频质量以减小文件大小
        // 降低采样率到 22050Hz (标准是 44100Hz)
        const targetSampleRate = 22050;
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            (audioBuffer.duration * targetSampleRate) | 0,
            targetSampleRate
        );

        // 创建源节点
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        // 渲染降低采样率的音频
        const renderedBuffer = await offlineContext.startRendering();

        // 转换为 WAV 格式的 Blob
        const wavBlob = bufferToWave(renderedBuffer, targetSampleRate);

        // 存储到 localStorage (注意：localStorage 有大小限制)
        const wavArrayBuffer = await wavBlob.arrayBuffer();
        const uint8Array = new Uint8Array(wavArrayBuffer);
        localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));

        // 同时存储到单词对象的 pronunciation 字段（base64编码）
        const reader = new FileReader();
        const dataUrlPromise = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(wavBlob);
        const dataUrl = await dataUrlPromise;

        // 创建本地 URL
        return {
            dataUrl: dataUrl,
            objectUrl: URL.createObjectURL(wavBlob)
        };
    } catch (error) {
        console.error('Failed to download and store audio:', error);
        return null;
    }
};
